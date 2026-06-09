export const DATE_FORMAT_OPTIONS = [
  { id: 'DD_MMM_YYYY', label: '01 Jun 2026' },
  { id: 'MMM_DD_YYYY', label: 'Jun 01, 2026' },
  { id: 'DD_MM_YYYY', label: '01/06/2026' },
  { id: 'YYYY_MM_DD', label: '2026-06-01' },
] as const

export type DateFormatId = (typeof DATE_FORMAT_OPTIONS)[number]['id']

export const DEFAULT_DATE_FORMAT: DateFormatId = 'DD_MMM_YYYY'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function parseDateFormat(value: unknown, fallback: DateFormatId = DEFAULT_DATE_FORMAT): DateFormatId {
  const id = String(value || fallback).trim()
  return DATE_FORMAT_OPTIONS.some(o => o.id === id) ? (id as DateFormatId) : fallback
}

export function formatDateValue(date: Date | string, format: DateFormatId = DEFAULT_DATE_FORMAT): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''

  const day = d.getDate()
  const month = MONTHS[d.getMonth()]
  const monthNum = d.getMonth() + 1
  const year = d.getFullYear()

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

export function formatTimeValue(date: Date | string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const hours = d.getHours()
  const minutes = pad(d.getMinutes())
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes} ${period}`
}

export function formatDateTimeValue(
  date: Date | string,
  format: DateFormatId = DEFAULT_DATE_FORMAT,
): string {
  const datePart = formatDateValue(date, format)
  const timePart = formatTimeValue(date)
  return timePart ? `${datePart}, ${timePart}` : datePart
}
