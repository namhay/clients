import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createInvoiceForService, sendInvoiceToClient } from '@/lib/invoices'
import { parseServiceInput, serviceInclude, toPrismaCreateData } from '@/lib/services'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const productTypeId = searchParams.get('productTypeId')
  const clientId = searchParams.get('clientId')
  const expiringSoon = searchParams.get('expiringSoon')
  const where: Record<string, unknown> = {}
  if (productTypeId) {
    where.productTypeId = productTypeId
  } else if (type) {
    where.productType = { slug: type.toUpperCase() }
  }
  if (clientId) where.clientId = clientId
  if (expiringSoon) {
    const d = new Date(); d.setDate(d.getDate() + 30)
    where.expiryDate = { lte: d }
    where.status = 'ACTIVE'
  }
  const services = await prisma.service.findMany({
    where,
    include: serviceInclude,
    orderBy: { expiryDate: 'asc' },
  })
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
    const service = await prisma.service.create({
      data: toPrismaCreateData(data),
      include: serviceInclude,
    })

    let invoice = null
    let invoiceSent = null

    if (generateInvoice) {
      invoice = await createInvoiceForService({
        clientId: service.clientId,
        typeName: service.productType.name,
        name: service.name,
        price: service.price,
        setupFee: service.setupFee,
        recurring: service.recurring,
        period: service.period,
        startDate: service.startDate,
        nextDueDate: service.nextDueDate,
        expiryDate: service.expiryDate,
        productPackage: service.productPackage,
      })
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
