import { readZonedParts } from '@/lib/date-format'

const COMMON_TIMEZONES = [
  'Asia/Phnom_Penh',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Ho_Chi_Minh',
  'Asia/Jakarta',
  'Asia/Kuala_Lumpur',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'UTC',
] as const

export type ReminderTimezone = (typeof COMMON_TIMEZONES)[number]

export const REMINDER_TIMEZONES = COMMON_TIMEZONES
export const APP_TIMEZONES = REMINDER_TIMEZONES

export function parseReminderTime(value: unknown, fallback = '09:00'): string {
  const text = String(value || fallback).trim()
  const match = text.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function parseReminderTimezone(value: unknown, fallback = 'Asia/Phnom_Penh'): string {
  const tz = String(value || fallback).trim()
  return REMINDER_TIMEZONES.includes(tz as ReminderTimezone) ? tz : fallback
}

export function getZonedParts(date: Date, timezone: string) {
  const zoned = readZonedParts(date, timezone)
  if (!zoned) {
    return { date: '', hour: 0, minute: 0 }
  }
  return {
    date: `${zoned.year}-${pad(zoned.month)}-${pad(zoned.day)}`,
    hour: zoned.hour,
    minute: zoned.minute,
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Vercel cron expression (UTC) to run once daily at reminderTime in the given timezone. */
export function reminderTimeToUtcCron(reminderTime: string, timezone: string): string {
  const [targetHour, targetMinute] = parseReminderTime(reminderTime).split(':').map(Number)
  const tz = parseReminderTimezone(timezone)
  const base = new Date()
  base.setUTCHours(0, 0, 0, 0)

  for (let offset = 0; offset < 24 * 60; offset++) {
    const probe = new Date(base.getTime() + offset * 60_000)
    const zoned = getZonedParts(probe, tz)
    if (zoned.hour === targetHour && zoned.minute === targetMinute) {
      return `${probe.getUTCMinutes()} ${probe.getUTCHours()} * * *`
    }
  }
  return '0 2 * * *'
}

export function formatReminderTimeLabel(reminderTime: string, timezone: string) {
  const [h, m] = parseReminderTime(reminderTime).split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period} (${timezone})`
}
