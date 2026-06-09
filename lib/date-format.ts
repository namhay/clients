export const DATE_FORMAT_OPTIONS = [
  { id: 'DD_MMM_YYYY', label: '01 Jun 2026' },
  { id: 'MMM_DD_YYYY', label: 'Jun 01, 2026' },
  { id: 'DD_MM_YYYY', label: '01/06/2026' },
  { id: 'YYYY_MM_DD', label: '2026-06-01' },
] as const

export type DateFormatId = (typeof DATE_FORMAT_OPTIONS)[number]['id']

export const DEFAULT_DATE_FORMAT: DateFormatId = 'DD_MMM_YYYY'
export const DEFAULT_TIMEZONE = 'Asia/Phnom_Penh'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function resolveTimeZone(timeZone?: string) {
  const tz = String(timeZone || DEFAULT_TIMEZONE).trim()
  return tz || DEFAULT_TIMEZONE
}

/** Parse API/DB timestamps; bare ISO strings without offset are treated as UTC. */
export function parseInstant(value: Date | string): Date {
  if (value instanceof Date) return value
  const text = String(value).trim()
  if (!text) return new Date(NaN)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)) {
    return new Date(`${text}Z`)
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(text)) {
    return new Date(`${text.replace(' ', 'T')}Z`)
  }
  return new Date(text)
}

export function readZonedParts(date: Date | string, timeZone?: string): ZonedParts | null {
  const d = parseInstant(date)
  if (Number.isNaN(d.getTime())) return null

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const parts = formatter.formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value || ''
  const hourRaw = Number(get('hour') || 0)
  const dayPeriod = get('dayPeriod').toUpperCase()
  let hour = hourRaw % 12
  if (dayPeriod === 'PM') hour += 12
  if (dayPeriod === 'AM' && hourRaw === 12) hour = 0

  return {
    year: Number(get('year') || 0),
    month: Number(get('month') || 0),
    day: Number(get('day') || 0),
    hour,
    minute: Number(get('minute') || 0),
  }
}

export function parseDateFormat(value: unknown, fallback: DateFormatId = DEFAULT_DATE_FORMAT): DateFormatId {
  const id = String(value || fallback).trim()
  return DATE_FORMAT_OPTIONS.some(o => o.id === id) ? (id as DateFormatId) : fallback
}

export function formatDateValue(
  date: Date | string,
  format: DateFormatId = DEFAULT_DATE_FORMAT,
  timeZone?: string,
): string {
  const zoned = readZonedParts(date, timeZone)
  if (!zoned) return ''

  const day = zoned.day
  const month = MONTHS[zoned.month - 1]
  const monthNum = zoned.month
  const year = zoned.year

  switch (format) {
    case 'MMM_DD_YYYY':
      return `${month} ${pad(day)}, ${year}`
    case 'DD_MM_YYYY':
      return `${pad(day)}/${pad(monthNum)}/${year}`
    case 'YYYY_MM_DD':
      return `${year}-${pad(monthNum)}-${pad(day)}`
    case 'DD_MMM_YYYY':
    default:
      return `${pad(day)} ${month} ${year}`
  }
}

export function formatTimeValue(
  date: Date | string,
  timeZone?: string,
): string {
  const d = parseInstant(date)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

export function formatDateTimeValue(
  date: Date | string,
  format: DateFormatId = DEFAULT_DATE_FORMAT,
  timeZone?: string,
): string {
  const tz = resolveTimeZone(timeZone)
  const datePart = formatDateValue(date, format, tz)
  const timePart = formatTimeValue(date, tz)
  return timePart ? `${datePart}, ${timePart}` : datePart
}
