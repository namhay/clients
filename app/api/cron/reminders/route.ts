import { NextRequest, NextResponse } from 'next/server'
import { updateLastReminderRunDate } from '@/lib/db/settings'
import { isReminderTimeNow, getZonedParts, parseReminderTimezone } from '@/lib/reminder-schedule'
import { runServiceExpiryReminders } from '@/lib/run-service-reminders'
import { getAppSettings } from '@/lib/settings'

function authorizeCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const header = req.headers.get('x-cron-secret')
  return bearer === secret || header === secret
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = req.nextUrl.searchParams.get('force') === 'true'
  const settings = await getAppSettings()
  const timezone = parseReminderTimezone(settings.reminderTimezone)
  const today = getZonedParts(new Date(), timezone).date

  if (!force) {
    if (!isReminderTimeNow(settings.reminderTime, timezone)) {
      return NextResponse.json({
        skipped: true,
        reason: 'Not reminder time yet',
        reminderTime: settings.reminderTime,
        reminderTimezone: timezone,
      })
    }
    if (settings.lastReminderRunDate === today) {
      return NextResponse.json({
        skipped: true,
        reason: 'Already ran today',
        lastReminderRunDate: settings.lastReminderRunDate,
      })
    }
  }

  const result = await runServiceExpiryReminders()
  await updateLastReminderRunDate(today)

  return NextResponse.json({
    success: true,
    date: today,
    reminderTime: settings.reminderTime,
    reminderTimezone: timezone,
    ...result,
  })
}
