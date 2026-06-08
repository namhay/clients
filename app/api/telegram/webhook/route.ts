import { NextRequest, NextResponse } from 'next/server'
import { handleTelegramUpdate, getTelegramWebhookSecret, type TelegramUpdate } from '@/lib/telegram-bot'

export async function POST(req: NextRequest) {
  const secret = getTelegramWebhookSecret()
  if (secret) {
    const header = req.headers.get('x-telegram-bot-api-secret-token')
    if (header !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const update = (await req.json()) as TelegramUpdate
    await handleTelegramUpdate(update)
  } catch (e) {
    console.error('Telegram webhook error:', e)
  }

  return NextResponse.json({ ok: true })
}
