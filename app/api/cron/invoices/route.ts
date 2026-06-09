import { NextRequest, NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron-auth'
import { runAutoInvoices } from '@/lib/run-auto-invoices'
import { getZonedParts, parseReminderTimezone } from '@/lib/reminder-schedule'
import { getAppSettings } from '@/lib/settings'

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getAppSettings()
  const timezone = parseReminderTimezone(settings.reminderTimezone)
  const today = getZonedParts(new Date(), timezone).date

  const result = await runAutoInvoices()

  return NextResponse.json({
    success: true,
    date: today,
    reminderTimezone: timezone,
    ...result,
  })
}
