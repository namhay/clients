import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createProductType, listProductTypes } from '@/lib/db/product-types'
import { parseProductTypeInput } from '@/lib/product-types'
import { isUniqueViolation, pgErrorMessage } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activeOnly = new URL(req.url).searchParams.get('active') === 'true'
  const types = await listProductTypes(activeOnly)
  return NextResponse.json(types)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = parseProductTypeInput(await req.json())
    const type = await createProductType(data)
    return NextResponse.json(type, { status: 201 })
  } catch (e) {
    const message = pgErrorMessage(e, 'Invalid product type data')
    const status = isUniqueViolation(e) ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
