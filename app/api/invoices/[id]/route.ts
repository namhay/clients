import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteInvoice, getInvoiceById, patchInvoice } from '@/lib/db/invoices'
import { parsePaidAtDate } from '@/lib/invoice-paid-date'
import {
  notifyPaymentReceivedTelegram,
  parseInvoiceInput,
  renewServicesForPaidInvoice,
  revertServicesForUnpaidInvoice,
  updateInvoice,
} from '@/lib/invoices'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const invoice = await getInvoiceById(params.id)
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(invoice)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    if (body.items) {
      const data = parseInvoiceInput(body)
      const invoice = await updateInvoice(params.id, data)
      return NextResponse.json(invoice)
    }
    const existing = await getInvoiceById(params.id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.paidAt !== undefined && body.status === undefined && !body.items) {
      if (existing.status !== 'PAID') {
        return NextResponse.json(
          { error: 'Only paid invoices can have a payment date updated' },
          { status: 400 },
        )
      }
      const invoice = await patchInvoice(params.id, { paidAt: parsePaidAtDate(body.paidAt) })
      return NextResponse.json(invoice)
    }

    const patch: Record<string, unknown> = { ...body }
    if (body.status === 'PAID' && !body.paidAt) patch.paidAt = new Date()
    if (body.status && body.status !== 'PAID') patch.paidAt = null
    if (body.paidAt !== undefined && body.status === 'PAID') {
      patch.paidAt = parsePaidAtDate(body.paidAt)
    }
    const invoice = await patchInvoice(params.id, patch as Parameters<typeof patchInvoice>[1])
    if (body.status === 'PAID' && existing.status !== 'PAID') {
      await renewServicesForPaidInvoice(params.id)
      await notifyPaymentReceivedTelegram(params.id)
    } else if (body.status && body.status !== 'PAID' && existing.status === 'PAID') {
      await revertServicesForUnpaidInvoice(params.id)
    }
    return NextResponse.json(invoice)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update invoice'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await deleteInvoice(params.id)
  return NextResponse.json({ success: true })
}
