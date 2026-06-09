import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAppDateFormat, getAppTimezone } from '@/lib/app-date'
import { formatDateTimeValue } from '@/lib/date-format'
import { deleteClient, getClientDetail, updateClient } from '@/lib/db/clients'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const client = await getClientDetail(params.id)
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [dateFormat, timezone] = await Promise.all([getAppDateFormat(), getAppTimezone()])
  const reminderLogs = client.reminderLogs.map(log => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
    createdAtDisplay: formatDateTimeValue(log.createdAt, dateFormat, timezone),
  }))

  return NextResponse.json({
    ...client,
    reminderLogs,
    services: client.services.map(s => ({
      ...s,
      startDate: s.startDate.toISOString(),
      expiryDate: s.expiryDate.toISOString(),
      nextDueDate: s.nextDueDate?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    invoices: client.invoices.map(inv => ({
      ...inv,
      dueDate: inv.dueDate.toISOString(),
      paidAt: inv.paidAt?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    })),
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const client = await updateClient(params.id, body)
  return NextResponse.json(client)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await deleteClient(params.id)
  return NextResponse.json({ success: true })
}
