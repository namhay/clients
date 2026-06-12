import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getInvoiceById, patchInvoice } from '@/lib/db/invoices'
import { getInvoicePaymentById, updateInvoicePayment } from '@/lib/db/invoice-payments'
import { parsePaidAtDate } from '@/lib/invoice-paid-date'
import { parsePaymentMethod } from '@/lib/payment-methods'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const payment = await getInvoicePaymentById(params.id)
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    const paidAt = body.paidAt !== undefined ? parsePaidAtDate(body.paidAt) : undefined
    const paymentMethod = body.paymentMethod !== undefined
      ? parsePaymentMethod(body.paymentMethod) || undefined
      : undefined

    if (body.paymentMethod !== undefined && !paymentMethod) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    const updated = await updateInvoicePayment(params.id, { paidAt, paymentMethod })

    const invoice = await getInvoiceById(payment.invoiceId)
    if (invoice?.status === 'PAID' && paidAt) {
      await patchInvoice(payment.invoiceId, { paidAt })
    }

    return NextResponse.json(updated)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update payment'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
