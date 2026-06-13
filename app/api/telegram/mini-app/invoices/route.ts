import { NextRequest, NextResponse } from 'next/server'
import { loadMiniAppHome } from '@/lib/telegram-mini-app-data'
import { getInitDataFromRequest, MiniAppAuthError, requireLinkedTelegramClient } from '@/lib/telegram-webapp'

export async function GET(req: NextRequest) {
  try {
    const initData = getInitDataFromRequest(req)
    const { client, user } = await requireLinkedTelegramClient(initData)
    const home = await loadMiniAppHome(client, user)
    return NextResponse.json({ invoices: home.invoices })
  } catch (e) {
    if (e instanceof MiniAppAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'Failed to load invoices'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
