import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseInvoiceInput, updateInvoice } from '@/lib/invoices'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { client: true, items: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(invoice)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    if (body.items) {
      const data = parseInvoiceInput(body)
      const invoice = await updateInvoice(params.id, data)
      return NextResponse.json(invoice)
    }
    const data: Record<string, unknown> = { ...body }
    if (body.status === 'PAID' && !body.paidAt) data.paidAt = new Date()
    if (body.status && body.status !== 'PAID') data.paidAt = null
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data,
      include: { client: true, items: true },
    })
    return NextResponse.json(invoice)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update invoice'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.invoice.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
