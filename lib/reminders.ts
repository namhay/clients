import { getMaxReminderWindowDays } from '@/lib/db/product-types'
import { daysUntil } from '@/lib/utils'

export function isDueBeforeExpiry(expiryDate: Date | string, daysBefore: number): boolean {
  const days = daysUntil(expiryDate)
  return days <= daysBefore && days >= 0
}

export function filterServicesDueForReminder<
  S extends { expiryDate: Date | string; productType: { reminderDaysBeforeExpiry: number } },
>(services: S[]): S[] {
  return services.filter(s =>
    isDueBeforeExpiry(s.expiryDate, s.productType.reminderDaysBeforeExpiry),
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
  return getMaxReminderWindowDays()
}

export function expiryWithinDays(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}
