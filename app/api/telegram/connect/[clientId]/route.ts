import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClientById } from '@/lib/db/clients'
import { buildClientConnectLink, getTelegramBotUsername } from '@/lib/telegram-bot'

export async function GET(_: NextRequest, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getClientById(params.clientId)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  try {
    const [link, botUsername] = await Promise.all([
      buildClientConnectLink(client.id),
      getTelegramBotUsername(),
    ])
    return NextResponse.json({
      link,
      botUsername,
      connected: Boolean(client.telegramId),
      telegramId: client.telegramId,
      clientName: client.name,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Telegram bot not configured'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
