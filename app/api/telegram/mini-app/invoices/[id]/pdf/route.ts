import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceById } from '@/lib/db/invoices'
import { generateInvoicePdfBuffer } from '@/lib/invoice-pdf'
import { verifyInvoicePdfToken } from '@/lib/invoice-tokens'
import { getInitDataFromRequest, MiniAppAuthError, requireLinkedTelegramClient } from '@/lib/telegram-webapp'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = new URL(req.url).searchParams.get('token')
  const initData = getInitDataFromRequest(req)

  try {
    let allowed = Boolean(token && verifyInvoicePdfToken(params.id, token))

    if (!allowed && initData) {
      const { client } = await requireLinkedTelegramClient(initData)
      const invoice = await getInvoiceById(params.id)
      allowed = Boolean(invoice && invoice.clientId === client.id)
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { buffer, invoice } = await generateInvoicePdfBuffer(params.id)
    const inline = new URL(req.url).searchParams.get('inline') !== '0'

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${invoice.invoiceNo}.pdf"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (e) {
    if (e instanceof MiniAppAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'PDF generation failed'
    const status = message === 'Invoice not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
