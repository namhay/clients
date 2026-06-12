import { getMaxReminderWindow } from '@/lib/db/product-types'
import type { ReminderTiming } from '@/lib/product-types'
import { daysUntil } from '@/lib/utils'

export type { ReminderTiming } from '@/lib/product-types'
export { formatReminderRule, parseReminderTiming } from '@/lib/product-types'

export function isDueBeforeExpiry(expiryDate: Date | string, daysBefore: number): boolean {
  const days = daysUntil(expiryDate)
  return days <= daysBefore && days >= 0
}

export function isInReminderWindow(
  expiryDate: Date | string,
  days: number,
  timing: ReminderTiming = 'BEFORE',
): boolean {
  const d = daysUntil(expiryDate)
  if (timing === 'AFTER') {
    return d <= -days
  }
  return d <= days
}

/** Exact day match — used by daily cron so reminders are not sent every day. */
export function isDueForReminderToday(
  expiryDate: Date | string,
  days: number,
  timing: ReminderTiming = 'BEFORE',
): boolean {
  const d = daysUntil(expiryDate)
  if (timing === 'AFTER') {
    return d === -days
  }
  return d === days
}

/** @deprecated Use isInReminderWindow for UI or isDueForReminderToday for cron. */
export function isDueForReminder(
  expiryDate: Date | string,
  days: number,
  timing: ReminderTiming = 'BEFORE',
): boolean {
  return isInReminderWindow(expiryDate, days, timing)
}

export function filterServicesInReminderWindow<
  S extends {
    expiryDate: Date | string
    productType: { reminderDaysBeforeExpiry: number; reminderTiming?: ReminderTiming }
  },
>(services: S[]): S[] {
  return services.filter(s =>
    isInReminderWindow(
      s.expiryDate,
      s.productType.reminderDaysBeforeExpiry,
      s.productType.reminderTiming ?? 'BEFORE',
    ),
  )
}

export function filterServicesDueForReminderToday<
  S extends {
    expiryDate: Date | string
    productType: { reminderDaysBeforeExpiry: number; reminderTiming?: ReminderTiming }
  },
>(services: S[]): S[] {
  return services.filter(s =>
    isDueForReminderToday(
      s.expiryDate,
      s.productType.reminderDaysBeforeExpiry,
      s.productType.reminderTiming ?? 'BEFORE',
    ),
  )
}

export function filterServicesDueForReminder<
  S extends {
    expiryDate: Date | string
    productType: { reminderDaysBeforeExpiry: number; reminderTiming?: ReminderTiming }
  },
>(services: S[]): S[] {
  return filterServicesInReminderWindow(services)
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

const REMINDER_SERVICE_STATUSES = ['ACTIVE', 'EXPIRED'] as const

/** Services to show on dashboard/reminders (includes overdue; no lower date bound). */
export async function listServicesForReminderDisplay() {
  const window = await getMaxReminderWindow()
  const { listServices } = await import('@/lib/db/services')
  return listServices({
    expiryDateLte: expiryWithinDays(window.before),
    statuses: [...REMINDER_SERVICE_STATUSES],
  })
}

/** Services considered by daily cron (narrower date range, exact-day match). */
export async function listServicesForReminderCron() {
  const bounds = await getReminderExpiryBounds()
  const { listServices } = await import('@/lib/db/services')
  return listServices({
    expiryDateGte: bounds.gte,
    expiryDateLte: bounds.lte,
    statuses: [...REMINDER_SERVICE_STATUSES],
  })
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
