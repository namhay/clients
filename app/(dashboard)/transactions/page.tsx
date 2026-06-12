'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Pagination from '@/components/Pagination'
import type { TransactionRow } from '@/components/transactions/TransactionEditModal'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import {
  REVENUE_PERIOD_LABELS,
  type RevenuePeriod,
  type RevenuePeriodSummary,
} from '@/lib/revenue-periods'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/payment-methods'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'

const TransactionEditModal = dynamic(
  () => import('@/components/transactions/TransactionEditModal'),
  { ssr: false },
)

const PERIOD_CARDS: RevenuePeriod[] = ['today', 'this_week', 'this_month', 'last_month']

const emptySummary = (): RevenuePeriodSummary => ({
  today: { revenue: 0, count: 0 },
  thisWeek: { revenue: 0, count: 0 },
  thisMonth: { revenue: 0, count: 0 },
  lastMonth: { revenue: 0, count: 0 },
})

export default function TransactionsPage() {
  const { formatDate, timezone } = useAppSettings()
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [summary, setSummary] = useState<RevenuePeriodSummary>(emptySummary)
  const [allTime, setAllTime] = useState({ revenue: 0, count: 0 })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editTx, setEditTx] = useState<TransactionRow | null>(null)
  const [periodFilter, setPeriodFilter] = useState<RevenuePeriod>('all')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        period: periodFilter,
        timezone,
      })
      const res = await fetch(`/api/transactions?${params}`)
      if (!res.ok) {
        setTransactions([])
        return
      }
      const data = await res.json()
      setTransactions(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      if (data.summary) setSummary(data.summary)
      if (data.allTime) setAllTime(data.allTime)
    } catch {
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, periodFilter, timezone])

  const downloadPDF = async (inv: TransactionRow) => {
    try {
      const res = await fetch(`/api/invoices/${inv.invoiceId || inv.id}/pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return toast.error(err.error || 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.invoiceNo}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download PDF')
    }
  }

  const periodValue = (period: RevenuePeriod) => {
    switch (period) {
      case 'today':
        return summary.today
      case 'this_week':
        return summary.thisWeek
      case 'this_month':
        return summary.thisMonth
      case 'last_month':
        return summary.lastMonth
      default:
        return allTime
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Transactions</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Payment history including partial and full invoice payments
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {periodFilter === 'all' ? 'All time' : REVENUE_PERIOD_LABELS[periodFilter]}
          </div>
          <div className="text-xl font-semibold text-green-700 dark:text-green-400">
            {formatCurrency(periodFilter === 'all' ? allTime.revenue : periodValue(periodFilter).revenue)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {periodFilter === 'all' ? allTime.count : periodValue(periodFilter).count} payment
            {(periodFilter === 'all' ? allTime.count : periodValue(periodFilter).count) === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => { setPeriodFilter('all'); setPage(1) }}
          className={[
            'rounded-xl border p-4 text-left transition-colors',
            periodFilter === 'all'
              ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
              : 'border-gray-200 bg-white hover:border-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-800',
          ].join(' ')}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">All time</div>
          <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(allTime.revenue)}</div>
          <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{allTime.count} payments</div>
        </button>

        {PERIOD_CARDS.map(period => {
          const { revenue, count } = periodValue(period)
          const active = periodFilter === period
          return (
            <button
              key={period}
              type="button"
              onClick={() => { setPeriodFilter(period); setPage(1) }}
              className={[
                'rounded-xl border p-4 text-left transition-colors',
                active
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                  : 'border-gray-200 bg-white hover:border-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-800',
              ].join(' ')}
            >
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {REVENUE_PERIOD_LABELS[period]}
              </div>
              <div className={`mt-1 text-xl font-semibold ${revenue > 0 ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-gray-100'}`}>
                {formatCurrency(revenue)}
              </div>
              <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {count} payment{count === 1 ? '' : 's'}
              </div>
            </button>
          )
        })}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {periodFilter === 'all' ? 'All payments' : REVENUE_PERIOD_LABELS[periodFilter]}
          </h2>
          {periodFilter !== 'all' && (
            <button
              type="button"
              className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
              onClick={() => { setPeriodFilter('all'); setPage(1) }}
            >
              Clear filter
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Paid Date</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Invoice #</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Client</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Method</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Amount</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Invoice Date</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td>
              </tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  {periodFilter === 'all'
                    ? 'No transactions yet. Mark an invoice as paid to record a payment here.'
                    : `No payments in ${REVENUE_PERIOD_LABELS[periodFilter].toLowerCase()}.`}
                </td>
              </tr>
            )}
            {transactions.map(tx => {
              const paidAt = tx.paidAt || tx.updatedAt || tx.createdAt
              return (
                <tr key={tx.id} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(paidAt)}</td>
                  <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{tx.invoiceNo}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${tx.clientId}`}
                      className="font-medium text-gray-900 hover:text-blue-700 dark:text-gray-100 dark:hover:text-blue-400"
                    >
                      {tx.client?.name || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {tx.paymentMethod
                      ? PAYMENT_METHOD_LABELS[tx.paymentMethod as PaymentMethod]
                      : '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-700 dark:text-green-400">{formatCurrency(tx.amount ?? tx.total)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(tx.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditTx(tx)}>Edit</button>
                      <button className="btn-secondary px-2 py-1 text-xs" onClick={() => downloadPDF(tx)}>PDF</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={25}
          onPageChange={setPage}
          loading={loading}
        />
      </div>

      <TransactionEditModal
        open={Boolean(editTx)}
        transaction={editTx}
        onClose={() => setEditTx(null)}
        onSaved={load}
      />
    </div>
  )
}
