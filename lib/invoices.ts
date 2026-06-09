import { getClientById } from '@/lib/db/clients'
import {
  createInvoice,
  findInvoiceByInvoiceNo,
  getInvoiceById,
  listInvoiceNumbers,
  listUnpaidInvoicesByClient,
  updateInvoiceRecord,
  type InvoiceItemRow,
  type InvoiceWithRelations,
} from '@/lib/db/invoices'
import {
  getServicesForInvoice,
  listServices,
  updateService,
  type ServiceWithRelations,
} from '@/lib/db/services'
import { createReminderLog } from '@/lib/db/reminder-logs'
import { sendEmail, invoiceEmailTemplate } from '@/lib/email'
import { generateInvoicePdfBuffer } from '@/lib/invoice-pdf'
import { sendTelegramDocument, invoiceTelegramMessage } from '@/lib/telegram'
import { formatAppDate } from '@/lib/app-date'
import { addMonths, extendServiceByBillingCycle, getBillingMonths, revertServiceByBillingCycle } from '@/lib/billing'
import { getAppSettings } from '@/lib/settings'
import { serviceFields } from '@/lib/services'

const INVOICE_STATUSES = ['UNPAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const

export function parseInvoiceSequenceNumber(invoiceNo: string, prefix: string): number | null {
  const trimmed = invoiceNo.trim()
  if (!trimmed) return null

  if (prefix && trimmed.startsWith(prefix)) {
    const suffix = trimmed.slice(prefix.length).trim()
    const num = parseInt(suffix, 10)
    return Number.isNaN(num) ? null : num
  }

  const match = trimmed.match(/(\d+)$/)
  if (!match) return null
  const num = parseInt(match[1], 10)
  return Number.isNaN(num) ? null : num
}

export async function getMaxInvoiceSequence(prefix: string): Promise<number> {
  const numbers = await listInvoiceNumbers()
  let max = 0
  for (const invoiceNo of numbers) {
    const seq = parseInvoiceSequenceNumber(invoiceNo, prefix)
    if (seq != null && seq > max) max = seq
  }
  return max
}

export async function getNextInvoiceNo(): Promise<string> {
  const { invoicePrefix, invoiceStartNumber } = await getAppSettings()
  const maxExisting = await getMaxInvoiceSequence(invoicePrefix)
  const nextNum = Math.max(invoiceStartNumber - 1, maxExisting) + 1
  return `${invoicePrefix}${String(nextNum).padStart(4, '0')}`
}

export type InvoiceItemInput = {
  description: string
  quantity: number
  unitPrice: number
  total: number
  periodStart?: Date | null
  periodEnd?: Date | null
}

export type InvoiceInput = {
  invoiceNo: string
  clientId: string
  dueDate: Date
  invoiceDate?: Date | null
  notes: string
  tax: number
  status: string
  subtotal: number
  total: number
  items: InvoiceItemInput[]
}

export function parseInvoiceInput(body: Record<string, unknown>): InvoiceInput {
  const invoiceNo = String(body.invoiceNo || '').trim()
  if (!invoiceNo) throw new Error('Invoice number is required')

  const clientId = String(body.clientId || '').trim()
  if (!clientId) throw new Error('Client is required')

  const dueDateRaw = String(body.dueDate || '').trim()
  if (!dueDateRaw) throw new Error('Due date is required')
  const dueDate = new Date(dueDateRaw)
  if (Number.isNaN(dueDate.getTime())) throw new Error('Invalid due date')

  const invoiceDateRaw = String(body.invoiceDate || '').trim()
  let invoiceDate: Date | null = null
  if (invoiceDateRaw) {
    invoiceDate = new Date(invoiceDateRaw)
    if (Number.isNaN(invoiceDate.getTime())) throw new Error('Invalid invoice date')
  }

  const rawItems = Array.isArray(body.items) ? body.items : []
  const items: InvoiceItemInput[] = rawItems
    .map((item: Record<string, unknown>) => {
      const periodStartRaw = String(item.periodStart || '').trim()
      const periodEndRaw = String(item.periodEnd || '').trim()
      const periodStart = periodStartRaw ? new Date(periodStartRaw) : null
      const periodEnd = periodEndRaw ? new Date(periodEndRaw) : null
      return {
        description: String(item.description || '').trim(),
        quantity: Math.max(1, parseInt(String(item.quantity)) || 1),
        unitPrice: parseFloat(String(item.unitPrice)) || 0,
        total: parseFloat(String(item.total)) || 0,
        periodStart: periodStart && !Number.isNaN(periodStart.getTime()) ? periodStart : null,
        periodEnd: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd : null,
      }
    })
    .filter(item => item.description)

  if (!items.length) throw new Error('Add at least one invoice item')

  const tax = Math.max(0, parseFloat(String(body.tax)) || 0)
  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const total = subtotal + (subtotal * tax / 100)

  const status = String(body.status || 'UNPAID').toUpperCase()
  if (!INVOICE_STATUSES.includes(status as typeof INVOICE_STATUSES[number])) {
    throw new Error('Invalid invoice status')
  }

  return {
    invoiceNo,
    clientId,
    dueDate,
    invoiceDate,
    notes: String(body.notes || '').trim(),
    tax,
    status,
    subtotal,
    total,
    items,
  }
}

export async function updateInvoice(id: string, data: InvoiceInput) {
  const duplicate = await findInvoiceByInvoiceNo(data.invoiceNo, id)
  if (duplicate) throw new Error('Invoice number already exists')

  const existing = await getInvoiceById(id)
  if (!existing) throw new Error('Invoice not found')

  const paidAt = data.status === 'PAID'
    ? (existing.paidAt || new Date())
    : null

  const invoice = await updateInvoiceRecord(id, data, paidAt)
  if (data.status === 'PAID' && existing.status !== 'PAID') {
    await renewServicesForPaidInvoice(id)
  } else if (data.status !== 'PAID' && existing.status === 'PAID') {
    await revertServicesForUnpaidInvoice(id)
  }
  return invoice
}

const BILLING_CYCLE = '(?:Monthly|Quarterly|Semi-Annual|Annually|One-time)'

export function buildServiceInvoiceLabel(
  typeName: string,
  name: string,
  packageName?: string | null,
): string {
  return packageName
    ? `${typeName} ${packageName} — ${name}`
    : `${typeName} — ${name}`
}

/** e.g. "Domain — angkorwat.com (Registration)" → "Domain Registration — angkorwat.com" */
export function formatInvoiceItemDescription(description: string): string {
  let text = description
    .replace(/\s*—\s*recurring$/i, '')
    .replace(new RegExp(`,\\s*${BILLING_CYCLE}\\)`, 'i'), ')')
    .replace(new RegExp(`\\s*\\(${BILLING_CYCLE}\\)`, 'i'), '')

  const legacy = text.match(/^(.+?) — (.+?) \((.+?)\)$/)
  if (legacy) {
    return `${legacy[1].trim()} ${legacy[3].trim()} — ${legacy[2].trim()}`
  }
  return text
}

export type ServiceForInvoice = {
  clientId: string
  typeName: string
  name: string
  price: number
  setupFee: number
  recurring: boolean
  period: string | null
  startDate: Date
  nextDueDate: Date | null
  expiryDate: Date
  productPackage?: { name: string } | null
}

export function serviceRecordToInvoiceInput(service: {
  clientId: string
  name: string
  price: number
  setupFee: number
  recurring: boolean
  period: string | null
  startDate: Date
  nextDueDate: Date | null
  expiryDate: Date
  productType: { name: string }
  productPackage?: { name: string } | null
}): ServiceForInvoice {
  return {
    clientId: service.clientId,
    typeName: service.productType.name,
    name: service.name,
    price: service.price,
    setupFee: service.setupFee,
    recurring: service.recurring,
    period: service.period,
    startDate: service.startDate,
    nextDueDate: service.nextDueDate,
    expiryDate: service.expiryDate,
    productPackage: service.productPackage,
  }
}

export function getServiceInvoicePeriod(service: Pick<ServiceForInvoice, 'recurring' | 'period' | 'startDate' | 'expiryDate'>) {
  const periodEnd = service.expiryDate
  if (service.recurring && service.period) {
    const months = getBillingMonths(service.period)
    if (months) {
      return { periodStart: addMonths(periodEnd, -months), periodEnd }
    }
  }
  return { periodStart: service.startDate, periodEnd }
}

function expandServicesForInvoiceItems(services: ServiceForInvoice[]): ServiceForInvoice[] {
  const result: ServiceForInvoice[] = []
  for (const service of services) {
    if (service.price > 0) result.push(service)
    if (service.setupFee > 0) result.push(service)
    if (service.price <= 0 && service.setupFee <= 0) result.push(service)
  }
  return result
}

export function findServiceForInvoiceItem(
  description: string,
  services: ServiceForInvoice[],
): ServiceForInvoice | undefined {
  const setup = description.match(/^Setup fee — (.+)$/i)
  if (setup) {
    return services.find(s => s.name === setup[1].trim())
  }
  return services.find(s => {
    const label = buildServiceInvoiceLabel(s.typeName, s.name, s.productPackage?.name)
    return description === label || description.includes(`— ${s.name}`)
  })
}

function isSetupFeeInvoiceItem(description: string): boolean {
  return /^Setup fee — /i.test(description)
}

/** Resolve unique services billed on an invoice (order link or description match). */
export async function getInvoiceServices(invoice: InvoiceWithRelations): Promise<ServiceWithRelations[]> {
  const linked = await getServicesForInvoice(invoice.id)
  if (linked.length) return linked

  const clientServices = await listServices({ clientId: invoice.clientId })
  const serviceInputs = clientServices.map(serviceRecordToInvoiceInput)
  const found = new Map<string, ServiceWithRelations>()

  for (const item of invoice.items) {
    if (isSetupFeeInvoiceItem(item.description)) continue
    const match = findServiceForInvoiceItem(item.description, serviceInputs)
    if (!match) continue
    const service = clientServices.find(s => (
      s.name === match.name && s.productType.name === match.typeName
    ))
    if (service) found.set(service.id, service)
  }

  return Array.from(found.values())
}

/** Extend recurring services on a paid invoice by one billing cycle. */
export async function renewServicesForPaidInvoice(invoiceId: string) {
  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) return

  const services = await getInvoiceServices(invoice)
  for (const service of services) {
    const extension = extendServiceByBillingCycle(service)
    if (!extension) continue

    await updateService(service.id, serviceFields({
      clientId: service.clientId,
      productTypeId: service.productTypeId,
      productPackageId: service.productPackageId,
      name: service.name,
      startDate: service.startDate,
      expiryDate: extension.expiryDate,
      nextDueDate: extension.nextDueDate,
      price: service.price,
      setupFee: service.setupFee,
      recurring: service.recurring,
      period: service.period,
      status: service.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
      notes: service.notes,
    }))
  }
}

