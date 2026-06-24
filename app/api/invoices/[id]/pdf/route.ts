import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateInvoicePdfBuffer } from '@/lib/invoice-pdf'
import { verifyInvoicePdfToken } from '@/lib/invoice-tokens'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = new URL(req.url).searchParams.get('token')
  const session = await getServerSession(authOptions)
  const allowed = Boolean(session) || (token && verifyInvoicePdfToken(params.id, token))

  if (!allowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { buffer, invoice } = await generateInvoicePdfBuffer(params.id)
    const inline = new URL(req.url).searchParams.get('inline') === '1'
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${invoice.invoiceNo}.pdf"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (e) {
    console.error('Invoice PDF generation failed:', e)
    const message = e instanceof Error ? e.message : 'PDF generation failed'
    const status = message === 'Invoice not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
