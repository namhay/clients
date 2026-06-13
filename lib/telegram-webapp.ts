import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import type { ClientRow } from '@/lib/db/clients'
import { getClientByTelegramId } from '@/lib/db/clients'
import { getTelegramBotToken } from '@/lib/telegram-bot'

const INIT_DATA_MAX_AGE_SEC = 86400

export function getTelegramMiniAppUrl(path = '/telegram'): string {
  const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

export function buildInvoiceMiniAppReplyMarkup(invoiceId: string) {
  const base = getTelegramMiniAppUrl('/telegram')
  return {
    inline_keyboard: [[
      {
        text: '📱 View in App',
        web_app: { url: `${base}/invoices/${invoiceId}` },
      },
    ]],
  }
}

export type TelegramWebAppUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
}

export type TelegramMiniAppAuth = {
  user: TelegramWebAppUser
  client: ClientRow | null
}

function parseInitDataParams(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export async function validateInitData(initData: string): Promise<TelegramWebAppUser | null> {
  if (!initData?.trim()) return null

  const params = parseInitDataParams(initData)
  const hash = params.hash
  if (!hash) return null

  const checkParams = { ...params }
  delete checkParams.hash

  const dataCheckString = Object.keys(checkParams)
    .sort()
    .map(key => `${key}=${checkParams[key]}`)
    .join('\n')

  const token = await getTelegramBotToken()
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (calculatedHash.length !== hash.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(hash))) return null

  const authDate = Number(params.auth_date)
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE_SEC) return null

  if (!params.user) return null
  try {
    const user = JSON.parse(params.user) as TelegramWebAppUser
    if (!user?.id) return null
    return user
  } catch {
    return null
  }
}

export async function authenticateTelegramMiniApp(initData: string): Promise<TelegramMiniAppAuth | null> {
  const user = await validateInitData(initData)
  if (!user) return null

  const client = await getClientByTelegramId(String(user.id))
  return { user, client }
}

export function getInitDataFromRequest(req: NextRequest, body?: { initData?: unknown }): string {
  const header = req.headers.get('x-telegram-init-data')
  if (header?.trim()) return header.trim()

  const query = new URL(req.url).searchParams.get('initData')
  if (query?.trim()) return query.trim()

  if (typeof body?.initData === 'string' && body.initData.trim()) {
    return body.initData.trim()
  }

  return ''
}

export async function requireLinkedTelegramClient(initData: string): Promise<{
  user: TelegramWebAppUser
  client: ClientRow
}> {
  const auth = await authenticateTelegramMiniApp(initData)
  if (!auth) throw new MiniAppAuthError('Invalid or expired Telegram session')
  if (!auth.client) throw new MiniAppAuthError('Account not linked. Open your personal connect link in the bot and tap Start.')
  return { user: auth.user, client: auth.client }
}

export class MiniAppAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MiniAppAuthError'
  }
}