/** Roll back recurring services when a paid invoice is reverted to unpaid. */
export async function revertServicesForUnpaidInvoice(invoiceId: string) {
  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) return

  const services = await getInvoiceServices(invoice)
  for (const service of services) {
    const reverted = revertServiceByBillingCycle(service)
    if (!reverted) continue

    await updateService(service.id, serviceFields({
      clientId: service.clientId,
      productTypeId: service.productTypeId,
      productPackageId: service.productPackageId,
      name: service.name,
      startDate: service.startDate,
      expiryDate: reverted.expiryDate,
      nextDueDate: reverted.nextDueDate,
      price: service.price,
      setupFee: service.setupFee,
      recurring: service.recurring,
      period: service.period,
      status: service.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
      notes: service.notes,
    }))
  }
}

/** Fill missing item periods from linked order services or matching client services. */
export async function enrichInvoiceItemsWithPeriods(
  invoice: InvoiceWithRelations,
): Promise<InvoiceItemRow[]> {
  const linked = await getServicesForInvoice(invoice.id)
  const services = (linked.length
    ? linked
    : await listServices({ clientId: invoice.clientId })
  ).map(serviceRecordToInvoiceInput)

  const servicesByItemIndex = linked.length ? expandServicesForInvoiceItems(services) : []

  return invoice.items.map((item, index) => {
    if (item.periodStart && item.periodEnd) return item

    const service = servicesByItemIndex[index]
      || findServiceForInvoiceItem(item.description, services)
    if (!service) return item

    const period = getServiceInvoicePeriod(service)
    return { ...item, periodStart: period.periodStart, periodEnd: period.periodEnd }
  })
}

