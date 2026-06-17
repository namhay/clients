import { getMaxRenewalWindow } from '@/lib/db/clients'
import { getClientRenewalDays } from '@/lib/clients'
import { calendarDaysUntil, DEFAULT_TIMEZONE } from '@/lib/date-format'

function daysLeftUntilExpiry(
  expiryDate: Date | string,
  timeZone: string = DEFAULT_TIMEZONE,
): number {
  return calendarDaysUntil(expiryDate, timeZone)
}

export function isDueBeforeExpiry(
  expiryDate: Date | string,
  daysBefore: number,
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  const days = daysLeftUntilExpiry(expiryDate, timeZone)
  return days <= daysBefore && days >= 0
}

export function isInReminderWindow(
  expiryDate: Date | string,
  daysBefore: number,
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  return isDueBeforeExpiry(expiryDate, daysBefore, timeZone)
}

/** Exact calendar-day match — used by daily cron so reminders are not sent every day. */
export function isDueForReminderToday(
  expiryDate: Date | string,
  daysBefore: number,
  timeZone: string = DEFAULT_TIMEZONE,
): boolean {
  return daysLeftUntilExpiry(expiryDate, timeZone) === daysBefore
}

export function filterServicesInReminderWindow<
  S extends {
    expiryDate: Date | string
    client: { renewalDaysBeforeExpiry?: number | null }
  },
>(services: S[], timeZone: string = DEFAULT_TIMEZONE): S[] {
  return services.filter(s =>
    isInReminderWindow(s.expiryDate, getClientRenewalDays(s.client), timeZone),
  )
}

export function filterServicesDueForReminderToday<
  S extends {
    expiryDate: Date | string
    client: { renewalDaysBeforeExpiry?: number | null }
  },
>(services: S[], timeZone: string = DEFAULT_TIMEZONE): S[] {
  return services.filter(s =>
    isDueForReminderToday(s.expiryDate, getClientRenewalDays(s.client), timeZone),
  )
}

/** @deprecated Use filterServicesInReminderWindow. */
export function filterServicesDueForReminder<
  S extends {
    expiryDate: Date | string
    client: { renewalDaysBeforeExpiry?: number | null }
  },
>(services: S[], timeZone: string = DEFAULT_TIMEZONE): S[] {
  return filterServicesInReminderWindow(services, timeZone)
}

export function filterServicesDueForAutoInvoice<
  S extends {
    expiryDate: Date | string
    client: { renewalDaysBeforeExpiry?: number | null }
  },
>(services: S[], timeZone: string = DEFAULT_TIMEZONE): S[] {
  return filterServicesDueForReminderToday(services, timeZone)
}

export async function getMaxExpiryWindowDays(): Promise<number> {
  const maxDays = await getMaxRenewalWindow()
  return Math.max(maxDays, 0)
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
