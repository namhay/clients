import { getClientById } from '@/lib/db/clients'
import {
  countInvoices,
  createInvoice,
  findInvoiceByInvoiceNo,
  getInvoiceById,
  listUnpaidInvoicesByClient,
  updateInvoiceRecord,
  type InvoiceWithRelations,
} from '@/lib/db/invoices'
import { createReminderLog } from '@/lib/db/reminder-logs'
import { sendEmail, invoiceEmailTemplate } from '@/lib/email'
import { generateInvoicePdfBuffer } from '@/lib/invoice-pdf'
import { sendTelegramDocument, invoiceTelegramMessage } from '@/lib/telegram'
import { formatAppDate } from '@/lib/app-date'
import { getAppSettings } from '@/lib/settings'

const INVOICE_STATUSES = ['UNPAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const

export async function getNextInvoiceNo(): Promise<string> {
  const count = await countInvoices()
  const { invoicePrefix, invoiceStartNumber } = await getAppSettings()
  const num = invoiceStartNumber + count
  return `${invoicePrefix}${String(num).padStart(4, '0')}`
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

  return updateInvoiceRecord(id, data, paidAt)
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

export function buildServiceInvoiceItems(service: ServiceForInvoice) {
  const label = buildServiceInvoiceLabel(
    service.typeName,
    service.name,
    service.productPackage?.name,
  )
  const period = { periodStart: service.startDate, periodEnd: service.expiryDate }

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

  if (service.setupFee > 0) {
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

export async function createInvoiceForService(service: ServiceForInvoice, tax = 0) {
  return createInvoiceForServices([service], service.clientId, tax)
}

export async function createInvoiceForServices(
  services: ServiceForInvoice[],
  clientId: string,
  tax = 0,
  dueDate?: Date,
) {
  if (!services.length) throw new Error('No services to invoice')

  const items = services.flatMap(s => buildServiceInvoiceItems(s))
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
