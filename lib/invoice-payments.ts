import { getInvoiceById, patchInvoice } from '@/lib/db/invoices'
import {
  createInvoicePayment,
  deletePaymentsForInvoice,
  listPaymentsForInvoice,
  sumPaymentsForInvoice,
} from '@/lib/db/invoice-payments'
import { parsePaidAtDate } from '@/lib/invoice-paid-date'
import {
  notifyPaymentReceivedEmail,
  notifyPaymentReceivedTelegram,
  renewServicesForPaidInvoice,
} from '@/lib/invoices'
import { parsePaymentMethod, type PaymentMethod } from '@/lib/payment-methods'

const AMOUNT_EPSILON = 0.005

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function isInvoiceFullyPaid(amountPaid: number, invoiceTotal: number) {
  return amountPaid >= invoiceTotal - AMOUNT_EPSILON
}

export async function getInvoicePaymentSummary(invoiceId: string) {
  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) throw new Error('Invoice not found')

  const payments = await listPaymentsForInvoice(invoiceId)
  const amountPaid = roundMoney(await sumPaymentsForInvoice(invoiceId))
  const remaining = roundMoney(Math.max(0, invoice.total - amountPaid))

  return {
    invoice: {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      total: invoice.total,
      status: invoice.status,
      clientId: invoice.clientId,
    },
    payments,
    amountPaid,
    remaining,
  }
}

export async function recordInvoicePayment(
  invoiceId: string,
  input: {
    amount: number
    paymentMethod: PaymentMethod
    paidAt: Date
    telegramAlert?: boolean
    emailAlert?: boolean
  },
) {
  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) throw new Error('Invoice not found')
  if (invoice.status === 'CANCELLED') throw new Error('Cannot record payment on a cancelled invoice')
  if (invoice.status === 'PAID') throw new Error('Invoice is already fully paid')

  const amount = roundMoney(input.amount)
  if (amount <= 0) throw new Error('Amount must be greater than zero')

  const amountPaid = roundMoney(await sumPaymentsForInvoice(invoiceId))
  const remaining = roundMoney(invoice.total - amountPaid)
  if (amount > remaining + AMOUNT_EPSILON) {
    throw new Error(`Amount cannot exceed remaining balance (${remaining})`)
  }

  const payment = await createInvoicePayment({
    invoiceId,
    amount,
    paymentMethod: input.paymentMethod,
    paidAt: input.paidAt,
  })

  const newAmountPaid = roundMoney(amountPaid + amount)
  const fullyPaid = isInvoiceFullyPaid(newAmountPaid, invoice.total)

  if (fullyPaid) {
    await patchInvoice(invoiceId, { status: 'PAID', paidAt: input.paidAt })
    await renewServicesForPaidInvoice(invoiceId)
    if (input.telegramAlert !== false) {
      await notifyPaymentReceivedTelegram(invoiceId)
    }
    if (input.emailAlert !== false) {
      await notifyPaymentReceivedEmail(invoiceId)
    }
  }

  return {
    payment,
    fullyPaid,
    amountPaid: newAmountPaid,
    remaining: roundMoney(Math.max(0, invoice.total - newAmountPaid)),
    invoice: await getInvoiceById(invoiceId),
  }
}

export function parseRecordPaymentInput(body: Record<string, unknown>) {
  const paymentMethod = parsePaymentMethod(body.paymentMethod)
  if (!paymentMethod) throw new Error('Select a valid payment method')

  const paidAt = parsePaidAtDate(body.paidAt)
  const amount = roundMoney(Number(body.amount))
  if (!Number.isFinite(amount)) throw new Error('Amount is required')

  return {
    amount,
    paymentMethod,
    paidAt,
    telegramAlert: parsePaymentAlertFlag(body.telegramAlert),
    emailAlert: parsePaymentAlertFlag(body.emailAlert),
  }
}

function parsePaymentAlertFlag(value: unknown) {
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  return true
}

