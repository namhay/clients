import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceById } from '@/lib/db/invoices'
import { getInvoicePaymentSummary } from '@/lib/invoice-payments'
import { serializeMiniAppInvoice } from '@/lib/telegram-mini-app-serialize'
import { getInitDataFromRequest, MiniAppAuthError, requireLinkedTelegramClient } from '@/lib/telegram-webapp'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const initData = getInitDataFromRequest(req)
    const { client } = await requireLinkedTelegramClient(initData)

    const invoice = await getInvoiceById(params.id)
    if (!invoice || invoice.clientId !== client.id) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const summary = await getInvoicePaymentSummary(params.id)
    const serialized = await serializeMiniAppInvoice(invoice, {
      amountPaid: summary.amountPaid,
      remaining: summary.remaining,
    })

    return NextResponse.json({ invoice: serialized, payments: summary.payments })
  } catch (e) {
    if (e instanceof MiniAppAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'Failed to load invoice'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
