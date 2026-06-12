import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getInvoicePaymentSummary,
  parseRecordPaymentInput,
  recordInvoicePayment,
} from '@/lib/invoice-payments'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const summary = await getInvoicePaymentSummary(params.id)
    return NextResponse.json(summary)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load payments'
    const status = message === 'Invoice not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const input = parseRecordPaymentInput(body)
    const result = await recordInvoicePayment(params.id, input)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to record payment'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
