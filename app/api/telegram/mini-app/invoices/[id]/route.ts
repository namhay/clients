import { NextRequest, NextResponse } from 'next/server'
import { loadMiniAppInvoiceDetail } from '@/lib/telegram-mini-app-data'
import { getInitDataFromRequest, MiniAppAuthError, requireLinkedTelegramClient } from '@/lib/telegram-webapp'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const initData = getInitDataFromRequest(req)
    const { client } = await requireLinkedTelegramClient(initData)

    const invoice = await loadMiniAppInvoiceDetail(params.id, client.id)
    return NextResponse.json({ invoice })
  } catch (e) {
    if (e instanceof MiniAppAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'Failed to load invoice'
    const status = message === 'Invoice not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
