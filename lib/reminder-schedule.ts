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
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  }
}

/** True when current zoned time is within tolerance minutes of reminderTime (HH:mm). */
export function isReminderTimeNow(
  reminderTime: string,
  timezone: string,
  toleranceMinutes = 10,
  now = new Date(),
): boolean {
  const [targetHour, targetMinute] = parseReminderTime(reminderTime).split(':').map(Number)
  const zoned = getZonedParts(now, parseReminderTimezone(timezone))
  const nowMinutes = zoned.hour * 60 + zoned.minute
  const targetMinutes = targetHour * 60 + targetMinute
  return Math.abs(nowMinutes - targetMinutes) <= toleranceMinutes
}

export function formatReminderTimeLabel(reminderTime: string, timezone: string) {
  const [h, m] = parseReminderTime(reminderTime).split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period} (${timezone})`
}
