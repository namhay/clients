import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient, listClients, listClientsPaginated } from '@/lib/db/clients'
import { isPaginatedRequest, parsePageParams } from '@/lib/pagination'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''

  if (isPaginatedRequest(searchParams)) {
    const { page, pageSize } = parsePageParams(searchParams)
    const result = await listClientsPaginated(search, page, pageSize)
    return NextResponse.json(result)
  }

  const clients = await listClients(search)
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const client = await createClient(body)
  return NextResponse.json(client, { status: 201 })
}
