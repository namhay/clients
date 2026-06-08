import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateInvoicePdfBuffer } from '@/lib/invoice-pdf'
import { verifyInvoicePdfToken } from '@/lib/invoice-tokens'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = new URL(req.url).searchParams.get('token')
  const session = await getServerSession(authOptions)
  const allowed = Boolean(session) || (token && verifyInvoicePdfToken(params.id, token))

  if (!allowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { buffer, invoice } = await generateInvoicePdfBuffer(params.id)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNo}.pdf"`,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }
}
