import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createService, listServices } from '@/lib/db/services'
import { createInvoiceForService, sendInvoiceToClient, serviceRecordToInvoiceInput } from '@/lib/invoices'
import { parseServiceInput, serviceFields } from '@/lib/services'
import {
  expiryWithinDays,
  filterServicesDueForAutoInvoice,
  filterServicesDueForReminder,
  getMaxExpiryWindowDays,
} from '@/lib/reminders'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const productTypeId = searchParams.get('productTypeId')
  const clientId = searchParams.get('clientId')
  const expiringSoon = searchParams.get('expiringSoon')
  const dueForReminder = searchParams.get('dueForReminder')
  const dueForAutoInvoice = searchParams.get('dueForAutoInvoice')

  const usePerTypeFilter = Boolean(dueForReminder || dueForAutoInvoice || expiringSoon)
  const filters: Parameters<typeof listServices>[0] = {}

  if (productTypeId) {
    filters.productTypeId = productTypeId
  } else if (type) {
    filters.productTypeSlug = type
  }
  if (clientId) filters.clientId = clientId

  if (usePerTypeFilter) {
    const maxDays = await getMaxExpiryWindowDays()
    filters.expiryDateLte = expiryWithinDays(maxDays)
    filters.status = 'ACTIVE'
  }

  let services = await listServices(filters)

  if (dueForReminder || expiringSoon) {
    services = filterServicesDueForReminder(services)
  } else if (dueForAutoInvoice) {
    services = filterServicesDueForAutoInvoice(services)
  }

  return NextResponse.json(services)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const generateInvoice = Boolean(body.generateInvoice)
    const sendInvoice = Boolean(body.sendInvoice)
    const data = await parseServiceInput(body)
    const service = await createService(serviceFields(data))

    let invoice = null
    let invoiceSent = null

    if (generateInvoice) {
      invoice = await createInvoiceForService(serviceRecordToInvoiceInput(service))
      if (sendInvoice && invoice) {
        invoiceSent = await sendInvoiceToClient(invoice.id, service.clientId)
      }
    }

    return NextResponse.json({ ...service, invoice, invoiceSent }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid service data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
