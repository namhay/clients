import { formatAppDate } from '@/lib/app-date'
import type { InvoiceItemRow, InvoiceWithRelations } from '@/lib/db/invoices'
import { createInvoicePdfToken } from '@/lib/invoice-tokens'
import { getTelegramMiniAppUrl } from '@/lib/telegram-webapp'

export type MiniAppInvoiceItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export type MiniAppInvoice = {
  id: string
  invoiceNo: string
  status: string
  subtotal: number
  tax: number
  total: number
  dueDate: string
  paidAt: string | null
  amountPaid: number
  remaining: number
  items: MiniAppInvoiceItem[]
  pdfUrl: string
}

function mapItem(item: InvoiceItemRow): MiniAppInvoiceItem {
  return {
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
  }
}

export async function serializeMiniAppInvoice(
  invoice: InvoiceWithRelations,
  payment?: { amountPaid: number; remaining: number },
): Promise<MiniAppInvoice> {
  const baseUrl = getTelegramMiniAppUrl('').replace(/\/$/, '')
  const token = createInvoicePdfToken(invoice.id)
  const dueDate = await formatAppDate(invoice.dueDate)
  const paidAt = invoice.paidAt ? await formatAppDate(invoice.paidAt) : null

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    dueDate,
    paidAt,
    amountPaid: payment?.amountPaid ?? (invoice.status === 'PAID' ? invoice.total : 0),
    remaining: payment?.remaining ?? (invoice.status === 'PAID' ? 0 : invoice.total),
    items: invoice.items.map(mapItem),
    pdfUrl: `${baseUrl}/api/telegram/mini-app/invoices/${invoice.id}/pdf?token=${token}`,
  }
}

export function statusBadgeClass(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === 'PAID') return 'badge-paid'
  if (normalized === 'OVERDUE') return 'badge-overdue'
  if (normalized === 'CANCELLED') return 'badge-gray'
  return 'badge-unpaid'
}

export function canMarkPaid(status: string) {
  const normalized = status.toUpperCase()
  return normalized === 'UNPAID' || normalized === 'OVERDUE'
}
