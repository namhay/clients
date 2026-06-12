import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createInvoice, listInvoices, listInvoicesPaginated } from '@/lib/db/invoices'
import { getNextInvoiceNo } from '@/lib/invoices'
import { isPaginatedRequest, parsePageParams } from '@/lib/pagination'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const clientId = searchParams.get('clientId')

  if (isPaginatedRequest(searchParams) && !clientId) {
    const { page, pageSize } = parsePageParams(searchParams)
    const search = searchParams.get('search') || ''
    const result = await listInvoicesPaginated(
      {
        status: status || undefined,
        search,
      },
      page,
      pageSize,
    )
    return NextResponse.json(result)
  }

  const invoices = await listInvoices({
    status: status || undefined,
    clientId: clientId || undefined,
  })
  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { clientId, items, dueDate, invoiceDate, notes, tax = 0 } = body
  const subtotal = items.reduce((s: number, i: { total: number }) => s + i.total, 0)
  const total = subtotal + (subtotal * tax / 100)
  const invoiceNo = await getNextInvoiceNo()
  const invoice = await createInvoice({
    clientId,
    invoiceNo,
    subtotal,
    tax,
    total,
    dueDate: new Date(dueDate),
    invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
    notes: notes || '',
    status: 'UNPAID',
    items: items.map((i: {
      description: string
      quantity?: number
      unitPrice: number
      total: number
      periodStart?: string
      periodEnd?: string
    }) => ({
      description: i.description,
      quantity: i.quantity || 1,
      unitPrice: i.unitPrice,
      total: i.total,
      periodStart: i.periodStart ? new Date(i.periodStart) : null,
      periodEnd: i.periodEnd ? new Date(i.periodEnd) : null,
    })),
  })
  return NextResponse.json(invoice, { status: 201 })
}
