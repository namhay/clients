import { DEFAULT_TIMEZONE, readZonedParts } from '@/lib/date-format'

export const BILLING_CYCLES = [
  { value: 'MONTHLY', label: 'Monthly', months: 1 },
  { value: 'QUARTERLY', label: 'Quarterly', months: 3 },
  { value: 'SEMI_ANNUAL', label: 'Semi-Annual', months: 6 },
  { value: 'YEARLY', label: 'Annually', months: 12 },
] as const

export type BillingPeriod = (typeof BILLING_CYCLES)[number]['value']

export function addMonths(date: Date | string, months: number): Date {
  const d = new Date(date)
  const result = new Date(d)
  result.setMonth(result.getMonth() + months)
  return result
}

export function subtractDays(date: Date | string, days: number): Date {
  const d = new Date(date)
  const result = new Date(d)
  result.setDate(result.getDate() - days)
  return result
}

export function addDays(date: Date | string, days: number): Date {
  const d = new Date(date)
  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}

export function getBillingMonths(period: string | null | undefined): number | null {
  const cycle = BILLING_CYCLES.find(c => c.value === period)
  return cycle?.months ?? null
}

export function startOfDay(date: Date | string): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Order / new service: period starts on the form date; invoice period end is +1 billing cycle. */
export function getFormServiceInvoicePeriod(
  service: {
    startDate: Date | string
    expiryDate: Date | string
    recurring: boolean
    period: string | null
  },
): { periodStart: Date; periodEnd: Date } {
  const periodStart = startOfDay(service.startDate)
  if (service.recurring && service.period) {
    const months = getBillingMonths(service.period)
    if (months) return { periodStart, periodEnd: addMonths(periodStart, months) }
  }
  return { periodStart, periodEnd: startOfDay(service.expiryDate) }
}

/** New order / new service: period starts today (or invoice date), ends after one billing cycle. */
export function getNewServiceInvoicePeriod(
  service: { recurring: boolean; period: string | null; expiryDate: Date | string },
  invoiceDate: Date | string = new Date(),
): { periodStart: Date; periodEnd: Date } {
  const periodStart = startOfDay(invoiceDate)
  if (service.recurring && service.period) {
    const months = getBillingMonths(service.period)
    if (months) return { periodStart, periodEnd: addMonths(periodStart, months) }
  }
  return { periodStart, periodEnd: new Date(service.expiryDate) }
}

/** Renewal (cron / existing service): period starts at current expiry, ends after one billing cycle. */
export function getRenewalServiceInvoicePeriod(
  service: { recurring: boolean; period: string | null; expiryDate: Date | string },
): { periodStart: Date; periodEnd: Date } {
  const periodStart = startOfDay(service.expiryDate)
  if (service.recurring && service.period) {
    const months = getBillingMonths(service.period)
    if (months) return { periodStart, periodEnd: addMonths(periodStart, months) }
  }
  return { periodStart, periodEnd: periodStart }
}

export function formatBillingCycle(period: string | null | undefined, recurring?: boolean): string {
  if (!recurring || !period) return 'One-time'
  return BILLING_CYCLES.find(c => c.value === period)?.label ?? period
}

export function calculateBillingDates(startDate: Date | string, period: string) {
  const months = getBillingMonths(period)
  if (!months) return { expiryDate: null as Date | null }
  const expiryDate = addMonths(startDate, months)
  return { expiryDate }
}

/** Advance recurring service dates by one billing cycle from the current expiry. */
export function extendServiceByBillingCycle(service: {
  recurring: boolean
  period: string | null
  expiryDate: Date
}): { expiryDate: Date } | null {
  if (!service.recurring || !service.period) return null
  const months = getBillingMonths(service.period)
  if (!months) return null
  return { expiryDate: addMonths(service.expiryDate, months) }
}

/** Roll back recurring service dates by one billing cycle from the current expiry. */
export function revertServiceByBillingCycle(service: {
  recurring: boolean
  period: string | null
  expiryDate: Date
}): { expiryDate: Date } | null {
  if (!service.recurring || !service.period) return null
  const months = getBillingMonths(service.period)
  if (!months) return null
  return { expiryDate: addMonths(service.expiryDate, -months) }
}

export function toDateInput(
  date: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!date) return ''
  const zoned = readZonedParts(date, timeZone)
  if (!zoned) return ''
  return `${zoned.year}-${String(zoned.month).padStart(2, '0')}-${String(zoned.day).padStart(2, '0')}`
}
