import { getMaxRenewalWindow } from '@/lib/db/clients'
import { daysUntil } from '@/lib/utils'

export function isDueBeforeExpiry(expiryDate: Date | string, daysBefore: number): boolean {
  const days = daysUntil(expiryDate)
  return days <= daysBefore && days >= 0
}

export function isInReminderWindow(
  expiryDate: Date | string,
  daysBefore: number,
): boolean {
  const d = daysUntil(expiryDate)
  return d <= daysBefore && d >= 0
}

/** Exact day match — used by daily cron so reminders are not sent every day. */
export function isDueForReminderToday(
  expiryDate: Date | string,
  daysBefore: number,
): boolean {
  return daysUntil(expiryDate) === daysBefore
}

export function filterServicesInReminderWindow<
  S extends {
    expiryDate: Date | string
    client: { renewalDaysBeforeExpiry: number }
  },
>(services: S[]): S[] {
  return services.filter(s =>
    isInReminderWindow(s.expiryDate, s.client.renewalDaysBeforeExpiry ?? 14),
  )
}

export function filterServicesDueForReminderToday<
  S extends {
    expiryDate: Date | string
    client: { renewalDaysBeforeExpiry: number }
  },
>(services: S[]): S[] {
  return services.filter(s =>
    isDueForReminderToday(s.expiryDate, s.client.renewalDaysBeforeExpiry ?? 14),
  )
}

/** @deprecated Use filterServicesInReminderWindow. */
export function filterServicesDueForReminder<
  S extends {
    expiryDate: Date | string
    client: { renewalDaysBeforeExpiry: number }
  },
>(services: S[]): S[] {
  return filterServicesInReminderWindow(services)
}

export function filterServicesDueForAutoInvoice<
  S extends { expiryDate: Date | string; client: { renewalDaysBeforeExpiry: number } },
>(services: S[]): S[] {
  return services.filter(s =>
    isDueForReminderToday(s.expiryDate, s.client.renewalDaysBeforeExpiry ?? 14),
  )
}

export async function getMaxExpiryWindowDays(): Promise<number> {
  const maxDays = await getMaxRenewalWindow()
  return Math.max(maxDays, 1)
}

export async function getReminderExpiryBounds(): Promise<{ gte?: Date; lte: Date }> {
  const before = await getMaxRenewalWindow()
  return {
    lte: expiryWithinDays(Math.max(before, 0)),
  }
}

const REMINDER_SERVICE_STATUSES = ['ACTIVE', 'EXPIRED'] as const

/** Services to show on dashboard/reminders (includes overdue; no lower date bound). */
export async function listServicesForReminderDisplay() {
  const maxDays = await getMaxRenewalWindow()
  const { listServices } = await import('@/lib/db/services')
  return listServices({
    expiryDateLte: expiryWithinDays(Math.max(maxDays, 0)),
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
