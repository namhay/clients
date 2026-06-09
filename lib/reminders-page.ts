import { listInvoiceSummaries } from '@/lib/db/invoices'
import { listRecentReminderLogs } from '@/lib/db/reminder-logs'
import { listServices } from '@/lib/db/services'
import { getAppSettings } from '@/lib/settings'
import {
  filterServicesDueForReminder,
  getReminderExpiryBounds,
} from '@/lib/reminders'
import { formatReminderTimeLabel } from '@/lib/reminder-schedule'

export async function getRemindersPageData() {
  const bounds = await getReminderExpiryBounds()

  const [openInvoices, candidateServices, recentLogs, settings] = await Promise.all([
    listInvoiceSummaries('open', 200),
    listServices({
      expiryDateGte: bounds.gte,
      expiryDateLte: bounds.lte,
      status: 'ACTIVE',
    }),
    listRecentReminderLogs(12),
    getAppSettings(),
  ])

  const expiringServices = filterServicesDueForReminder(candidateServices)
  const outstandingAmount = openInvoices.reduce((sum, inv) => sum + inv.total, 0)
  const overdueCount = openInvoices.filter(inv => inv.status === 'OVERDUE').length
  const telegramReadyInvoices = openInvoices.filter(inv => inv.client?.telegramId).length
  const telegramReadyServices = expiringServices.filter(svc => svc.client?.telegramId).length

  return {
    openInvoices,
    expiringServices,
    recentLogs,
    summary: {
      openCount: openInvoices.length,
      outstandingAmount,
      overdueCount,
      expiringCount: expiringServices.length,
      telegramReady: telegramReadyInvoices + telegramReadyServices,
    },
    schedule: {
      timeLabel: formatReminderTimeLabel(settings.reminderTime, settings.reminderTimezone),
      lastRunDate: settings.lastReminderRunDate,
    },
  }
}
