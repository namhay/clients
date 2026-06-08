import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** @deprecated Use /api/product-packages?type=HOSTING */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activeOnly = new URL(req.url).searchParams.get('active') === 'true'
  const packages = await prisma.productPackage.findMany({
    where: {
      productType: { slug: 'HOSTING' },
      ...(activeOnly ? { active: true } : {}),
    },
    include: { productType: true, _count: { select: { services: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(packages)
}
