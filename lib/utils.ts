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

export function generateInvoiceNo(prefix: string, count: number) {
  return `${prefix}${String(count).padStart(4, '0')}`
}

export function getStatusColor(status: string) {
  const map: Record<string, string> = {
    PAID: 'bg-green-100 text-green-800',
    UNPAID: 'bg-yellow-100 text-yellow-800',
    OVERDUE: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-600',
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-red-100 text-red-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}
