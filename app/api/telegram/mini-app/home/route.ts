import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateTelegramMiniApp,
  getInitDataFromRequest,
  MiniAppAuthError,
} from '@/lib/telegram-webapp'
import { loadMiniAppHome, loadMiniAppHomeUnlinked } from '@/lib/telegram-mini-app-data'

export async function GET(req: NextRequest) {
  try {
    const initData = getInitDataFromRequest(req)
    const auth = await authenticateTelegramMiniApp(initData)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or expired Telegram session' }, { status: 401 })
    }

    const payload = auth.client
      ? await loadMiniAppHome(auth.client, auth.user)
      : await loadMiniAppHomeUnlinked(auth.user)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (e) {
    if (e instanceof MiniAppAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'Failed to load Mini App'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
