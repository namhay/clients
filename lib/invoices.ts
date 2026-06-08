import { prisma } from '@/lib/prisma'
import { sendEmail, invoiceEmailTemplate } from '@/lib/email'
import { generateInvoicePdfBuffer } from '@/lib/invoice-pdf'
import { sendTelegramDocument, invoiceTelegramMessage } from '@/lib/telegram'
import { getAppSettings } from '@/lib/settings'

const INVOICE_STATUSES = ['UNPAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const

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
    notes: String(body.notes || '').trim(),
    tax,
    status,
    subtotal,
    total,
    items,
  }
}

export async function updateInvoice(id: string, data: InvoiceInput) {
  const duplicate = await prisma.invoice.findFirst({
    where: { invoiceNo: data.invoiceNo, id: { not: id } },
  })
  if (duplicate) throw new Error('Invoice number already exists')

  const existing = await prisma.invoice.findUnique({ where: { id } })
  if (!existing) throw new Error('Invoice not found')

  const paidAt = data.status === 'PAID'
    ? (existing.paidAt || new Date())
    : null

  return prisma.$transaction(async tx => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
    return tx.invoice.update({
      where: { id },
      data: {
        invoiceNo: data.invoiceNo,
        clientId: data.clientId,
        dueDate: data.dueDate,
        notes: data.notes || null,
        tax: data.tax,
        status: data.status as 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED',
        subtotal: data.subtotal,
        total: data.total,
        paidAt,
        items: {
          create: data.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            periodStart: item.periodStart ?? null,
            periodEnd: item.periodEnd ?? null,
          })),
        },
      },
      include: { client: true, items: true },
    })
  })
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

type ServiceForInvoice = {
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
  const items = buildServiceInvoiceItems(service)
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const total = subtotal + (subtotal * tax / 100)
  const count = await prisma.invoice.count()
  const { invoicePrefix: prefix } = await getAppSettings()
  const invoiceNo = `${prefix}${String(count + 1).padStart(4, '0')}`
  const dueDate = service.nextDueDate || service.expiryDate

  return prisma.invoice.create({
    data: {
      clientId: service.clientId,
      invoiceNo,
      subtotal,
      tax,
      total,
      dueDate,
      items: {
        create: items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          periodStart: i.periodStart ?? null,
          periodEnd: i.periodEnd ?? null,
          total: i.total,
        })),
      },
    },
    include: { client: true, items: true },
  })
}

export async function sendInvoiceToClient(invoiceId: string, clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) throw new Error('Client not found')

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true },
  })
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
        dueDate: invoice.dueDate.toISOString().split('T')[0],
        items: invoice.items.map(i => ({ description: i.description, total: i.total })),
        companyName: settings.companyName,
        notes: invoice.notes || '',
      }),
    })
    await prisma.reminderLog.create({
      data: { clientId, type: `Invoice ${invoice.invoiceNo}`, channel: 'Email', status: 'sent' },
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

export async function sendInvoiceTelegram(invoiceId: string, clientId: string, chatId?: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) throw new Error('Client not found')

  const settings = await getAppSettings()
  const resolvedChatId = chatId
    || client.telegramId
    || settings.telegramDefaultChatId
    || process.env.TELEGRAM_DEFAULT_CHAT_ID
    || ''
  if (!resolvedChatId) throw new Error('No Telegram chat ID')

  const { buffer, invoice } = await generateInvoicePdfBuffer(invoiceId)
  const caption = invoiceTelegramMessage({
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

  await prisma.reminderLog.create({
    data: {
      clientId,
      type: `Invoice ${invoice.invoiceNo} (PDF)`,
      channel: 'Telegram',
      status: 'sent',
    },
  })
}
