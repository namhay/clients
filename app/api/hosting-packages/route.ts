import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listProductPackages } from '@/lib/db/product-packages'

/** @deprecated Use /api/product-packages?type=HOSTING */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activeOnly = new URL(req.url).searchParams.get('active') === 'true'
  const packages = await listProductPackages({
    productTypeSlug: 'HOSTING',
    activeOnly,
  })
  return NextResponse.json(packages)
}
