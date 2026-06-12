import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createService, listServices, listServicesPaginated } from '@/lib/db/services'
import { isPaginatedRequest, parsePageParams } from '@/lib/pagination'
import { createInvoiceForService, sendInvoiceToClient, serviceRecordToInvoiceInput } from '@/lib/invoices'
import { parseServiceInput, serviceFields } from '@/lib/services'
import {
  expiryWithinDays,
  filterServicesDueForAutoInvoice,
  filterServicesInReminderWindow,
  getMaxExpiryWindowDays,
  listServicesForReminderDisplay,
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

  if (isPaginatedRequest(searchParams) && !usePerTypeFilter && !clientId) {
    const { page, pageSize } = parsePageParams(searchParams)
    const search = searchParams.get('search') || ''
    const result = await listServicesPaginated(
      {
        productTypeId: productTypeId || undefined,
        search,
      },
      page,
      pageSize,
    )
    return NextResponse.json(result)
  }

  const filters: Parameters<typeof listServices>[0] = {}

  if (productTypeId) {
    filters.productTypeId = productTypeId
  } else if (type) {
    filters.productTypeSlug = type
  }
  if (clientId) filters.clientId = clientId

  if (usePerTypeFilter) {
    if (dueForReminder || expiringSoon) {
      let services = await listServicesForReminderDisplay()
      if (productTypeId) {
        services = services.filter(s => s.productTypeId === productTypeId)
      } else if (type) {
        const slug = type.toUpperCase()
        services = services.filter(s => s.productType?.slug === slug)
      }
      if (clientId) {
        services = services.filter(s => s.clientId === clientId)
      }
      services = filterServicesInReminderWindow(services)
      return NextResponse.json(services)
    }

    filters.expiryDateLte = expiryWithinDays(await getMaxExpiryWindowDays())
    filters.status = 'ACTIVE'
  }
  let services = await listServices(filters)

  if (dueForAutoInvoice) {
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
      invoice = await createInvoiceForService(
        serviceRecordToInvoiceInput(service),
        0,
        { periodMode: 'form' },
      )
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
