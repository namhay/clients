/**
 * Register Telegram webhook for ClientDesk bot.
 * Usage: node scripts/setup-telegram-webhook.js
 * Requires: TELEGRAM_BOT_TOKEN, NEXTAUTH_URL (or NEXT_PUBLIC_APP_URL)
 * Optional: TELEGRAM_WEBHOOK_SECRET
 */
const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required')
  process.exit(1)
}

const baseUrl = (process.env.TELEGRAM_WEBHOOK_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
if (!baseUrl) {
  console.error('TELEGRAM_WEBHOOK_URL, NEXTAUTH_URL, or NEXT_PUBLIC_APP_URL is required')
  process.exit(1)
}

const webhookUrl = `${baseUrl}/api/telegram/webhook`
if (!webhookUrl.startsWith('https://')) {
  console.error('Telegram requires HTTPS. localhost will not work.')
  console.error('Use production URL or set TELEGRAM_WEBHOOK_URL to your ngrok https URL.')
  process.exit(1)
}
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''

async function main() {
  const body = {
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
  if (!data.ok) {
    console.error('Failed:', data.description)
    process.exit(1)
  }
  console.log('✅ Webhook registered:', webhookUrl)
  if (secret) console.log('   Secret token enabled')
}

main().catch(err => { console.error(err); process.exit(1) })
