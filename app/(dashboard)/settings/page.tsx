'use client'
import { useEffect, useState } from 'react'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { DATE_FORMAT_OPTIONS } from '@/lib/date-format'
import { REMINDER_TIMEZONES, reminderTimeToUtcCron } from '@/lib/reminder-schedule'

const emptyForm = () => ({
  companyName: '',
  companyAddress: '',
  companyEmail: '',
  companyPhone: '',
  invoicePrefix: 'INV-',
  invoiceStartNumber: '1',
  dateFormat: 'DD_MMM_YYYY',
  reminderDays: '7',
  reminderTime: '09:00',
  reminderTimezone: 'Asia/Phnom_Penh',
  lastReminderRunDate: '',
  smtpHost: '',
  smtpPort: '465',
  smtpSecure: true,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  telegramBotToken: '',
  telegramDefaultChatId: '',
})

export default function SettingsPage() {
  const { reloadSettings } = useAppSettings()
  const [form, setForm] = useState(emptyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [webhookStatus, setWebhookStatus] = useState<{
    webhookUrl: string | null
    expectedUrl: string
    webhookBaseUrl: string
    active: boolean
    canRegister: boolean
    isLocalhost: boolean
    httpsRequired: boolean
    pendingUpdates: number
    lastError: string | null
  } | null>(null)
  const [webhookLoading, setWebhookLoading] = useState(false)
  const [webhookMessage, setWebhookMessage] = useState('')

  const applySettings = (data: Record<string, unknown>) => {
    setForm({
      companyName: String(data.companyName || ''),
      companyAddress: String(data.companyAddress || ''),
      companyEmail: String(data.companyEmail || ''),
      companyPhone: String(data.companyPhone || ''),
      invoicePrefix: String(data.invoicePrefix || 'INV-'),
      invoiceStartNumber: String(data.invoiceStartNumber ?? 1),
      dateFormat: String(data.dateFormat || 'DD_MMM_YYYY'),
      reminderDays: String(data.reminderDays ?? 7),
      reminderTime: String(data.reminderTime || '09:00'),
      reminderTimezone: String(data.reminderTimezone || 'Asia/Phnom_Penh'),
      lastReminderRunDate: String(data.lastReminderRunDate || ''),
      smtpHost: String(data.smtpHost || ''),
      smtpPort: String(data.smtpPort ?? 465),
      smtpSecure: data.smtpSecure !== false,
      smtpUser: String(data.smtpUser || ''),
      smtpPass: String(data.smtpPass || ''),
      smtpFrom: String(data.smtpFrom || ''),
      telegramBotToken: String(data.telegramBotToken || ''),
      telegramDefaultChatId: String(data.telegramDefaultChatId || ''),
    })
  }

  const loadWebhookStatus = () => {
    fetch('/api/telegram/setup-webhook')
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (res.ok) setWebhookStatus(data)
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetch('/api/settings')
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (!res.ok || !data || data.error) throw new Error(data?.error || 'Failed to load')
        applySettings(data)
      })
      .catch(() => setError('Could not load settings — values from .env may still save'))
      .finally(() => setLoading(false))
    loadWebhookStatus()
  }, [])

  const registerWebhook = async () => {
    setWebhookLoading(true)
    setWebhookMessage('')
    try {
      const res = await fetch('/api/telegram/setup-webhook', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWebhookMessage(data.error || 'Failed to register webhook')
        if (data.expectedUrl) setWebhookStatus(data)
        return
      }
      setWebhookMessage(data.message || 'Webhook registered')
      loadWebhookStatus()
    } catch {
      setWebhookMessage('Failed to register webhook')
    } finally {
      setWebhookLoading(false)
    }
  }

  const save = async () => {
    if (!form.companyName.trim()) return alert('Company name is required')
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          invoiceStartNumber: parseInt(form.invoiceStartNumber) || 1,
          reminderDays: parseInt(form.reminderDays) || 7,
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(result.error || 'Failed to save settings')
        return
      }
      applySettings(result)
      await reloadSettings()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500 dark:text-gray-400">Loading settings...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Company Information</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Saved to database and your .env file</p>
          <div className="space-y-3">
            <div>
              <label className="label">Company Name *</label>
              <input className="input" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Your Company Ltd." />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={form.companyAddress} onChange={e => setForm(f => ({ ...f, companyAddress: e.target.value }))} placeholder="Phnom Penh, Cambodia" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.companyEmail} onChange={e => setForm(f => ({ ...f, companyEmail: e.target.value }))} placeholder="info@yourdomain.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.companyPhone} onChange={e => setForm(f => ({ ...f, companyPhone: e.target.value }))} placeholder="+855 12 345 678" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Invoice Prefix</label>
                <input className="input" value={form.invoicePrefix} onChange={e => setForm(f => ({ ...f, invoicePrefix: e.target.value }))} placeholder="INV-" />
              </div>
              <div>
                <label className="label">Invoice start from</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={form.invoiceStartNumber}
                  onChange={e => setForm(f => ({ ...f, invoiceStartNumber: e.target.value }))}
                  placeholder="50"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">e.g. 50 → first invoice is INV-0050</p>
              </div>
            </div>
            <div>
              <label className="label">Date format</label>
              <select
                className="input"
                value={form.dateFormat}
                onChange={e => setForm(f => ({ ...f, dateFormat: e.target.value }))}
              >
                {DATE_FORMAT_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Used across the app, PDFs, emails, and Telegram</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">SMTP Email (cPanel)</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Saved to database and your .env file</p>
          <div className="space-y-3">
            <div>
              <label className="label">SMTP Host</label>
              <input className="input" value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))} placeholder="mail.yourdomain.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Port</label>
                <input type="number" className="input" value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: e.target.value }))} placeholder="465" />
              </div>
              <div>
                <label className="label">SSL / TLS</label>
                <select className="input" value={form.smtpSecure ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, smtpSecure: e.target.value === 'true' }))}>
                  <option value="true">Secure (465)</option>
                  <option value="false">STARTTLS (587)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Email / Username</label>
              <input type="email" className="input" value={form.smtpUser} onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))} placeholder="noreply@yourdomain.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.smtpPass} onChange={e => setForm(f => ({ ...f, smtpPass: e.target.value }))} placeholder="Leave unchanged if masked" />
            </div>
            <div>
              <label className="label">From Name / Address</label>
              <input className="input" value={form.smtpFrom} onChange={e => setForm(f => ({ ...f, smtpFrom: e.target.value }))} placeholder="Company Name &lt;noreply@yourdomain.com&gt;" />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Telegram Bot</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Saved to database and your .env file. Get a token from @BotFather.</p>
          <div className="space-y-3">
            <div>
              <label className="label">Bot Token</label>
              <input type="password" className="input" value={form.telegramBotToken} onChange={e => setForm(f => ({ ...f, telegramBotToken: e.target.value }))} placeholder="1234567890:AAB... (leave masked to keep)" />
            </div>
            <div>
              <label className="label">Default Chat ID</label>
              <input className="input" value={form.telegramDefaultChatId} onChange={e => setForm(f => ({ ...f, telegramDefaultChatId: e.target.value }))} placeholder="-100123456789" />
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-1">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Client connect links</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Register the webhook once so clients can connect via <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">t.me/your_bot?start=CLIENT_ID</code>.
                Telegram only accepts <strong>public HTTPS</strong> URLs — not localhost.
              </p>
              {webhookStatus?.httpsRequired && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 space-y-2">
                  <p className="font-medium">Cannot register on localhost</p>
                  <p>Choose one option:</p>
                  <ol className="list-decimal list-inside space-y-1 text-amber-900">
                    <li><strong>Production (recommended):</strong> deploy ClientDesk, set <code className="bg-amber-100 px-1 rounded">NEXTAUTH_URL=https://your-domain.com</code>, then click Register Webhook on the live site.</li>
                    <li><strong>Local testing:</strong> run <code className="bg-amber-100 px-1 rounded">ngrok http 3000</code>, add <code className="bg-amber-100 px-1 rounded">TELEGRAM_WEBHOOK_URL=https://YOUR-ID.ngrok-free.app</code> to .env, restart <code className="bg-amber-100 px-1 rounded">npm run dev</code>, then register again.</li>
                  </ol>
                </div>
              )}
              {webhookStatus && (
                <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-3 space-y-1">
                  <div>Base URL: <span className="font-mono">{webhookStatus.webhookBaseUrl}</span></div>
                  <div>Webhook: <span className="font-mono">{webhookStatus.expectedUrl}</span></div>
                  <div>Active: {webhookStatus.active ? 'Yes' : 'No'}</div>
                  {webhookStatus.webhookUrl && webhookStatus.webhookUrl !== webhookStatus.expectedUrl && (
                    <div>Current: <span className="font-mono">{webhookStatus.webhookUrl}</span></div>
                  )}
                  {webhookStatus.lastError && <div className="text-red-600 dark:text-red-400">Error: {webhookStatus.lastError}</div>}
                </div>
              )}
              <button
                className="btn-secondary text-xs"
                onClick={registerWebhook}
                disabled={webhookLoading || webhookStatus?.httpsRequired}
              >
                {webhookLoading ? 'Registering...' : 'Register Webhook'}
              </button>
              {webhookMessage && (
                <p className={`text-xs mt-2 ${webhookMessage.includes('registered') || webhookMessage.includes('Registered') ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>
                  {webhookMessage}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Automated Reminders</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Alerts are sent once per day at your reminder time. On Vercel Hobby, the cron job may only run once daily — update <span className="font-mono">vercel.json</span> if you change the time below.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Reminder time</label>
                <input
                  type="time"
                  className="input"
                  value={form.reminderTime}
                  onChange={e => setForm(f => ({ ...f, reminderTime: e.target.value }))}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">e.g. 12:30 for 12:30 PM</p>
              </div>
              <div>
                <label className="label">Timezone</label>
                <select
                  className="input"
                  value={form.reminderTimezone}
                  onChange={e => setForm(f => ({ ...f, reminderTimezone: e.target.value }))}
                >
                  {REMINDER_TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Default reminder days (new product types)</label>
              <input type="number" min="1" className="input max-w-xs" value={form.reminderDays} onChange={e => setForm(f => ({ ...f, reminderDays: e.target.value }))} />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Per-type timing is set under Product Types → Edit (e.g. Domain 14 days, WiFi 1 day).</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <div>Vercel cron (UTC): <span className="font-mono font-medium">{reminderTimeToUtcCron(form.reminderTime, form.reminderTimezone)}</span></div>
              <div>Cron endpoint: <span className="font-mono">GET /api/cron/reminders</span></div>
              <div>Set <span className="font-mono">CRON_SECRET</span> in .env / Vercel (Vercel Cron sends it automatically).</div>
              {form.lastReminderRunDate && (
                <div>Last auto-run: <span className="font-medium">{form.lastReminderRunDate}</span></div>
              )}
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Database & Deployment</h2>
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 font-mono text-xs">DATABASE_URL=postgresql://...@neon.tech/neondb</div>
            <p className="text-gray-500 dark:text-gray-400">Neon PostgreSQL — set DATABASE_URL in .env (local) or Vercel env vars (production).</p>
            <div className="pt-2 space-y-1">
              <p className="font-medium text-gray-700 dark:text-gray-300">Quick commands:</p>
              <div className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono space-y-1">
                <div>npm install</div>
                <div>npm run db:migrate</div>
                <div>npm run db:setup</div>
                <div>npm run build</div>
                <div>pm2 start npm --name clientdesk -- start</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-green-600 dark:text-green-400 text-sm">✓ Saved to database and .env!</span>}
        {error && <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>}
      </div>
    </div>
  )
}
