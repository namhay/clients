import Script from 'next/script'
import type { Metadata, Viewport } from 'next'
import { MiniAppProvider } from '@/components/telegram/MiniAppProvider'
import './telegram.css'

export const metadata: Metadata = {
  title: 'My Invoices',
  description: 'View and manage your invoices',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function TelegramLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <MiniAppProvider>
        <div className="telegram-mini-app min-h-screen">{children}</div>
      </MiniAppProvider>
    </>
  )
}
