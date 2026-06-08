import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const clients = await prisma.client.findMany({
    where: search ? {
      OR: [
        { name: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
      ],
    } : {},
    include: { _count: { select: { services: true, invoices: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const client = await prisma.client.create({ data: body })
  return NextResponse.json(client, { status: 201 })
}
