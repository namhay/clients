import type { InvoiceItemRow, InvoiceRow, InvoiceWithRelations } from '@/lib/db/invoices'
import { createInvoicePdfToken } from '@/lib/invoice-tokens'
import { roundMoney } from '@/lib/invoice-payments'
import { getTelegramMiniAppUrl } from '@/lib/telegram-webapp'

export type MiniAppInvoiceItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export type MiniAppInvoiceListItem = {
  id: string
  invoiceNo: string
  status: string
  total: number
  dueDate: string
  remaining: number
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

export function serializeMiniAppInvoiceListItem(
  invoice: InvoiceRow,
  amountPaid: number,
  formatDate: (date: Date | string) => string,
): MiniAppInvoiceListItem {
  const remaining = invoice.status === 'PAID'
    ? 0
    : roundMoney(Math.max(0, invoice.total - amountPaid))

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    total: invoice.total,
    dueDate: formatDate(invoice.dueDate),
    remaining,
  }
}

export function serializeMiniAppInvoice(
  invoice: InvoiceWithRelations,
  payment: { amountPaid: number; remaining: number },
  formatDate: (date: Date | string) => string,
): MiniAppInvoice {
  const baseUrl = getTelegramMiniAppUrl('').replace(/\/$/, '')
  const token = createInvoicePdfToken(invoice.id)

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    dueDate: formatDate(invoice.dueDate),
    paidAt: invoice.paidAt ? formatDate(invoice.paidAt) : null,
    amountPaid: payment.amountPaid,
    remaining: payment.remaining,
    items: invoice.items.map(mapItem),
    pdfUrl: `${baseUrl}/api/telegram/mini-app/invoices/${invoice.id}/pdf?token=${token}`,
  }
}

export function canMarkPaid(status: string) {
  const normalized = status.toUpperCase()
  return normalized === 'UNPAID' || normalized === 'OVERDUE'
}
