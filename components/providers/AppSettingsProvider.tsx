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
  formatDateTimeValue,
  formatDateValue,
  parseDateFormat,
  type DateFormatId,
} from '@/lib/date-format'

type AppSettingsContextValue = {
  dateFormat: DateFormatId
  formatDate: (date: Date | string) => string
  formatDateTime: (date: Date | string) => string
  reloadSettings: () => Promise<void>
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  dateFormat: DEFAULT_DATE_FORMAT,
  formatDate: date => formatDateValue(date, DEFAULT_DATE_FORMAT),
  formatDateTime: date => formatDateTimeValue(date, DEFAULT_DATE_FORMAT),
  reloadSettings: async () => {},
})

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [dateFormat, setDateFormat] = useState<DateFormatId>(DEFAULT_DATE_FORMAT)

  const reloadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) return
      const data = await res.json()
      setDateFormat(parseDateFormat(data.dateFormat))
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
      formatDate: (date: Date | string) => formatDateValue(date, dateFormat),
      formatDateTime: (date: Date | string) => formatDateTimeValue(date, dateFormat),
      reloadSettings,
    }),
    [dateFormat, reloadSettings],
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
