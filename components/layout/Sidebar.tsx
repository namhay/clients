'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { prefetchJson, prefetchList, CLIENTS_ALL_URL, CLIENTS_PAGE_1_URL, PRODUCT_TYPES_ACTIVE_URL, PRODUCT_TYPES_URL } from '@/lib/list-cache'

const navItems = [
  { href: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/clients', label: 'Clients', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/services', label: 'Services', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
  { href: '/product-types', label: 'Product Types', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
  { href: '/product-packages', label: 'Product Packages', icon: 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z M9 11h6M9 15h4' },
  { href: '/orders', label: 'Orders', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/invoices', label: 'Invoices', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/transactions', label: 'Transactions', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/reminders', label: 'Reminders', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { href: '/reports', label: 'Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const prefetchListByHref: Record<string, string> = {
  '/clients': CLIENTS_PAGE_1_URL,
  '/services': '/api/services?page=1',
  '/orders': '/api/orders?page=1',
  '/invoices': '/api/invoices?page=1',
  '/transactions': '/api/transactions?page=1&period=all',
  '/product-types': PRODUCT_TYPES_URL,
  '/product-packages': '/api/product-packages',
}

const prefetchExtraListByHref: Record<string, string[]> = {
  '/invoices': [CLIENTS_ALL_URL],
  '/services': [PRODUCT_TYPES_ACTIVE_URL],
  '/orders': [CLIENTS_ALL_URL, PRODUCT_TYPES_ACTIVE_URL],
}

const prefetchJsonByHref: Record<string, string> = {
  '/': '/api/dashboard',
  '/reminders': '/api/reminders?logPage=1',
  '/reports': '/api/reports',
  '/settings': '/api/settings',
}

type SidebarProps = {
  mobileOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const [logoUrl, setLogoUrl] = useState('/invoice-logo.png')
  const initials = session?.user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

  useEffect(() => {
    fetch('/api/settings/branding')
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.assets) return
        const logo = data.assets.find((a: { key: string; url: string }) => a.key === 'logo')
        if (logo?.url) setLogoUrl(logo.url)
      })
      .catch(() => {})
  }, [])

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut({ redirect: false })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-50 flex h-screen w-[min(280px,85vw)] flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-out dark:border-gray-800 dark:bg-gray-900',
        'lg:static lg:z-auto lg:w-[220px] lg:min-w-[220px] lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ].join(' ')}
    >
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
        <Link href="/" className="flex min-w-0 flex-1 items-center" onClick={onClose}>
          <img
            src={logoUrl}
            alt="IT SMART"
            className="h-16 w-full max-w-[200px] object-contain object-left"
          />
        </Link>
        <button
          type="button"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 lg:hidden"
          aria-label="Close menu"
          onClick={onClose}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onMouseEnter={() => {
                const listUrl = prefetchListByHref[item.href]
                if (listUrl) void prefetchList(listUrl)
                for (const url of prefetchExtraListByHref[item.href] || []) {
                  void prefetchList(url)
                }
                const jsonUrl = prefetchJsonByHref[item.href]
                if (jsonUrl) void prefetchJson(jsonUrl)
                if (item.href === '/settings') void prefetchJson('/api/settings/branding')
              }}
              onClick={onClose}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'}`}
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-3 border-t border-gray-200 p-3 dark:border-gray-800">
        <ThemeToggle />
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{session?.user?.name}</div>
            <div className="truncate text-xs text-gray-500 dark:text-gray-400">{(session?.user as { role?: string })?.role}</div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="Sign out"
            aria-label="Sign out"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
