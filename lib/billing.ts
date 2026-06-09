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

export function getBillingMonths(period: string | null | undefined): number | null {
  const cycle = BILLING_CYCLES.find(c => c.value === period)
  return cycle?.months ?? null
}

export function formatBillingCycle(period: string | null | undefined, recurring?: boolean): string {
  if (!recurring || !period) return 'One-time'
  return BILLING_CYCLES.find(c => c.value === period)?.label ?? period
}

export function calculateBillingDates(startDate: Date | string, period: string) {
  const months = getBillingMonths(period)
  if (!months) return { nextDueDate: null as Date | null, expiryDate: null as Date | null }
  const nextDueDate = addMonths(startDate, months)
  return { nextDueDate, expiryDate: nextDueDate }
}

/** Advance recurring service dates by one billing cycle from the current expiry. */
export function extendServiceByBillingCycle(service: {
  recurring: boolean
  period: string | null
  expiryDate: Date
}): { expiryDate: Date; nextDueDate: Date } | null {
  if (!service.recurring || !service.period) return null
  const months = getBillingMonths(service.period)
  if (!months) return null
  const expiryDate = addMonths(service.expiryDate, months)
  return { expiryDate, nextDueDate: expiryDate }
}

/** Roll back recurring service dates by one billing cycle from the current expiry. */
export function revertServiceByBillingCycle(service: {
  recurring: boolean
  period: string | null
  expiryDate: Date
}): { expiryDate: Date; nextDueDate: Date } | null {
  if (!service.recurring || !service.period) return null
  const months = getBillingMonths(service.period)
  if (!months) return null
  const expiryDate = addMonths(service.expiryDate, -months)
  return { expiryDate, nextDueDate: expiryDate }
}

export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toISOString().split('T')[0]
}