export type ServiceInvoiceOptions = {
  /** Renewal invoices should not re-bill setup fees. Default true for manual invoices. */
  includeSetupFee?: boolean
}

export function buildServiceInvoiceItems(
  service: ServiceForInvoice,
  options: ServiceInvoiceOptions = {},
) {
  const includeSetupFee = options.includeSetupFee !== false
  const label = buildServiceInvoiceLabel(
    service.typeName,
    service.name,
    service.productPackage?.name,
  )
  const period = getServiceInvoicePeriod(service)

  const items: InvoiceItemInput[] = []

  if (service.price > 0) {
    items.push({
      description: label,
      quantity: 1,
      unitPrice: service.price,
      total: service.price,
      ...period,
    })
  }

  if (includeSetupFee && service.setupFee > 0) {
    items.push({
      description: `Setup fee — ${service.name}`,
      quantity: 1,
      unitPrice: service.setupFee,
      total: service.setupFee,
      ...period,
    })
  }

  if (!items.length) {
    items.push({ description: label, quantity: 1, unitPrice: 0, total: 0, ...period })
  }

  return items
}

export async function createInvoiceForService(
  service: ServiceForInvoice,
  tax = 0,
  options?: ServiceInvoiceOptions,
) {
  return createInvoiceForServices([service], service.clientId, tax, undefined, options)
}

