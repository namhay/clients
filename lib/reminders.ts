import { getMaxReminderWindow } from '@/lib/db/product-types'
import type { ReminderTiming } from '@/lib/product-types'
import { daysUntil } from '@/lib/utils'

export type { ReminderTiming } from '@/lib/product-types'
export { formatReminderRule, parseReminderTiming } from '@/lib/product-types'

export function isDueBeforeExpiry(expiryDate: Date | string, daysBefore: number): boolean {
  const days = daysUntil(expiryDate)
  return days <= daysBefore && days >= 0
}

export function isDueForReminder(
  expiryDate: Date | string,
  days: number,
  timing: ReminderTiming = 'BEFORE',
): boolean {
  const d = daysUntil(expiryDate)
  if (timing === 'AFTER') {
    return d <= -days
  }
  return d <= days && d >= 0
}

export function filterServicesDueForReminder<
  S extends {
    expiryDate: Date | string
    productType: { reminderDaysBeforeExpiry: number; reminderTiming?: ReminderTiming }
  },
>(services: S[]): S[] {
  return services.filter(s =>
    isDueForReminder(
      s.expiryDate,
      s.productType.reminderDaysBeforeExpiry,
      s.productType.reminderTiming ?? 'BEFORE',
    ),
  )
}

export function filterServicesDueForAutoInvoice<
  S extends { expiryDate: Date | string; productType: { autoInvoiceDaysBeforeExpiry: number } },
>(services: S[]): S[] {
  return services.filter(s =>
    isDueBeforeExpiry(s.expiryDate, s.productType.autoInvoiceDaysBeforeExpiry),
  )
}

export async function getMaxExpiryWindowDays(): Promise<number> {
  const window = await getMaxReminderWindow()
  return Math.max(window.before, window.after, window.invoice, 1)
}

export async function getReminderExpiryBounds(): Promise<{ gte?: Date; lte: Date }> {
  const window = await getMaxReminderWindow()
  return {
    gte: window.after > 0 ? expiryDaysAgo(window.after) : undefined,
    lte: expiryWithinDays(window.before),
  }
}

export function expiryWithinDays(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

export function expiryDaysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}
