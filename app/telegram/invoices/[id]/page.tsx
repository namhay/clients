'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  canMarkPaid,
  formatMoney,
  statusBadgeClass,
  statusLabel,
  useMiniApp,
} from '@/components/telegram/MiniAppProvider'
import { InvoiceDetailSkeleton } from '@/components/telegram/InvoiceListSkeleton'

type InvoiceDetail = {
  id: string
  invoiceNo: string
  status: string
  subtotal: number
  tax: number
  total: number
  dueDate: string
  paidAt: string | null
  amountPaid: number
  remaining: number
  items: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  pdfUrl: string
}

export default function TelegramInvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { ready, home, miniAppFetch } = useMiniApp()
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || !home?.linked || !params.id) {
      setLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const res = await miniAppFetch(`/api/telegram/mini-app/invoices/${params.id}`)
      const data = await res.json().catch(() => ({}))
      if (cancelled) return
      if (!res.ok) {
        setError(data.error || 'Failed to load invoice')
        setLoading(false)
        return
      }
      setInvoice(data.invoice)
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [ready, home?.linked, params.id, miniAppFetch])

  async function handleMarkPaid() {
    if (!invoice || submitting) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const res = await miniAppFetch(`/api/telegram/mini-app/invoices/${invoice.id}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Failed to mark as paid')
      setSubmitting(false)
      return
    }

    setInvoice(data.invoice)
    setSuccess('Thank you! Your payment has been recorded.')
    setSubmitting(false)

    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
  }

  if (!ready || loading) {
    return (
      <PageShell backHref="/telegram">
        <InvoiceDetailSkeleton />
      </PageShell>
    )
  }

  if (home && !home.linked) {
    return (
      <PageShell backHref="/telegram">
        <StateCard message="Account not linked. Connect via your personal Telegram link first." />
      </PageShell>
    )
  }

  if (error && !invoice) {
    return (
      <PageShell backHref="/telegram">
        <StateCard message={error} />
      </PageShell>
    )
  }

  if (!invoice) {
    return (
      <PageShell backHref="/telegram">
        <StateCard message="Invoice not found." />
      </PageShell>
    )
  }

  const payable = canMarkPaid(invoice.status) && invoice.remaining > 0

  return (
    <PageShell backHref="/telegram">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">{invoice.invoiceNo}</h1>
          <p className="text-sm tg-muted mt-1">Due {invoice.dueDate}</p>
        </div>
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClass(invoice.status)}`}>
          {statusLabel(invoice.status)}
        </span>
      </div>

      <div className="tg-card rounded-xl p-4 mb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm tg-muted">Total</p>
            <p className="text-3xl font-bold mt-1">{formatMoney(invoice.total)}</p>
          </div>
          {payable && (
            <div className="text-right">
              <p className="text-sm tg-muted">Remaining</p>
              <p className="text-lg font-semibold mt-1">{formatMoney(invoice.remaining)}</p>
            </div>
          )}
        </div>
        {invoice.paidAt && (
          <p className="text-sm text-green-700 dark:text-green-300 mt-3">Paid on {invoice.paidAt}</p>
        )}
      </div>

      <div className="tg-card rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-200/70 dark:border-gray-700/70 font-medium">Line items</div>
        <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
          {invoice.items.map(item => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-sm tg-muted mt-0.5">
                    {item.quantity} × {formatMoney(item.unitPrice)}
                  </p>
                </div>
                <p className="font-medium">{formatMoney(item.total)}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="px-4 py-3 space-y-1 text-sm border-t border-gray-200/70 dark:border-gray-700/70">
          <Row label="Subtotal" value={formatMoney(invoice.subtotal)} />
          {invoice.tax > 0 && <Row label="Tax" value={formatMoney(invoice.tax)} />}
          <Row label="Total" value={formatMoney(invoice.total)} strong />
        </div>
      </div>

      <a
        href={invoice.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center tg-btn-secondary rounded-xl px-4 py-3 font-medium mb-4"
      >
        View PDF
      </a>

      {success && (
        <div className="rounded-xl bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300 px-4 py-3 mb-4 text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {payable && !success && (
        <div className="tg-card rounded-xl p-4 space-y-3">
          <div>
            <h2 className="font-semibold">Mark as paid</h2>
            <p className="text-sm tg-muted mt-1">
              Tap below after you have sent the bank transfer. We will update your invoice automatically.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="payment-note">Optional note</label>
            <textarea
              id="payment-note"
              className="input min-h-[80px] resize-y"
              placeholder="e.g. Paid via ABA on June 13"
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={500}
            />
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleMarkPaid()}
            className="w-full tg-btn-primary rounded-xl px-4 py-3 font-semibold disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : `I have paid ${formatMoney(invoice.remaining)}`}
          </button>
        </div>
      )}

      {!payable && !success && (
        <button
          type="button"
          onClick={() => router.push('/telegram')}
          className="w-full tg-btn-secondary rounded-xl px-4 py-3 font-medium"
        >
          Back to invoices
        </button>
      )}
    </PageShell>
  )
}

function PageShell({ children, backHref }: { children: React.ReactNode; backHref: string }) {
  return (
    <main className="max-w-lg mx-auto px-4 py-5 pb-8">
      <Link href={backHref} className="inline-flex items-center text-sm tg-link mb-4">
        ← Back
      </Link>
      {children}
    </main>
  )
}

function StateCard({ message }: { message: string }) {
  return (
    <div className="tg-card rounded-xl p-8 text-center">
      <p className="tg-muted">{message}</p>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'font-semibold text-base pt-1' : ''}`}>
      <span className={strong ? '' : 'tg-muted'}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
