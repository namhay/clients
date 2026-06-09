import {
  DEFAULT_TIMEZONE,
  formatDateTimeValue,
  formatDateValue,
  parseDateFormat,
  type DateFormatId,
} from '@/lib/date-format'
import { parseReminderTimezone } from '@/lib/reminder-schedule'
import { getAppSettings } from '@/lib/settings'

export async function getAppDateFormat(): Promise<DateFormatId> {
  const settings = await getAppSettings()
  return parseDateFormat(settings.dateFormat)
}

export async function getAppTimezone(): Promise<string> {
  const settings = await getAppSettings()
  return parseReminderTimezone(settings.reminderTimezone, DEFAULT_TIMEZONE)
}

export async function formatAppDate(date: Date | string): Promise<string> {
  const [format, timezone] = await Promise.all([getAppDateFormat(), getAppTimezone()])
  return formatDateValue(date, format, timezone)
}

export async function formatAppDateTime(date: Date | string): Promise<string> {
  const [format, timezone] = await Promise.all([getAppDateFormat(), getAppTimezone()])
  return formatDateTimeValue(date, format, timezone)
}
