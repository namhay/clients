'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import { AppSettingsProvider } from '@/components/providers/AppSettingsProvider'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileNavOpen])

  return (
    <AppSettingsProvider>
      <div className="flex h-screen overflow-hidden">
        {mobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 lg:hidden">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">ClientDesk</div>
              <div className="truncate text-xs text-gray-500 dark:text-gray-400">Hosting Manager</div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-950">
            {children}
          </main>
        </div>
      </div>
    </AppSettingsProvider>
  )
}
