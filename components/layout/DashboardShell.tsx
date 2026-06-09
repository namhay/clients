'use client'
import Sidebar from '@/components/layout/Sidebar'
import { AppSettingsProvider } from '@/components/providers/AppSettingsProvider'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AppSettingsProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          {children}
        </main>
      </div>
    </AppSettingsProvider>
  )
}
