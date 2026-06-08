import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseProductTypeInput, toPrismaProductTypeData } from '@/lib/product-types'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activeOnly = new URL(req.url).searchParams.get('active') === 'true'
  const types = await prisma.productType.findMany({
    where: activeOnly ? { active: true } : undefined,
    include: { _count: { select: { packages: true, services: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(types)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = parseProductTypeInput(await req.json())
    const type = await prisma.productType.create({
      data: toPrismaProductTypeData(data),
    })
    return NextResponse.json(type, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid product type data'
    const status = message.includes('Unique constraint') ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
