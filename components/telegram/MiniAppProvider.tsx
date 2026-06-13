'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MiniAppHomeData } from '@/lib/telegram-mini-app-data'
import type { MiniAppInvoiceListItem } from '@/lib/telegram-mini-app-serialize'

type MiniAppContextValue = {
  ready: boolean
  initData: string
  home: MiniAppHomeData | null
  loading: boolean
  refreshing: boolean
  error: string | null
  refreshHome: () => Promise<void>
  miniAppFetch: (path: string, options?: RequestInit) => Promise<Response>
  updateInvoices: (invoices: MiniAppInvoiceListItem[]) => void
}

const MiniAppContext = createContext<MiniAppContextValue | null>(null)
const HOME_CACHE_KEY = 'clientdesk-tg-mini-app-home'
const HOME_CACHE_TTL_MS = 5 * 60 * 1000

function getTelegramWebApp() {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

function readHomeCache(): MiniAppHomeData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(HOME_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts: number; data: MiniAppHomeData }
    if (Date.now() - parsed.ts > HOME_CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeHomeCache(data: MiniAppHomeData) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HOME_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // Ignore quota errors
  }
}

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const cachedHome = useMemo(() => readHomeCache(), [])
  const [ready, setReady] = useState(false)
  const [initData, setInitData] = useState('')
  const [home, setHome] = useState<MiniAppHomeData | null>(cachedHome)
  const [loading, setLoading] = useState(!cachedHome)
  const [refreshing, setRefreshing] = useState(Boolean(cachedHome))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const tg = getTelegramWebApp()
    if (!tg) {
      setError('Open this page from Telegram to view your invoices.')
      setReady(true)
      return
    }

    tg.ready()
    tg.expand()

    const params = tg.themeParams
    const root = document.documentElement
    if (params.bg_color) root.style.setProperty('--tg-bg', params.bg_color)
    if (params.text_color) root.style.setProperty('--tg-text', params.text_color)
    if (params.hint_color) root.style.setProperty('--tg-hint', params.hint_color)
    if (params.link_color) root.style.setProperty('--tg-link', params.link_color)
    if (params.button_color) root.style.setProperty('--tg-button', params.button_color)
    if (params.button_text_color) root.style.setProperty('--tg-button-text', params.button_text_color)
    if (params.secondary_bg_color) root.style.setProperty('--tg-secondary-bg', params.secondary_bg_color)

    setInitData(tg.initData || '')
    setReady(true)
  }, [])

  const miniAppFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers)
    if (initData) headers.set('X-Telegram-Init-Data', initData)
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    return fetch(path, { ...options, headers })
  }, [initData])

  const refreshHome = useCallback(async () => {
    if (!initData) return
    if (!home) setLoading(true)
    else setRefreshing(true)

    const res = await miniAppFetch('/api/telegram/mini-app/home')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Failed to load invoices')
      if (!home) setHome(null)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setError(null)
    setHome(data as MiniAppHomeData)
    writeHomeCache(data as MiniAppHomeData)
    setLoading(false)
    setRefreshing(false)
  }, [initData, miniAppFetch, home])

  useEffect(() => {
    if (!ready || !initData) return
    void refreshHome()
  }, [ready, initData]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateInvoices = useCallback((invoices: MiniAppInvoiceListItem[]) => {
    setHome(prev => {
      if (!prev) return prev
      const next = { ...prev, invoices }
      writeHomeCache(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      ready,
      initData,
      home,
      loading,
      refreshing,
      error,
      refreshHome,
      miniAppFetch,
      updateInvoices,
    }),
    [ready, initData, home, loading, refreshing, error, refreshHome, miniAppFetch, updateInvoices],
  )

  return <MiniAppContext.Provider value={value}>{children}</MiniAppContext.Provider>
}

export function useMiniApp() {
  const ctx = useContext(MiniAppContext)
  if (!ctx) throw new Error('useMiniApp must be used within MiniAppProvider')
  return ctx
}

export function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

export function statusBadgeClass(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === 'PAID') return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
  if (normalized === 'OVERDUE') return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
  if (normalized === 'CANCELLED') return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
}

export function canMarkPaid(status: string) {
  const normalized = status.toUpperCase()
  return normalized === 'UNPAID' || normalized === 'OVERDUE'
}
