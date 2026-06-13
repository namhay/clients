import { NextRequest, NextResponse } from 'next/server'
import { listInvoices } from '@/lib/db/invoices'
import { getInvoicePaymentSummary } from '@/lib/invoice-payments'
import { serializeMiniAppInvoice } from '@/lib/telegram-mini-app-serialize'
import { getInitDataFromRequest, MiniAppAuthError, requireLinkedTelegramClient } from '@/lib/telegram-webapp'

export async function GET(req: NextRequest) {
  try {
    const initData = getInitDataFromRequest(req)
    const { client } = await requireLinkedTelegramClient(initData)

    const status = new URL(req.url).searchParams.get('status')?.toUpperCase() || ''
    const invoices = await listInvoices({
      clientId: client.id,
      ...(status ? { status } : {}),
    })

    const serialized = await Promise.all(
      invoices.map(async invoice => {
        if (invoice.status === 'PAID') {
          return serializeMiniAppInvoice(invoice, { amountPaid: invoice.total, remaining: 0 })
        }
        const summary = await getInvoicePaymentSummary(invoice.id)
        return serializeMiniAppInvoice(invoice, {
          amountPaid: summary.amountPaid,
          remaining: summary.remaining,
        })
      }),
    )

    return NextResponse.json({ invoices: serialized })
  } catch (e) {
    if (e instanceof MiniAppAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'Failed to load invoices'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
