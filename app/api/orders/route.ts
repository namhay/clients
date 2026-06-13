import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listOrders, listOrdersPaginated } from '@/lib/db/orders'
import { fulfillOrder, parseOrderInput } from '@/lib/orders'
import { isPaginatedRequest, parsePageParams } from '@/lib/pagination'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  if (isPaginatedRequest(searchParams)) {
    const { page, pageSize } = parsePageParams(searchParams)
    const result = await listOrdersPaginated(page, pageSize)
    return NextResponse.json(result)
  }

  const orders = await listOrders()
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const order = await parseOrderInput(body)
    const result = await fulfillOrder(order, {
      generateInvoice: Boolean(body.generateInvoice),
      sendInvoice: Boolean(body.sendInvoice),
    })
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid order data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
