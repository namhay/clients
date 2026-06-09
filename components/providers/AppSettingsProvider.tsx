'use client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIMEZONE,
  formatDateTimeValue,
  formatDateValue,
  parseDateFormat,
  type DateFormatId,
} from '@/lib/date-format'
import { parseReminderTimezone } from '@/lib/reminder-schedule'

type AppSettingsContextValue = {
  dateFormat: DateFormatId
  timezone: string
  formatDate: (date: Date | string) => string
  formatDateTime: (date: Date | string) => string
  reloadSettings: () => Promise<void>
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  dateFormat: DEFAULT_DATE_FORMAT,
  timezone: DEFAULT_TIMEZONE,
  formatDate: date => formatDateValue(date, DEFAULT_DATE_FORMAT, DEFAULT_TIMEZONE),
  formatDateTime: date => formatDateTimeValue(date, DEFAULT_DATE_FORMAT, DEFAULT_TIMEZONE),
  reloadSettings: async () => {},
})

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [dateFormat, setDateFormat] = useState<DateFormatId>(DEFAULT_DATE_FORMAT)
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)

  const reloadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) return
      const data = await res.json()
      setDateFormat(parseDateFormat(data.dateFormat))
      setTimezone(parseReminderTimezone(data.reminderTimezone, DEFAULT_TIMEZONE))
    } catch {
      // keep current format
    }
  }, [])

  useEffect(() => {
    reloadSettings()
  }, [reloadSettings])

  const value = useMemo(
    () => ({
      dateFormat,
      timezone,
      formatDate: (date: Date | string) => formatDateValue(date, dateFormat, timezone || DEFAULT_TIMEZONE),
      formatDateTime: (date: Date | string) => formatDateTimeValue(date, dateFormat, timezone || DEFAULT_TIMEZONE),
      reloadSettings,
    }),
    [dateFormat, timezone, reloadSettings],
  )

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  return useContext(AppSettingsContext)
}
