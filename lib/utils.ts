import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIMEZONE,
  formatDateTimeValue,
  formatDateValue,
} from '@/lib/date-format'

/** @deprecated Prefer useAppSettings().formatDate in client components */
export function formatDate(date: Date | string) {
  return formatDateValue(date, DEFAULT_DATE_FORMAT, DEFAULT_TIMEZONE)
}

export function formatDateTime(date: Date | string) {
  return formatDateTimeValue(date, DEFAULT_DATE_FORMAT, DEFAULT_TIMEZONE)
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
  }).format(amount)
}

export function daysUntil(date: Date | string) {
  const d = new Date(date)
  const now = new Date()
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

