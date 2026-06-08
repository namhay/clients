import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseProductTypeInput, toPrismaProductTypeData } from '@/lib/product-types'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const type = await prisma.productType.findUnique({
    where: { id: params.id },
    include: { _count: { select: { packages: true, services: true } } },
  })
  if (!type) return NextResponse.json({ error: 'Product type not found' }, { status: 404 })
  return NextResponse.json(type)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = parseProductTypeInput(await req.json())
    const type = await prisma.productType.update({
      where: { id: params.id },
      data: toPrismaProductTypeData(data),
    })
    return NextResponse.json(type)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid product type data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [pkgCount, svcCount] = await Promise.all([
    prisma.productPackage.count({ where: { productTypeId: params.id } }),
    prisma.service.count({ where: { productTypeId: params.id } }),
  ])
  if (pkgCount > 0 || svcCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${pkgCount} package(s) and ${svcCount} service(s) use this type` },
      { status: 400 },
    )
  }
  await prisma.productType.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
