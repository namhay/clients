import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getServiceById } from '@/lib/db/services'
import { createInvoiceForService, sendInvoiceToClient, serviceRecordToInvoiceInput } from '@/lib/invoices'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const sendInvoice = Boolean(body.sendInvoice)

    const service = await getServiceById(params.id)
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

    const invoice = await createInvoiceForService(serviceRecordToInvoiceInput(service))
    let invoiceSent = null
    if (sendInvoice) {
      invoiceSent = await sendInvoiceToClient(invoice.id, service.clientId)
    }

    return NextResponse.json({ invoice, invoiceSent })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate invoice'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
