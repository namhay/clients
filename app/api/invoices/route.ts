import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAppSettings } from '@/lib/settings'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const clientId = searchParams.get('clientId')
  const where: any = {}
  if (status) where.status = status
  if (clientId) where.clientId = clientId
  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true, items: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { clientId, items, dueDate, notes, tax = 0 } = body
  const subtotal = items.reduce((s: number, i: any) => s + i.total, 0)
  const total = subtotal + (subtotal * tax / 100)
  const count = await prisma.invoice.count()
  const { invoicePrefix: prefix } = await getAppSettings()
  const invoiceNo = `${prefix}${String(count + 1).padStart(4, '0')}`
  const invoice = await prisma.invoice.create({
    data: {
      clientId, invoiceNo, subtotal, tax, total, dueDate: new Date(dueDate), notes,
      items: {
        create: items.map((i: any) => ({
          description: i.description,
          quantity: i.quantity || 1,
          unitPrice: i.unitPrice,
          total: i.total,
          periodStart: i.periodStart ? new Date(i.periodStart) : null,
          periodEnd: i.periodEnd ? new Date(i.periodEnd) : null,
        })),
      },
    },
    include: { client: true, items: true },
  })
  return NextResponse.json(invoice, { status: 201 })
}
