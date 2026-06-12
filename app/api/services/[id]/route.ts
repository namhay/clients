import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteService, getServiceById, updateService } from '@/lib/db/services'
import { parseServiceInput, serviceFields } from '@/lib/services'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = await getServiceById(params.id)
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
  return NextResponse.json(service)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await parseServiceInput(await req.json())
    const service = await updateService(params.id, serviceFields(data))
    return NextResponse.json(service)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid service data'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await deleteService(params.id)
    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete service'
    const status = message === 'Service not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
