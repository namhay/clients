import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getTelegramWebhookEndpoint,
  getTelegramWebhookInfo,
  getWebhookBaseUrl,
  isHttpsUrl,
  registerTelegramWebhook,
} from '@/lib/telegram-bot'

function webhookStatusPayload(info?: Awaited<ReturnType<typeof getTelegramWebhookInfo>>) {
  const expectedUrl = getTelegramWebhookEndpoint()
  const webhookBaseUrl = getWebhookBaseUrl()
  const canRegister = isHttpsUrl(expectedUrl)
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(webhookBaseUrl)

  return {
    webhookUrl: info?.url || null,
    expectedUrl,
    webhookBaseUrl,
    active: info?.url === expectedUrl,
    canRegister,
    isLocalhost,
    httpsRequired: !canRegister,
    pendingUpdates: info?.pending_update_count ?? 0,
    lastError: info?.last_error_message || null,
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const info = await getTelegramWebhookInfo()
    return NextResponse.json(webhookStatusPayload(info))
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to get webhook status'
    return NextResponse.json({ error: message, ...webhookStatusPayload() }, { status: 400 })
  }
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const webhookUrl = getTelegramWebhookEndpoint()
    await registerTelegramWebhook(webhookUrl)
    const info = await getTelegramWebhookInfo()
    return NextResponse.json({
      success: true,
      ...webhookStatusPayload(info),
      message: 'Webhook registered. Clients can now connect via their personal Telegram links.',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to register webhook'
    return NextResponse.json({ error: message, ...webhookStatusPayload() }, { status: 400 })
  }
}
