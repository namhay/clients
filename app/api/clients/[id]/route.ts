import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      services: {
        include: { productType: true, productPackage: true },
        orderBy: { expiryDate: 'asc' },
      },
      invoices: { include: { items: true }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const reminderLogs = await prisma.reminderLog.findMany({
    where: { clientId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({ ...client, reminderLogs })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const client = await prisma.client.update({ where: { id: params.id }, data: body })
  return NextResponse.json(client)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.client.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
