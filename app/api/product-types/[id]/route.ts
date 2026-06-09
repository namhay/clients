import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  countProductTypeUsage,
  deleteProductType,
  getProductTypeById,
  updateProductType,
} from '@/lib/db/product-types'
import { parseProductTypeInput } from '@/lib/product-types'
import { pgErrorMessage } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const type = await getProductTypeById(params.id)
  if (!type) return NextResponse.json({ error: 'Product type not found' }, { status: 404 })
  return NextResponse.json(type)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = parseProductTypeInput(await req.json())
    const type = await updateProductType(params.id, data)
    return NextResponse.json(type)
  } catch (e) {
    const message = pgErrorMessage(e, 'Invalid product type data')
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pkgCount, svcCount } = await countProductTypeUsage(params.id)
  if (pkgCount > 0 || svcCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${pkgCount} package(s) and ${svcCount} service(s) use this type` },
      { status: 400 },
    )
  }
  await deleteProductType(params.id)
  return NextResponse.json({ success: true })
}
