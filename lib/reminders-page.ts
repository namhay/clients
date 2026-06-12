import { listInvoiceSummaries } from '@/lib/db/invoices'
import { listRecentReminderLogsPaginated } from '@/lib/db/reminder-logs'
import { getAppSettings } from '@/lib/settings'
import {
  filterServicesInReminderWindow,
  listServicesForReminderDisplay,
} from '@/lib/reminders'
import { formatReminderTimeLabel } from '@/lib/reminder-schedule'

export async function getRemindersPageData(logPage = 1) {
  const [openInvoices, candidateServices, recentLogsResult, settings] = await Promise.all([
    listInvoiceSummaries('open', 200),
    listServicesForReminderDisplay(),
    listRecentReminderLogsPaginated(logPage),
    getAppSettings(),
  ])

  const expiringServices = filterServicesInReminderWindow(candidateServices)
  const outstandingAmount = openInvoices.reduce((sum, inv) => sum + inv.total, 0)
  const overdueCount = openInvoices.filter(inv => inv.status === 'OVERDUE').length
  const telegramReadyInvoices = openInvoices.filter(inv => inv.client?.telegramId).length
  const telegramReadyServices = expiringServices.filter(svc => svc.client?.telegramId).length

  return {
    openInvoices,
    expiringServices,
    recentLogs: recentLogsResult.logs,
    recentLogsPagination: {
      total: recentLogsResult.total,
      page: recentLogsResult.page,
      pageSize: recentLogsResult.pageSize,
      totalPages: recentLogsResult.totalPages,
    },
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
