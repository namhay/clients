import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendInvoiceTelegram } from '@/lib/invoices'
import { sendTelegram, reminderTelegramMessage } from '@/lib/telegram'
import { getAppSettings } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clientId, type, invoiceId, serviceId } = await req.json()
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const settings = await getAppSettings()
  const chatId = client.telegramId || settings.telegramDefaultChatId || process.env.TELEGRAM_DEFAULT_CHAT_ID || ''
  if (!chatId) return NextResponse.json({ error: 'No Telegram chat ID' }, { status: 400 })
  const { companyName } = settings
  let message = ''
  if (type === 'invoice' && invoiceId) {
    await sendInvoiceTelegram(invoiceId, clientId, chatId)
    return NextResponse.json({ success: true, pdf: true })
  } else {
    const details = serviceId
      ? (await prisma.service.findUnique({ where: { id: serviceId } }))?.name || 'Service'
      : 'Payment reminder'
    message = reminderTelegramMessage({
      clientName: client.name, details, dueDate: new Date().toISOString().split('T')[0], companyName,
    })
  }
  await sendTelegram(chatId, message)
  await prisma.reminderLog.create({
    data: { clientId, type: 'Reminder', channel: 'Telegram', message, status: 'sent' },
  })
  return NextResponse.json({ success: true })
}

