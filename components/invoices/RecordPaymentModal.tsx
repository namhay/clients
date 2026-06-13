'use client'

import { useEffect, useState } from 'react'
import { toPaidDateInput } from '@/lib/invoice-paid-date'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/payment-methods'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'

export type PaymentInvoice = {
  id: string
  invoiceNo: string
  total: number
  status?: string
}

type Props = {
  open: boolean
  invoice: PaymentInvoice | null
  onClose: () => void
  onSaved: () => void
}

export default function RecordPaymentModal({ open, invoice, onClose, onSaved }: Props) {
  const [paidDate, setPaidDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER')
  const [amount, setAmount] = useState('')
  const [amountPaid, setAmountPaid] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [telegramAlert, setTelegramAlert] = useState(true)
  const [emailAlert, setEmailAlert] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !invoice) return

    setPaidDate(toPaidDateInput(new Date()))
    setPaymentMethod('BANK_TRANSFER')
    setTelegramAlert(true)
    setEmailAlert(true)
    setLoading(true)

    fetch(`/api/invoices/${invoice.id}/payments`)
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to load invoice payments')
        setAmountPaid(Number(data.amountPaid) || 0)
        setRemaining(Number(data.remaining) || 0)
        setAmount(String(data.remaining ?? invoice.total))
      })
      .catch((e: Error) => {
        toast.error(e.message || 'Failed to load invoice payments')
        setAmountPaid(0)
        setRemaining(invoice.total)
        setAmount(String(invoice.total))
      })
      .finally(() => setLoading(false))
  }, [open, invoice])

  const save = async () => {
    if (!invoice) return
    if (!paidDate) return toast.error('Payment date is required')
    if (!paymentMethod) return toast.error('Select a payment method')

    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return toast.error('Enter a valid amount')
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidAt: paidDate,
          paymentMethod,
          amount: parsedAmount,
          telegramAlert,
          emailAlert,
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to record payment')

      if (result.fullyPaid) {
        toast.success(`Invoice ${invoice.invoiceNo} marked as paid`)
      } else {
        toast.success(
          `Payment recorded. ${formatCurrency(result.remaining)} remaining on ${invoice.invoiceNo}`,
        )
      }
      onClose()
      onSaved()
    } catch {
      toast.error('Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !invoice) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-base font-semibold">Record Payment</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Invoice #</label>
              <input className="input bg-gray-50 dark:bg-gray-800/50" readOnly value={invoice.invoiceNo} />
            </div>
            <div>
              <label className="label">Payment Date *</label>
              <input
                type="date"
                className="input"
                value={paidDate}
                onChange={e => setPaidDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Invoice Total</label>
              <input className="input bg-gray-50 dark:bg-gray-800/50" readOnly value={formatCurrency(invoice.total)} />
            </div>
            <div>
              <label className="label">Paid So Far</label>
              <input
                className="input bg-gray-50 dark:bg-gray-800/50"
                readOnly
                value={loading ? '...' : formatCurrency(amountPaid)}
              />
            </div>
            <div>
              <label className="label">Remaining</label>
              <input
                className="input bg-gray-50 dark:bg-gray-800/50"
                readOnly
                value={loading ? '...' : formatCurrency(remaining)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Payment Method *</label>
              <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map(method => (
                  <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Defaults to the remaining balance. Partial payments keep the invoice unpaid until fully paid.
          </p>
          <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Client alerts</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={telegramAlert}
                  onChange={e => setTelegramAlert(e.target.checked)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Telegram alert</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={emailAlert}
                  onChange={e => setEmailAlert(e.target.checked)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Email alert</span>
              </label>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Sent when this payment fully pays the invoice. Uncheck to record payment without notifying the client.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
