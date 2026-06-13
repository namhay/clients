import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceById } from '@/lib/db/invoices'
import { getInvoicePaymentSummary, recordInvoicePayment } from '@/lib/invoice-payments'
import { createReminderLog } from '@/lib/db/reminder-logs'
import { getAppSettings } from '@/lib/settings'
import { sendTelegram } from '@/lib/telegram'
import { loadMiniAppInvoiceDetail } from '@/lib/telegram-mini-app-data'
import { getInitDataFromRequest, MiniAppAuthError, requireLinkedTelegramClient } from '@/lib/telegram-webapp'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const initData = getInitDataFromRequest(req, body)
    const { client, user } = await requireLinkedTelegramClient(initData)

    const invoice = await getInvoiceById(params.id)
    if (!invoice || invoice.clientId !== client.id) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const status = invoice.status.toUpperCase()
    if (status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
    }
    if (status === 'CANCELLED') {
      return NextResponse.json({ error: 'Invoice is cancelled' }, { status: 400 })
    }

    const summary = await getInvoicePaymentSummary(params.id)
    if (summary.remaining <= 0) {
      return NextResponse.json({ error: 'Invoice is already fully paid' }, { status: 400 })
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
    const result = await recordInvoicePayment(params.id, {
      amount: summary.remaining,
      paymentMethod: 'BANK_TRANSFER',
      paidAt: new Date(),
      telegramAlert: true,
      emailAlert: true,
    })

    await createReminderLog({
      clientId: client.id,
      type: `Payment claimed — ${invoice.invoiceNo}`,
      channel: 'Telegram Mini App',
      message: note
        ? `Client ${client.name} marked ${invoice.invoiceNo} as paid via Mini App. Note: ${note}`
        : `Client ${client.name} marked ${invoice.invoiceNo} as paid via Mini App (@${user.username || user.id}).`,
      status: 'sent',
    })

    const settings = await getAppSettings()
    const adminChatId = settings.telegramDefaultChatId || process.env.TELEGRAM_DEFAULT_CHAT_ID || ''
    if (adminChatId) {
      const adminMessage = [
        `💰 <b>Payment claimed via Mini App</b>`,
        ``,
        `Client: <b>${client.name}</b>`,
        `Invoice: <b>${invoice.invoiceNo}</b>`,
        `Amount: <b>$${summary.remaining.toFixed(2)}</b>`,
        note ? `Note: ${note}` : '',
      ].filter(Boolean).join('\n')

      try {
        await sendTelegram(adminChatId, adminMessage)
      } catch {
        // Admin alert is best-effort
      }
    }

    const serialized = await loadMiniAppInvoiceDetail(params.id, client.id)

    return NextResponse.json({
      success: true,
      fullyPaid: result.fullyPaid,
      invoice: serialized,
    })
  } catch (e) {
    if (e instanceof MiniAppAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 })
    }
    const message = e instanceof Error ? e.message : 'Failed to mark invoice as paid'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
