import { NextRequest, NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron-auth'
import { updateLastReminderRunDate } from '@/lib/db/settings'
import { getZonedParts, parseReminderTimezone } from '@/lib/reminder-schedule'
import { runAutoInvoices } from '@/lib/run-auto-invoices'
import { runServiceExpiryReminders } from '@/lib/run-service-reminders'
import { getAppSettings } from '@/lib/settings'

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = req.nextUrl.searchParams.get('force') === 'true'
  const settings = await getAppSettings()
  const timezone = parseReminderTimezone(settings.reminderTimezone)
  const today = getZonedParts(new Date(), timezone).date

  if (!force) {
    if (settings.lastReminderRunDate === today) {
      return NextResponse.json({
        skipped: true,
        reason: 'Already ran today',
        lastReminderRunDate: settings.lastReminderRunDate,
      })
    }
  }

  const invoices = await runAutoInvoices()
  const result = await runServiceExpiryReminders()
  await updateLastReminderRunDate(today)

  return NextResponse.json({
    success: true,
    date: today,
    reminderTime: settings.reminderTime,
    reminderTimezone: timezone,
    invoices,
    ...result,
  })
}
