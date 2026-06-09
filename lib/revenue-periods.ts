import { readZonedParts } from '@/lib/date-format'

export type RevenuePeriod = 'all' | 'today' | 'this_week' | 'this_month' | 'last_month'

type ZonedDay = { year: number; month: number; day: number }

export type RevenuePeriodSummary = {
  today: { revenue: number; count: number }
  thisWeek: { revenue: number; count: number }
  thisMonth: { revenue: number; count: number }
  lastMonth: { revenue: number; count: number }
}

type PaidTransaction = {
  total: number
  paidAt?: Date | string | null
  updatedAt?: Date | string
  createdAt?: Date | string
}

export function getPaymentDate(tx: PaidTransaction): Date {
  return new Date(tx.paidAt || tx.updatedAt || tx.createdAt || 0)
}

function compareDays(a: ZonedDay, b: ZonedDay): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

function addDays(day: ZonedDay, delta: number): ZonedDay {
  const d = new Date(Date.UTC(day.year, day.month - 1, day.day + delta))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

function weekdayMon0(day: ZonedDay, timezone: string): number {
  for (let hour = 0; hour < 24; hour++) {
    const probe = new Date(Date.UTC(day.year, day.month - 1, day.day, hour))
    const parts = readZonedParts(probe, timezone)
    if (parts?.year === day.year && parts.month === day.month && parts.day === day.day) {
      const wd = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(probe)
      const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
      return map[wd] ?? 0
    }
  }
  return 0
}

function isToday(paid: ZonedDay, now: ZonedDay): boolean {
  return paid.year === now.year && paid.month === now.month && paid.day === now.day
}

function isThisMonth(paid: ZonedDay, now: ZonedDay): boolean {
  return paid.year === now.year && paid.month === now.month
}

function isLastMonth(paid: ZonedDay, now: ZonedDay): boolean {
  const prev = now.month === 1
    ? { year: now.year - 1, month: 12, day: now.day }
    : { year: now.year, month: now.month - 1, day: now.day }
  return paid.year === prev.year && paid.month === prev.month
}

function isThisWeek(paid: ZonedDay, now: ZonedDay, timezone: string): boolean {
  const monday = addDays(now, -weekdayMon0(now, timezone))
  const sunday = addDays(monday, 6)
  return compareDays(paid, monday) >= 0 && compareDays(paid, sunday) <= 0
}

export function transactionInPeriod(
  tx: PaidTransaction,
  period: RevenuePeriod,
  timezone: string,
  now = new Date(),
): boolean {
  if (period === 'all') return true
  const paid = readZonedParts(getPaymentDate(tx), timezone)
  const current = readZonedParts(now, timezone)
  if (!paid || !current) return false

  switch (period) {
    case 'today':
      return isToday(paid, current)
    case 'this_week':
      return isThisWeek(paid, current, timezone)
    case 'this_month':
      return isThisMonth(paid, current)
    case 'last_month':
      return isLastMonth(paid, current)
    default:
      return true
  }
}

export function summarizeRevenueByPeriod(
  transactions: PaidTransaction[],
  timezone: string,
  now = new Date(),
): RevenuePeriodSummary {
  const summary: RevenuePeriodSummary = {
    today: { revenue: 0, count: 0 },
    thisWeek: { revenue: 0, count: 0 },
    thisMonth: { revenue: 0, count: 0 },
    lastMonth: { revenue: 0, count: 0 },
  }

  for (const tx of transactions) {
    const amount = Number(tx.total) || 0
    if (transactionInPeriod(tx, 'today', timezone, now)) {
      summary.today.revenue += amount
      summary.today.count++
    }
    if (transactionInPeriod(tx, 'this_week', timezone, now)) {
      summary.thisWeek.revenue += amount
      summary.thisWeek.count++
    }
    if (transactionInPeriod(tx, 'this_month', timezone, now)) {
      summary.thisMonth.revenue += amount
      summary.thisMonth.count++
    }
    if (transactionInPeriod(tx, 'last_month', timezone, now)) {
      summary.lastMonth.revenue += amount
      summary.lastMonth.count++
    }
  }

  return summary
}

export const REVENUE_PERIOD_LABELS: Record<RevenuePeriod, string> = {
  all: 'All time',
  today: 'Today',
  this_week: 'This week',
  this_month: 'This month',
  last_month: 'Last month',
}