export async function createInvoiceForServices(
  services: ServiceForInvoice[],
  clientId: string,
  tax = 0,
  dueDate?: Date,
  options?: ServiceInvoiceOptions,
) {
  if (!services.length) throw new Error('No services to invoice')

  const items = services.flatMap(s => buildServiceInvoiceItems(s, options))
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const total = subtotal + (subtotal * tax / 100)
  const invoiceNo = await getNextInvoiceNo()

  const dueDates = services.map(s => s.nextDueDate || s.expiryDate)
  const invoiceDueDate = dueDate || dueDates.reduce((earliest, d) => (
    d < earliest ? d : earliest
  ), dueDates[0])

  return createInvoice({
    clientId,
    invoiceNo,
    subtotal,
    tax,
    total,
    dueDate: invoiceDueDate,
    notes: '',
    status: 'UNPAID',
    items,
  })
}

export async function sendInvoiceToClient(invoiceId: string, clientId: string) {
  const client = await getClientById(clientId)
  if (!client) throw new Error('Client not found')

  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) throw new Error('Invoice not found')

  const settings = await getAppSettings()
  const result = { email: false, telegram: false, errors: [] as string[] }

  try {
    await sendEmail({
      to: client.email,
      subject: `Invoice ${invoice.invoiceNo} — $${invoice.total.toFixed(2)} USD`,
      html: invoiceEmailTemplate({
        clientName: client.name,
        invoiceNo: invoice.invoiceNo,
        amount: invoice.total,
        dueDate: await formatAppDate(invoice.dueDate),
        items: invoice.items.map(i => ({ description: i.description, total: i.total })),
        companyName: settings.companyName,
        notes: invoice.notes || '',
      }),
    })
    await createReminderLog({
      clientId,
      type: `Invoice ${invoice.invoiceNo}`,
      channel: 'Email',
      status: 'sent',
    })
    result.email = true
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : 'Email send failed')
  }

  const chatId = client.telegramId || settings.telegramDefaultChatId || process.env.TELEGRAM_DEFAULT_CHAT_ID || ''
  if (chatId) {
    try {
      await sendInvoiceTelegram(invoiceId, clientId, chatId)
      result.telegram = true
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : 'Telegram send failed')
    }
  }

  return result
}

export async function sendUnpaidInvoicesViaTelegram(
  clientId: string,
  chatId: string,
  invoices?: InvoiceWithRelations[],
) {
  const list = invoices ?? await listUnpaidInvoicesByClient(clientId)
  const result = { sent: 0, total: list.length, errors: [] as string[] }

  for (const invoice of list) {
    try {
      await sendInvoiceTelegram(invoice.id, clientId, chatId)
      result.sent++
    } catch (e) {
      result.errors.push(
        `${invoice.invoiceNo}: ${e instanceof Error ? e.message : 'send failed'}`,
      )
    }
  }

  return result
}

export async function sendInvoiceTelegram(invoiceId: string, clientId: string, chatId?: string) {
  const client = await getClientById(clientId)
  if (!client) throw new Error('Client not found')

  const settings = await getAppSettings()
  const resolvedChatId = chatId
    || client.telegramId
    || settings.telegramDefaultChatId
    || process.env.TELEGRAM_DEFAULT_CHAT_ID
    || ''
  if (!resolvedChatId) throw new Error('No Telegram chat ID')

  const { buffer, invoice } = await generateInvoicePdfBuffer(invoiceId)
  const caption = await invoiceTelegramMessage({
    clientName: client.name,
    invoiceNo: invoice.invoiceNo,
    amount: invoice.total,
    dueDate: invoice.dueDate,
    companyName: settings.companyName,
    status: invoice.status,
  })

  await sendTelegramDocument(
    resolvedChatId,
    buffer,
    `${invoice.invoiceNo}.pdf`,
    caption,
  )

  await createReminderLog({
    clientId,
    type: `Invoice ${invoice.invoiceNo} (PDF)`,
    channel: 'Telegram',
    status: 'sent',
  })
}
