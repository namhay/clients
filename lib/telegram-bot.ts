import { prisma } from '@/lib/prisma'
import { getAppSettings } from '@/lib/settings'

export type TelegramUpdate = {
  update_id?: number
  message?: {
    message_id?: number
    text?: string
    chat?: { id: number | string; type?: string }
    from?: { id: number; first_name?: string; username?: string }
  }
}

let cachedBotUsername: string | null = null

export async function getTelegramBotToken(): Promise<string> {
  const settings = await getAppSettings()
  const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || ''
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')
  return token
}

export async function getTelegramBotUsername(): Promise<string> {
  if (process.env.TELEGRAM_BOT_USERNAME) {
    return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, '')
  }
  if (cachedBotUsername) return cachedBotUsername

  const token = await getTelegramBotToken()
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.description || 'Failed to get bot info')
  cachedBotUsername = data.result.username as string
  return cachedBotUsername
}

export function getTelegramWebhookSecret(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || ''
}

export function getAppBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return url.replace(/\/$/, '')
}

/** Public HTTPS base URL for Telegram webhook (override with TELEGRAM_WEBHOOK_URL for ngrok). */
export function getWebhookBaseUrl(): string {
  const url = process.env.TELEGRAM_WEBHOOK_URL || getAppBaseUrl()
  return url.replace(/\/$/, '')
}

export function getTelegramWebhookEndpoint(): string {
  return `${getWebhookBaseUrl()}/api/telegram/webhook`
}

export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function assertWebhookUrlAllowed(webhookUrl: string) {
  if (!isHttpsUrl(webhookUrl)) {
    const base = getWebhookBaseUrl()
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(base)
    if (isLocal) {
      throw new Error(
        'Telegram requires a public HTTPS URL. localhost will not work. '
        + 'Register the webhook on your production server, or set TELEGRAM_WEBHOOK_URL in .env to your ngrok HTTPS URL (e.g. https://abc123.ngrok-free.app), restart the app, then click Register Webhook again.',
      )
    }
    throw new Error(
      'Telegram requires an HTTPS webhook URL. Set NEXTAUTH_URL or TELEGRAM_WEBHOOK_URL to your public https:// domain.',
    )
  }
}

export async function buildClientConnectLink(clientId: string): Promise<string> {
  const username = await getTelegramBotUsername()
  return `https://t.me/${username}?start=${encodeURIComponent(clientId)}`
}

export function parseStartPayload(text: string): string | null {
  const match = text.trim().match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i)
  const payload = match?.[1]?.trim()
  return payload || null
}

export async function linkClientTelegramChat(clientId: string, chatId: string | number) {
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) throw new Error('Client not found')

  const chatIdStr = String(chatId)
  await prisma.$transaction([
    prisma.client.updateMany({
      where: { telegramId: chatIdStr, id: { not: clientId } },
      data: { telegramId: null },
    }),
    prisma.client.update({
      where: { id: clientId },
      data: { telegramId: chatIdStr },
    }),
  ])

  return prisma.client.findUnique({ where: { id: clientId } })
}

export async function sendBotMessage(chatId: string | number, text: string) {
  const token = await getTelegramBotToken()
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { description?: string }).description || 'Telegram send failed')
  }
  return res.json()
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message
  if (!message?.text || !message.chat?.id) return

  const text = message.text.trim()
  if (!text.startsWith('/start')) return

  const settings = await getAppSettings()
  const companyName = settings.companyName || 'ClientDesk'
  const chatId = message.chat.id
  const payload = parseStartPayload(text)

  if (!payload) {
    await sendBotMessage(
      chatId,
      `Welcome to ${companyName} billing bot!\n\nTo connect your account, open the personal link from your account manager and tap Start.`,
    )
    return
  }

  try {
    const client = await linkClientTelegramChat(payload, chatId)
    await sendBotMessage(
      chatId,
      `✅ Connected to ${companyName}!\n\nHello ${client?.name}, you will now receive invoices and payment reminders here on Telegram.`,
    )
    await prisma.reminderLog.create({
      data: {
        clientId: payload,
        type: 'Telegram connected',
        channel: 'Telegram',
        message: `Chat ID ${chatId} linked via /start`,
        status: 'sent',
      },
    })
  } catch {
    await sendBotMessage(
      chatId,
      `Sorry, we could not link your account. The link may be invalid or expired.\n\nPlease contact ${companyName} for a new connection link.`,
    )
  }
}

export async function registerTelegramWebhook(webhookUrl: string) {
  assertWebhookUrlAllowed(webhookUrl)
  const token = await getTelegramBotToken()
  const secret = getTelegramWebhookSecret()
  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  }
  if (secret) body.secret_token = secret

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.description || 'Failed to set webhook')
  return data.result
}

export async function getTelegramWebhookInfo() {
  const token = await getTelegramBotToken()
  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.description || 'Failed to get webhook info')
  return data.result as {
    url?: string
    has_custom_certificate?: boolean
    pending_update_count?: number
    last_error_date?: number
    last_error_message?: string
  }
}
