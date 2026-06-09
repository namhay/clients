import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  countProductPackageUsage,
  deleteProductPackage,
  getProductPackageById,
  updateProductPackage,
} from '@/lib/db/product-packages'
import { getProductTypeById } from '@/lib/db/product-types'
import { parseProductPackageInput } from '@/lib/product-packages'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const pkg = await getProductPackageById(params.id)
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  return NextResponse.json(pkg)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const existing = await getProductPackageById(params.id)
    if (!existing) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    const productTypeId = String(body.productTypeId || existing.productTypeId)
    const productType = await getProductTypeById(productTypeId)
    if (!productType) throw new Error('Invalid product type')

    const data = parseProductPackageInput({ ...body, productTypeId }, productType.hasHostingSpecs)
    const pkg = await updateProductPackage(params.id, data)
    return NextResponse.json(pkg)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid package data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const inUse = await countProductPackageUsage(params.id)
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${inUse} service(s) use this package` },
      { status: 400 },
    )
  }
  await deleteProductPackage(params.id)
  return NextResponse.json({ success: true })
}
