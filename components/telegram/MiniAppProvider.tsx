'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type MiniAppSession = {
  user: { id: number; firstName: string; username: string | null }
  linked: boolean
  client: { id: string; name: string; email: string } | null
  companyName: string
}

type MiniAppContextValue = {
  ready: boolean
  initData: string
  session: MiniAppSession | null
  error: string | null
  refreshSession: () => Promise<void>
  miniAppFetch: (path: string, options?: RequestInit) => Promise<Response>
}

const MiniAppContext = createContext<MiniAppContextValue | null>(null)

function getTelegramWebApp() {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [initData, setInitData] = useState('')
  const [session, setSession] = useState<MiniAppSession | null>(null)
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

  const miniAppFetch = useMemo(() => {
    return async (path: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers)
      if (initData) headers.set('X-Telegram-Init-Data', initData)
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
      return fetch(path, { ...options, headers })
    }
  }, [initData])

  const refreshSession = async () => {
    if (!initData) return
    const res = await miniAppFetch('/api/telegram/mini-app/me')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Failed to load session')
      setSession(null)
      return
    }
    setError(null)
    setSession(data)
  }

  useEffect(() => {
    if (!ready || !initData) return
    void refreshSession()
  }, [ready, initData]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ ready, initData, session, error, refreshSession, miniAppFetch }),
    [ready, initData, session, error, miniAppFetch],
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
