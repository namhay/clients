import { createSettings, getSettings, upsertSettings } from '@/lib/db/settings'
import { readEnvDefaults, updateEnvFile } from '@/lib/env-file'
import { parseReminderTime, parseReminderTimezone } from '@/lib/reminder-schedule'

export type AppSettingsData = {
  companyName: string
  companyAddress: string
  companyEmail: string
  companyPhone: string
  invoicePrefix: string
  reminderDays: number
  reminderTime: string
  reminderTimezone: string
  lastReminderRunDate: string | null
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  telegramBotToken: string
  telegramDefaultChatId: string
}

const MASK = '••••••••'

function envDefaults(): AppSettingsData {
  const env = readEnvDefaults()
  return {
    companyName: env.COMPANY_NAME || 'Your Company Ltd.',
    companyAddress: env.COMPANY_ADDRESS || '',
    companyEmail: env.COMPANY_EMAIL || '',
    companyPhone: env.COMPANY_PHONE || '',
    invoicePrefix: env.INVOICE_PREFIX || 'INV-',
    reminderDays: 7,
    reminderTime: '09:00',
    reminderTimezone: 'Asia/Phnom_Penh',
    lastReminderRunDate: null,
    smtpHost: env.SMTP_HOST || '',
    smtpPort: parseInt(env.SMTP_PORT) || 465,
    smtpSecure: env.SMTP_SECURE !== 'false',
    smtpUser: env.SMTP_USER || '',
    smtpPass: env.SMTP_PASS || '',
    smtpFrom: env.SMTP_FROM || '',
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || '',
    telegramDefaultChatId: env.TELEGRAM_DEFAULT_CHAT_ID || '',
  }
}

function mergeFromEnv(data: AppSettingsData): AppSettingsData {
  const env = envDefaults()
  return {
    companyName: data.companyName || env.companyName,
    companyAddress: data.companyAddress || env.companyAddress,
    companyEmail: data.companyEmail || env.companyEmail,
    companyPhone: data.companyPhone || env.companyPhone,
    invoicePrefix: data.invoicePrefix || env.invoicePrefix,
    reminderDays: data.reminderDays || env.reminderDays,
    reminderTime: data.reminderTime || env.reminderTime,
    reminderTimezone: data.reminderTimezone || env.reminderTimezone,
    lastReminderRunDate: data.lastReminderRunDate ?? env.lastReminderRunDate,
    smtpHost: data.smtpHost || env.smtpHost,
    smtpPort: data.smtpPort || env.smtpPort,
    smtpSecure: data.smtpHost ? data.smtpSecure : env.smtpSecure,
    smtpUser: data.smtpUser || env.smtpUser,
    smtpPass: data.smtpPass || env.smtpPass,
    smtpFrom: data.smtpFrom || env.smtpFrom,
    telegramBotToken: data.telegramBotToken || env.telegramBotToken,
    telegramDefaultChatId: data.telegramDefaultChatId || env.telegramDefaultChatId,
  }
}

function keepSecret(input: string, existing: string) {
  return input && input !== MASK ? input : existing
}

export function parseSettingsInput(
  body: Record<string, unknown>,
  existing?: AppSettingsData,
): AppSettingsData {
  const companyName = String(body.companyName || '').trim()
  if (!companyName) throw new Error('Company name is required')

  const invoicePrefix = String(body.invoicePrefix || 'INV-').trim()
  if (!invoicePrefix) throw new Error('Invoice prefix is required')

  const base = existing || envDefaults()

  return {
    companyName,
    companyAddress: String(body.companyAddress || '').trim(),
    companyEmail: String(body.companyEmail || '').trim(),
    companyPhone: String(body.companyPhone || '').trim(),
    invoicePrefix,
    reminderDays: Math.max(1, parseInt(String(body.reminderDays)) || 7),
    reminderTime: parseReminderTime(body.reminderTime, base.reminderTime),
    reminderTimezone: parseReminderTimezone(body.reminderTimezone, base.reminderTimezone),
    lastReminderRunDate: base.lastReminderRunDate ?? null,
    smtpHost: String(body.smtpHost || '').trim(),
    smtpPort: parseInt(String(body.smtpPort)) || 465,
    smtpSecure: body.smtpSecure !== false && body.smtpSecure !== 'false',
    smtpUser: String(body.smtpUser || '').trim(),
    smtpPass: keepSecret(String(body.smtpPass ?? ''), base.smtpPass),
    smtpFrom: String(body.smtpFrom || '').trim(),
    telegramBotToken: keepSecret(String(body.telegramBotToken ?? ''), base.telegramBotToken),
    telegramDefaultChatId: String(body.telegramDefaultChatId || '').trim(),
  }
}

function toEnvUpdates(data: AppSettingsData) {
  return {
    COMPANY_NAME: data.companyName,
    COMPANY_ADDRESS: data.companyAddress,
    COMPANY_EMAIL: data.companyEmail,
    COMPANY_PHONE: data.companyPhone,
    INVOICE_PREFIX: data.invoicePrefix,
    SMTP_HOST: data.smtpHost,
    SMTP_PORT: String(data.smtpPort),
    SMTP_SECURE: data.smtpSecure ? 'true' : 'false',
    SMTP_USER: data.smtpUser,
    SMTP_PASS: data.smtpPass,
    SMTP_FROM: data.smtpFrom,
    TELEGRAM_BOT_TOKEN: data.telegramBotToken,
    TELEGRAM_DEFAULT_CHAT_ID: data.telegramDefaultChatId,
  }
}

export async function getAppSettings(): Promise<AppSettingsData> {
  const defaults = envDefaults()

  try {
    const settings = await getSettings()
    if (settings) return mergeFromEnv(settings)
    await createSettings(defaults)
  } catch {
    // use env defaults
  }
  return defaults
}

export async function saveAppSettings(data: AppSettingsData): Promise<AppSettingsData> {
  updateEnvFile(toEnvUpdates(data))

  try {
    await upsertSettings(data)
  } catch {
    // .env saved successfully
  }

  return data
}

export function toPublicSettings(data: AppSettingsData) {
  return {
    ...data,
    smtpPass: data.smtpPass ? MASK : '',
    smtpPasswordSet: Boolean(data.smtpPass),
    telegramBotToken: data.telegramBotToken ? MASK : '',
    telegramTokenSet: Boolean(data.telegramBotToken),
  }
}
