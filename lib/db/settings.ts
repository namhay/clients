import { getSql } from '@/lib/db'
import type { AppSettingsData } from '@/lib/settings'

export type AppSettingsRow = AppSettingsData & {
  id: string
  updatedAt: Date
}

function mapSettings(row: Record<string, unknown>): AppSettingsRow {
  return {
    id: String(row.id),
    companyName: String(row.companyName),
    companyAddress: String(row.companyAddress ?? ''),
    companyEmail: String(row.companyEmail ?? ''),
    companyPhone: String(row.companyPhone ?? ''),
    invoicePrefix: String(row.invoicePrefix ?? 'INV-'),
    reminderDays: Number(row.reminderDays ?? 7),
    reminderTime: String(row.reminderTime ?? '09:00'),
    reminderTimezone: String(row.reminderTimezone ?? 'Asia/Phnom_Penh'),
    lastReminderRunDate: row.lastReminderRunDate != null ? String(row.lastReminderRunDate) : null,
    smtpHost: String(row.smtpHost ?? ''),
    smtpPort: Number(row.smtpPort ?? 465),
    smtpSecure: Boolean(row.smtpSecure),
    smtpUser: String(row.smtpUser ?? ''),
    smtpPass: String(row.smtpPass ?? ''),
    smtpFrom: String(row.smtpFrom ?? ''),
    telegramBotToken: String(row.telegramBotToken ?? ''),
    telegramDefaultChatId: String(row.telegramDefaultChatId ?? ''),
    updatedAt: new Date(row.updatedAt as string),
  }
}

export async function getSettings(): Promise<AppSettingsRow | null> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM "AppSettings" WHERE id = 'default' LIMIT 1`
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapSettings(row) : null
}

export async function createSettings(data: AppSettingsData): Promise<AppSettingsRow> {
  const sql = getSql()
  const now = new Date()
  const rows = await sql`
    INSERT INTO "AppSettings" (
      id, "companyName", "companyAddress", "companyEmail", "companyPhone",
      "invoicePrefix", "reminderDays", "reminderTime", "reminderTimezone",
      "smtpHost", "smtpPort", "smtpSecure",
      "smtpUser", "smtpPass", "smtpFrom", "telegramBotToken", "telegramDefaultChatId",
      "updatedAt"
    ) VALUES (
      'default', ${data.companyName}, ${data.companyAddress}, ${data.companyEmail}, ${data.companyPhone},
      ${data.invoicePrefix}, ${data.reminderDays}, ${data.reminderTime}, ${data.reminderTimezone},
      ${data.smtpHost}, ${data.smtpPort}, ${data.smtpSecure},
      ${data.smtpUser}, ${data.smtpPass}, ${data.smtpFrom}, ${data.telegramBotToken}, ${data.telegramDefaultChatId},
      ${now}
    )
    RETURNING *
  `
  return mapSettings(rows[0] as Record<string, unknown>)
}

export async function upsertSettings(data: AppSettingsData): Promise<AppSettingsRow> {
  const existing = await getSettings()
  if (!existing) return createSettings(data)

  const sql = getSql()
  const now = new Date()
  const rows = await sql`
    UPDATE "AppSettings" SET
      "companyName" = ${data.companyName},
      "companyAddress" = ${data.companyAddress},
      "companyEmail" = ${data.companyEmail},
      "companyPhone" = ${data.companyPhone},
      "invoicePrefix" = ${data.invoicePrefix},
      "reminderDays" = ${data.reminderDays},
      "reminderTime" = ${data.reminderTime},
      "reminderTimezone" = ${data.reminderTimezone},
      "smtpHost" = ${data.smtpHost},
      "smtpPort" = ${data.smtpPort},
      "smtpSecure" = ${data.smtpSecure},
      "smtpUser" = ${data.smtpUser},
      "smtpPass" = ${data.smtpPass},
      "smtpFrom" = ${data.smtpFrom},
      "telegramBotToken" = ${data.telegramBotToken},
      "telegramDefaultChatId" = ${data.telegramDefaultChatId},
      "updatedAt" = ${now}
    WHERE id = 'default'
    RETURNING *
  `
  return mapSettings(rows[0] as Record<string, unknown>)
}

export async function updateLastReminderRunDate(date: string) {
  const sql = getSql()
  const now = new Date()
  await sql`
    UPDATE "AppSettings"
    SET "lastReminderRunDate" = ${date}, "updatedAt" = ${now}
    WHERE id = 'default'
  `
}
