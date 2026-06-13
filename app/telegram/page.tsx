'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { canMarkPaid, formatMoney, statusBadgeClass, statusLabel, useMiniApp } from '@/components/telegram/MiniAppProvider'

type InvoiceListItem = {
  id: string
  invoiceNo: string
  status: string
  total: number
  dueDate: string
  remaining: number
}

export default function TelegramInvoicesPage() {
  const { ready, session, error, miniAppFetch } = useMiniApp()
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  useEffect(() => {
    if (!ready || !session?.linked) {
      setLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      const res = await miniAppFetch('/api/telegram/mini-app/invoices')
      const data = await res.json().catch(() => ({}))
      if (cancelled) return
      if (!res.ok) {
        setLoadError(data.error || 'Failed to load invoices')
        setInvoices([])
        setLoading(false)
        return
      }
      setInvoices((data.invoices || []) as InvoiceListItem[])
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [ready, session?.linked, miniAppFetch])

  const visibleInvoices = useMemo(
    () => (filter === 'open' ? invoices.filter(inv => canMarkPaid(inv.status)) : invoices),
    [invoices, filter],
  )

  const openCount = useMemo(
    () => invoices.filter(inv => canMarkPaid(inv.status)).length,
    [invoices],
  )

  if (!ready) {
    return <Shell><LoadingState message="Starting..." /></Shell>
  }

  if (error && !session) {
    return (
      <Shell>
        <EmptyState
          title="Telegram only"
          message={error}
        />
      </Shell>
    )
  }

  if (session && !session.linked) {
    return (
      <Shell companyName={session.companyName}>
        <EmptyState
          title="Account not linked"
          message="Ask your account manager for your personal Telegram connect link, open it in this bot, and tap Start. Then reopen this menu."
        />
      </Shell>
    )
  }

  return (
    <Shell companyName={session?.companyName} clientName={session?.client?.name}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Your invoices</h2>
          <p className="text-sm tg-muted">
            {filter === 'open' ? `${openCount} open invoice(s)` : 'All invoices'}
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <FilterButton active={filter === 'open'} onClick={() => setFilter('open')}>Open</FilterButton>
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterButton>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading invoices..." />
      ) : loadError ? (
        <EmptyState title="Could not load" message={loadError} />
      ) : visibleInvoices.length === 0 ? (
        <EmptyState
          title={filter === 'open' ? 'All caught up' : 'No invoices yet'}
          message={filter === 'open' ? 'You have no unpaid invoices right now.' : 'Invoices sent to you will appear here.'}
        />
      ) : (
        <div className="space-y-3">
          {visibleInvoices.map(invoice => (
            <Link
              key={invoice.id}
              href={`/telegram/invoices/${invoice.id}`}
              className="block tg-card rounded-xl p-4 active:opacity-80 transition-opacity"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{invoice.invoiceNo}</p>
                  <p className="text-sm tg-muted mt-1">Due {invoice.dueDate}</p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(invoice.status)}`}>
                  {statusLabel(invoice.status)}
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-xl font-bold">{formatMoney(invoice.total)}</p>
                {canMarkPaid(invoice.status) && invoice.remaining > 0 && (
                  <p className="text-sm tg-muted">{formatMoney(invoice.remaining)} due</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  )
}

function Shell({
  children,
  companyName,
  clientName,
}: {
  children: React.ReactNode
  companyName?: string
  clientName?: string
}) {
  return (
    <main className="max-w-lg mx-auto px-4 py-5 pb-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide tg-muted">{companyName || 'Billing'}</p>
        <h1 className="text-2xl font-bold mt-1">{clientName ? `Hello, ${clientName}` : 'My Invoices'}</h1>
      </header>
      {children}
    </main>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium ${active ? 'tg-btn-primary' : 'tg-btn-secondary'}`}
    >
      {children}
    </button>
  )
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="tg-card rounded-xl p-8 text-center">
      <p className="tg-muted">{message}</p>
    </div>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="tg-card rounded-xl p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm tg-muted mt-2">{message}</p>
    </div>
  )
}
