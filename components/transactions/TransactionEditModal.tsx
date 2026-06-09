'use client'

import { useEffect, useState } from 'react'
import { toPaidDateInput } from '@/lib/invoice-paid-date'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'

export type TransactionRow = {
  id: string
  clientId?: string
  invoiceNo: string
  total: number
  createdAt: string
  paidAt?: string | null
  updatedAt?: string
  client?: { name: string; email?: string | null }
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  transaction: TransactionRow | null
}

export default function TransactionEditModal({ open, onClose, onSaved, transaction }: Props) {
  const { formatDate } = useAppSettings()
  const [paidDate, setPaidDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !transaction) return
    setPaidDate(toPaidDateInput(transaction.paidAt || transaction.updatedAt))
  }, [open, transaction])

  const save = async () => {
    if (!transaction) return
    if (!paidDate) return toast.error('Paid date is required')

    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAt: paidDate }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to update paid date')
      toast.success('Payment date updated')
      onClose()
      onSaved()
    } catch {
      toast.error('Failed to update paid date')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !transaction) return null

  const paidAt = transaction.paidAt || transaction.updatedAt

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold">Edit Payment Date</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label">Invoice #</label>
            <input className="input bg-gray-50 dark:bg-gray-800/50" readOnly value={transaction.invoiceNo} />
          </div>
          {transaction.client && (
            <div>
              <label className="label">Client</label>
              <input className="input bg-gray-50 dark:bg-gray-800/50" readOnly value={transaction.client.name} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount</label>
              <input className="input bg-gray-50 dark:bg-gray-800/50" readOnly value={formatCurrency(transaction.total)} />
            </div>
            <div>
              <label className="label">Invoice Date</label>
              <input className="input bg-gray-50 dark:bg-gray-800/50" readOnly value={formatDate(transaction.createdAt)} />
            </div>
          </div>
          <div>
            <label className="label">Paid Date *</label>
            <input
              type="date"
              className="input"
              value={paidDate}
              onChange={e => setPaidDate(e.target.value)}
            />
            {paidAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Currently recorded: {formatDate(paidAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
