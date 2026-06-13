import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings } from '@/lib/settings'
import {
  authenticateTelegramMiniApp,
  getInitDataFromRequest,
} from '@/lib/telegram-webapp'

export async function GET(req: NextRequest) {
  try {
    const initData = getInitDataFromRequest(req)
    const auth = await authenticateTelegramMiniApp(initData)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or expired Telegram session' }, { status: 401 })
    }

    const settings = await getAppSettings()
    return NextResponse.json({
      user: {
        id: auth.user.id,
        firstName: auth.user.first_name || '',
        username: auth.user.username || null,
      },
      linked: Boolean(auth.client),
      client: auth.client
        ? { id: auth.client.id, name: auth.client.name, email: auth.client.email }
        : null,
      companyName: settings.companyName,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
