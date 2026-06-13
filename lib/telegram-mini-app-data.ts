import { DEFAULT_TIMEZONE, formatDateValue, parseDateFormat } from '@/lib/date-format'
import { getInvoiceById, listInvoiceRowsByClient } from '@/lib/db/invoices'
import { sumPaymentsForInvoice, sumPaymentsForInvoices } from '@/lib/db/invoice-payments'
import { roundMoney } from '@/lib/invoice-payments'
import { parseReminderTimezone } from '@/lib/reminder-schedule'
import { getAppSettings } from '@/lib/settings'
import type { ClientRow } from '@/lib/db/clients'
import type { TelegramWebAppUser } from '@/lib/telegram-webapp'
import {
  serializeMiniAppInvoice,
  serializeMiniAppInvoiceListItem,
  type MiniAppInvoice,
  type MiniAppInvoiceListItem,
} from '@/lib/telegram-mini-app-serialize'

export type MiniAppHomeData = {
  user: { id: number; firstName: string; username: string | null }
  linked: boolean
  client: { id: string; name: string; email: string } | null
  companyName: string
  invoices: MiniAppInvoiceListItem[]
}

function createDateFormatter(settings: Awaited<ReturnType<typeof getAppSettings>>) {
  const format = parseDateFormat(settings.dateFormat)
  const timezone = parseReminderTimezone(settings.reminderTimezone, DEFAULT_TIMEZONE)
  return (date: Date | string) => formatDateValue(date, format, timezone)
}

function mapSessionUser(user: TelegramWebAppUser) {
  return {
    id: user.id,
    firstName: user.first_name || '',
    username: user.username || null,
  }
}

function mapSessionClient(client: ClientRow) {
  return { id: client.id, name: client.name, email: client.email }
}

export async function loadMiniAppHome(client: ClientRow, user: TelegramWebAppUser): Promise<MiniAppHomeData> {
  const invoiceRows = await listInvoiceRowsByClient(client.id)
  const openIds = invoiceRows
    .filter(invoice => invoice.status !== 'PAID' && invoice.status !== 'CANCELLED')
    .map(invoice => invoice.id)

  const [settings, paymentSums] = await Promise.all([
    getAppSettings(),
    sumPaymentsForInvoices(openIds),
  ])

  const formatDate = createDateFormatter(settings)
  const invoices = invoiceRows.map(invoice => {
    const amountPaid = invoice.status === 'PAID'
      ? invoice.total
      : roundMoney(paymentSums.get(invoice.id) || 0)
    return serializeMiniAppInvoiceListItem(invoice, amountPaid, formatDate)
  })

  return {
    user: mapSessionUser(user),
    linked: true,
    client: mapSessionClient(client),
    companyName: settings.companyName,
    invoices,
  }
}

export async function loadMiniAppHomeUnlinked(user: TelegramWebAppUser): Promise<MiniAppHomeData> {
  const settings = await getAppSettings()
  return {
    user: mapSessionUser(user),
    linked: false,
    client: null,
    companyName: settings.companyName,
    invoices: [],
  }
}

export async function loadMiniAppInvoiceDetail(invoiceId: string, clientId: string): Promise<MiniAppInvoice> {
  const [invoice, amountPaidRaw, settings] = await Promise.all([
    getInvoiceById(invoiceId),
    sumPaymentsForInvoice(invoiceId),
    getAppSettings(),
  ])

  if (!invoice || invoice.clientId !== clientId) {
    throw new Error('Invoice not found')
  }

  const amountPaid = roundMoney(amountPaidRaw)
  const remaining = roundMoney(Math.max(0, invoice.total - amountPaid))
  const formatDate = createDateFormatter(settings)

  return serializeMiniAppInvoice(invoice, { amountPaid, remaining }, formatDate)
}
