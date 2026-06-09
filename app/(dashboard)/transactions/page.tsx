'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { formatCurrency } from '@/lib/utils'

export default function TransactionsPage() {
  const { formatDate, formatDateTime } = useAppSettings()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/transactions')
      if (!res.ok) {
        setTransactions([])
        return
      }
      setTransactions(await res.json())
    } catch {
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const total = transactions.reduce((sum, t) => sum + (t.total || 0), 0)

  const downloadPDF = async (inv: any) => {
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return alert(err.error || 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.invoiceNo}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to download PDF')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Transactions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Payment history from invoices marked as paid
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total received</div>
          <div className="text-xl font-semibold text-green-700 dark:text-green-400">{formatCurrency(total)}</div>
        </div>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Paid Date</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Client</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice Date</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td>
              </tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  No transactions yet. Mark an invoice as paid to record a payment here.
                </td>
              </tr>
            )}
            {transactions.map(tx => {
              const paidAt = tx.paidAt || tx.updatedAt
              return (
                <tr key={tx.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDateTime(paidAt)}</td>
                  <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{tx.invoiceNo}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${tx.clientId}`}
                      className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400"
                    >
                      {tx.client?.name || '—'}
                    </Link>
                    {tx.client?.email && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">{tx.client.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-green-700 dark:text-green-400">{formatCurrency(tx.total)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(tx.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => downloadPDF(tx)}>PDF</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
