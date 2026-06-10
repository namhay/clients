import { formatAppDate } from '@/lib/app-date'

export async function sendTelegram(chatId: string, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { description?: string }).description || 'Telegram send failed')
  }
  return res.json()
}

export async function formatTelegramDate(date: Date | string) {
  return formatAppDate(date)
}

export async function sendTelegramDocument(
  chatId: string,
  pdf: Buffer,
  filename: string,
  caption?: string,
  parseMode?: 'HTML' | 'Markdown',
) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set')
  const url = `https://api.telegram.org/bot${token}/sendDocument`
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('document', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), filename)
  if (caption) form.append('caption', caption)
  if (parseMode) form.append('parse_mode', parseMode)

  const res = await fetch(url, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { description?: string }).description || 'Telegram document send failed')
  }
  return res.json()
}

export async function invoiceTelegramMessage(params: {
  clientName: string
  invoiceNo: string
  amount: number
  dueDate: string | Date
  companyName: string
  status?: string
  contactUsername?: string
}) {
  const status = (params.status || 'UNPAID').toUpperCase()
  const contact = params.contactUsername || process.env.TELEGRAM_CONTACT_USERNAME || 'itsmart099'
  const dueDate = await formatTelegramDate(params.dueDate)

  return `Dear ${params.clientName},

You have one ${status} invoice:

📄 Invoice ${params.invoiceNo}
👤 Client: ${params.clientName}
💰 Amount: $${params.amount.toFixed(2)} USD
📅 Due Date: ${dueDate}

Please arrange payment via bank transfer before the due date.

Any questions please contact @${contact.replace(/^@/, '')}

Thank you!`
}

export function paymentReceivedTelegramMessage(params: {
  clientName: string
  invoiceNo: string
  companyName: string
}) {
  return `Hello <b>${params.clientName}</b>,

We have received your payment for invoice ${params.invoiceNo}. Thank you!

— ${params.companyName}`
}

export async function reminderTelegramMessage(params: {
  clientName: string
  details: string
  dueDate: string | Date
  companyName: string
}) {
  const dueDate = await formatTelegramDate(params.dueDate)
  return `⚠️ <b>Reminder from ${params.companyName}</b>

Hello <b>${params.clientName}</b>,

This is a reminder: <b>${params.details}</b>
Expiry/Due: ${dueDate}

Please take action before the due date.`
}
