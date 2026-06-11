import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClientById } from '@/lib/db/clients'
import { runAutoInvoicesForClient } from '@/lib/run-auto-invoices'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getClientById(params.id)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  try {
    const result = await runAutoInvoicesForClient(params.id)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate invoices'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
