import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createProductPackage, listProductPackages } from '@/lib/db/product-packages'
import { getProductTypeById } from '@/lib/db/product-types'
import { parseProductPackageInput } from '@/lib/product-packages'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') === 'true'
  const productTypeId = searchParams.get('productTypeId')
  const slug = searchParams.get('type')?.toUpperCase()

  const packages = await listProductPackages({
    activeOnly,
    productTypeId: productTypeId || undefined,
    productTypeSlug: slug,
  })
  return NextResponse.json(packages)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const productType = await getProductTypeById(String(body.productTypeId))
    if (!productType) throw new Error('Invalid product type')

    const data = parseProductPackageInput(body, productType.hasHostingSpecs)
    const pkg = await createProductPackage(data)
    return NextResponse.json(pkg, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid package data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
