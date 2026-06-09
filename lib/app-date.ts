import {
  formatDateTimeValue,
  formatDateValue,
  parseDateFormat,
  type DateFormatId,
} from '@/lib/date-format'
import { getAppSettings } from '@/lib/settings'

export async function getAppDateFormat(): Promise<DateFormatId> {
  const settings = await getAppSettings()
  return parseDateFormat(settings.dateFormat)
}

export async function formatAppDate(date: Date | string): Promise<string> {
  return formatDateValue(date, await getAppDateFormat())
}

export async function formatAppDateTime(date: Date | string): Promise<string> {
  return formatDateTimeValue(date, await getAppDateFormat())
}
