import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAppSettings, parseSettingsInput, saveAppSettings, toPublicSettings } from '@/lib/settings'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const settings = await getAppSettings()
  return NextResponse.json(toPublicSettings(settings), {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const existing = await getAppSettings()
    const data = parseSettingsInput(await req.json(), existing)
    const { settings, envFileUpdated } = await saveAppSettings(data)
    return NextResponse.json({
      ...toPublicSettings(settings),
      savedTo: envFileUpdated ? ['database', 'env'] : ['database'],
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid settings'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
