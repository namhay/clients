import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseProductPackageInput, toPrismaProductPackageData } from '@/lib/product-packages'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const pkg = await prisma.productPackage.findUnique({
    where: { id: params.id },
    include: { productType: true, _count: { select: { services: true } } },
  })
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  return NextResponse.json(pkg)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const existing = await prisma.productPackage.findUnique({
      where: { id: params.id },
      include: { productType: true },
    })
    if (!existing) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    const productTypeId = String(body.productTypeId || existing.productTypeId)
    const productType = await prisma.productType.findUnique({ where: { id: productTypeId } })
    if (!productType) throw new Error('Invalid product type')

    const data = parseProductPackageInput({ ...body, productTypeId }, productType.hasHostingSpecs)
    const pkg = await prisma.productPackage.update({
      where: { id: params.id },
      data: toPrismaProductPackageData(data),
      include: { productType: true },
    })
    return NextResponse.json(pkg)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid package data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const inUse = await prisma.service.count({ where: { productPackageId: params.id } })
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${inUse} service(s) use this package` },
      { status: 400 },
    )
  }
  await prisma.productPackage.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
