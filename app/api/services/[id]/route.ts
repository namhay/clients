import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseServiceInput, serviceInclude, toPrismaUpdateData } from '@/lib/services'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = await prisma.service.findUnique({
    where: { id: params.id },
    include: serviceInclude,
  })
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  return NextResponse.json(service)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await parseServiceInput(await req.json())
    const service = await prisma.service.update({
      where: { id: params.id },
      data: toPrismaUpdateData(data),
      include: serviceInclude,
    })
    return NextResponse.json(service)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid service data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.service.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
