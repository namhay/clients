import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClientById } from '@/lib/db/clients'
import { getServiceById } from '@/lib/db/services'
import {
  createInvoiceForServices,
  sendInvoiceToClient,
  serviceRecordToInvoiceInput,
} from '@/lib/invoices'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getClientById(params.id)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  try {
    const body = await req.json().catch(() => ({}))
    const rawIds = Array.isArray(body.serviceIds) ? body.serviceIds : []
    const serviceIds: string[] = Array.from(new Set(
      rawIds.map((id: unknown) => String(id).trim()).filter(Boolean),
    ))

    if (!serviceIds.length) {
      return NextResponse.json({ error: 'Select at least one service' }, { status: 400 })
    }

    const sendInvoice = Boolean(body.sendInvoice)
    const services = []

    for (const serviceId of serviceIds) {
      const service = await getServiceById(serviceId)
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }
      if (service.clientId !== params.id) {
        return NextResponse.json({ error: 'Service does not belong to this client' }, { status: 400 })
      }
      services.push(service)
    }

    const invoice = await createInvoiceForServices(
      services.map(serviceRecordToInvoiceInput),
      params.id,
      undefined,
      { periodMode: 'renewal' },
    )

    let invoiceSent = null
    if (sendInvoice) {
      invoiceSent = await sendInvoiceToClient(invoice.id, params.id)
    }

    return NextResponse.json({ invoice, invoiceSent })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate invoice'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
