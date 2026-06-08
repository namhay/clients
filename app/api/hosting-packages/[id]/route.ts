import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** @deprecated Use /api/product-packages/[id] */
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
