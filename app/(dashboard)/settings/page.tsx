'use client'
import { useEffect, useState } from 'react'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { DATE_FORMAT_OPTIONS } from '@/lib/date-format'
import { getJsonCache, setJsonCache } from '@/lib/list-cache'
import { APP_TIMEZONES } from '@/lib/reminder-schedule'
import { toast } from '@/lib/toast'
import { useCachedJson } from '@/lib/use-cached-json'

const SETTINGS_URL = '/api/settings'
const BRANDING_URL = '/api/settings/branding'

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
  const { data: settingsData, initialLoading: settingsLoading, refreshing: settingsRefreshing } =
    useCachedJson<Record<string, unknown>>(SETTINGS_URL)
  const { data: brandingData, initialLoading: brandingInitialLoading } =
    useCachedJson<{ assets: Array<{ key: string; label: string; url: string; hasCustom: boolean; updatedAt: string | null }> }>(BRANDING_URL)
  const [form, setForm] = useState(() => {
    const cached = getJsonCache<Record<string, unknown>>(SETTINGS_URL)
    if (!cached) return emptyForm()
    return {
      companyName: String(cached.companyName || ''),
      companyAddress: String(cached.companyAddress || ''),
      companyEmail: String(cached.companyEmail || ''),
      companyPhone: String(cached.companyPhone || ''),
      invoicePrefix: String(cached.invoicePrefix || 'INV-'),
      invoiceStartNumber: String(cached.invoiceStartNumber ?? 1),
      dateFormat: String(cached.dateFormat || 'DD_MMM_YYYY'),
      reminderDays: String(cached.reminderDays ?? 7),
      reminderTime: String(cached.reminderTime || '09:00'),
      reminderTimezone: String(cached.reminderTimezone || 'Asia/Phnom_Penh'),
      lastReminderRunDate: String(cached.lastReminderRunDate || ''),
      smtpHost: String(cached.smtpHost || ''),
      smtpPort: String(cached.smtpPort ?? 465),
      smtpSecure: cached.smtpSecure !== false,
      smtpUser: String(cached.smtpUser || ''),
      smtpPass: String(cached.smtpPass || ''),
      smtpFrom: String(cached.smtpFrom || ''),
      telegramBotToken: String(cached.telegramBotToken || ''),
      telegramDefaultChatId: String(cached.telegramDefaultChatId || ''),
    }
  })
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
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
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [brandingAssets, setBrandingAssets] = useState(() => {
    const cached = getJsonCache<{ assets: Array<{ key: string; label: string; url: string; hasCustom: boolean; updatedAt: string | null }> }>(BRANDING_URL)
    return cached?.assets ?? []
  })
  const [brandingUploading, setBrandingUploading] = useState<string | null>(null)
  const [brandingMessage, setBrandingMessage] = useState('')
  const [brandingError, setBrandingError] = useState('')

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

  const uploadBranding = async (key: string, file: File) => {
    setBrandingUploading(key)
    setBrandingError('')
    setBrandingMessage('')
    try {
      const formData = new FormData()
      formData.append('asset', key)
      formData.append('file', file)
      const res = await fetch('/api/settings/branding', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBrandingError(data.error || 'Upload failed')
        return
      }
      const assets = data.assets || []
      setBrandingAssets(assets)
      setJsonCache(BRANDING_URL, { assets })
      setBrandingMessage('Branding image updated')
      setTimeout(() => setBrandingMessage(''), 3000)
    } catch {
      setBrandingError('Upload failed')
    } finally {
      setBrandingUploading(null)
    }
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
    if (settingsData) applySettings(settingsData)
  }, [settingsData])

  useEffect(() => {
    if (brandingData?.assets) setBrandingAssets(brandingData.assets)
  }, [brandingData])

  useEffect(() => {
    if (!settingsLoading && !settingsData) {
      setError('Could not load settings — values from .env may still save')
    }
  }, [settingsLoading, settingsData])

  useEffect(() => {
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

  const changePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      return toast.error('Enter your current and new password')
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('New passwords do not match')
    }
    setPasswordSaving(true)
    setPasswordError('')
    setPasswordMessage('')
    try {
      const res = await fetch('/api/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPasswordError(result.error || 'Failed to update password')
        return
      }
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordMessage('Password updated successfully')
      setTimeout(() => setPasswordMessage(''), 3000)
    } catch {
      setPasswordError('Failed to update password')
    } finally {
      setPasswordSaving(false)
    }
  }

  const save = async () => {
    if (!form.companyName.trim()) return toast.error('Company name is required')
    setSaving(true)
    setError('')
    setSavedMessage('')
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
      setJsonCache(SETTINGS_URL, result)
      await reloadSettings()
      const savedTo = Array.isArray(result.savedTo) ? result.savedTo : ['database']
      const message = savedTo.includes('env')
        ? '✓ Saved to database and .env!'
        : '✓ Saved to database!'
      setSavedMessage(message)
      setTimeout(() => setSavedMessage(''), 3000)
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (settingsLoading) {
    return <div className="page-content text-gray-500 dark:text-gray-400">Loading settings...</div>
  }

  return (
    <div className={`page-content${settingsRefreshing ? ' opacity-60' : ''}`}>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Branding Assets</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Upload logo, stamp, and payment QR code. When KHQR is configured in environment variables, invoices use a dynamic QR with the outstanding balance instead of the static QR image.
          </p>
          {brandingInitialLoading && brandingAssets.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading assets...</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {brandingAssets.map(asset => (
                <div key={asset.key} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <img
                      src={asset.url}
                      alt={asset.label}
                      className="max-h-20 max-w-full object-contain"
                    />
                  </div>
                  <div className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">{asset.label}</div>
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    {asset.hasCustom ? 'Custom upload' : 'Default from public folder'}
                    {asset.updatedAt && (
                      <> · Updated {new Date(asset.updatedAt).toLocaleString()}</>
                    )}
                  </p>
                  <label className="btn-secondary inline-flex cursor-pointer text-xs">
                    {brandingUploading === asset.key ? 'Uploading...' : 'Replace image'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                      className="hidden"
                      disabled={brandingUploading !== null}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadBranding(asset.key, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
          {(brandingMessage || brandingError) && (
            <p className={`mt-3 text-sm ${brandingError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {brandingError || brandingMessage}
            </p>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Company Information</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Saved to database (local dev also updates .env)</p>
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
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Minimum sequence number. Next invoice uses highest existing number + 1, or this if higher.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">SMTP Email (cPanel)</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Saved to database (local dev also updates .env)</p>
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Saved to database (local dev also updates .env). Get a token from @BotFather.</p>
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
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Schedule &amp; Time Zone</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Automatic reminder alerts are disabled. These settings still control invoice auto-generation timing, dates, PDFs, emails, and Telegram.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </div>
              <div>
                <label className="label">Global time zone</label>
                <select
                  className="input"
                  value={form.reminderTimezone}
                  onChange={e => setForm(f => ({ ...f, reminderTimezone: e.target.value }))}
                >
                  {APP_TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Used for dates, times, reminders, PDFs, emails, and Telegram. Default: Cambodia (Asia/Phnom_Penh).
            </p>
            <div>
              <label className="label">Reminder time</label>
              <input
                type="time"
                className="input max-w-xs"
                value={form.reminderTime}
                onChange={e => setForm(f => ({ ...f, reminderTime: e.target.value }))}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Daily at this time in your global time zone ({form.reminderTimezone}). e.g. 12:30 for 12:30 PM.
              </p>
            </div>
          </div>
        </div>
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Account Security</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Change your admin login password</p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="label">Current password</label>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={changePassword} disabled={passwordSaving}>
                {passwordSaving ? 'Updating...' : 'Change Password'}
              </button>
              {passwordMessage && <span className="text-green-600 dark:text-green-400 text-sm">{passwordMessage}</span>}
              {passwordError && <span className="text-red-600 dark:text-red-400 text-sm">{passwordError}</span>}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
              Forgot your password? Run <span className="font-mono">npm run db:seed-admin</span> with <span className="font-mono">ADMIN_EMAIL</span> and <span className="font-mono">ADMIN_PASSWORD</span> set to reset the admin account.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {savedMessage && <span className="text-green-600 dark:text-green-400 text-sm">{savedMessage}</span>}
        {error && <span className="text-red-600 dark:text-red-400 text-sm">{error}</span>}
      </div>
    </div>
  )
}
