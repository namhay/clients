import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseProductPackageInput, toPrismaProductPackageData } from '@/lib/product-packages'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') === 'true'
  const productTypeId = searchParams.get('productTypeId')
  const slug = searchParams.get('type')?.toUpperCase()

  const where: Record<string, unknown> = {}
  if (activeOnly) where.active = true
  if (productTypeId) {
    where.productTypeId = productTypeId
  } else if (slug) {
    where.productType = { slug }
  }

  const packages = await prisma.productPackage.findMany({
    where,
    include: {
      productType: true,
      _count: { select: { services: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(packages)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const productType = await prisma.productType.findUnique({
      where: { id: String(body.productTypeId) },
    })
    if (!productType) throw new Error('Invalid product type')

    const data = parseProductPackageInput(body, productType.hasHostingSpecs)
    const pkg = await prisma.productPackage.create({
      data: toPrismaProductPackageData(data),
      include: { productType: true },
    })
    return NextResponse.json(pkg, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid package data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
