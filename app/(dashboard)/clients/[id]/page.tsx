'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { formatBillingCycle } from '@/lib/billing'
import { formatRenewalTiming, RENEWAL_DAYS_BEFORE_EXPIRY_OPTIONS } from '@/lib/clients'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { formatCurrency, daysUntil } from '@/lib/utils'
import type { TransactionRow } from '@/components/transactions/TransactionEditModal'
import { productTypeBadgeClass } from '@/lib/product-badges'
import { formatReminderLogMessage } from '@/lib/reminder-log-display'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/payment-methods'
import { toast } from '@/lib/toast'
import {
  clearJsonCache,
  clientProfileApiUrl,
  getJsonCache,
  setJsonCache,
} from '@/lib/list-cache'

const OrderFormModal = dynamic(() => import('@/components/orders/OrderFormModal'), { ssr: false })
const ServiceFormModal = dynamic(() => import('@/components/services/ServiceFormModal'), { ssr: false })
const InvoiceFormModal = dynamic(() => import('@/components/invoices/InvoiceFormModal'), { ssr: false })
const RecordPaymentModal = dynamic(() => import('@/components/invoices/RecordPaymentModal'), { ssr: false })
const TransactionEditModal = dynamic(
  () => import('@/components/transactions/TransactionEditModal'),
  { ssr: false },
)

const invoiceStatusColors: Record<string, string> = {
  PAID: 'badge-paid',
  UNPAID: 'badge-unpaid',
  OVERDUE: 'badge-overdue',
  CANCELLED: 'badge-domain',
}

function clientFormFromData(data: {
  name: string
  email: string
  phone?: string | null
  company?: string | null
  companyKhmer?: string | null
  address?: string | null
  vatTin?: string | null
  telegramId?: string | null
  notes?: string | null
  renewalDaysBeforeExpiry?: number | null
}) {
  return {
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    company: data.company || '',
    companyKhmer: data.companyKhmer || '',
    address: data.address || '',
    vatTin: data.vatTin || '',
    telegramId: data.telegramId || '',
    notes: data.notes || '',
    renewalDaysBeforeExpiry: data.renewalDaysBeforeExpiry ?? 14,
  }
}

export default function ClientProfilePage() {
  const { formatDate, formatDateTime } = useAppSettings()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    companyKhmer: '',
    address: '',
    vatTin: '',
    telegramId: '',
    notes: '',
    renewalDaysBeforeExpiry: 14,
  })
  const [telegramConnect, setTelegramConnect] = useState<{
    link: string
    botUsername: string
    connected: boolean
    telegramId: string | null
  } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)
  const [generatingRenewals, setGeneratingRenewals] = useState(false)
  const [editService, setEditService] = useState<any>(null)
  const [editInvoice, setEditInvoice] = useState<any>(null)
  const [editTransaction, setEditTransaction] = useState<TransactionRow | null>(null)
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])

  const loadTransactions = async () => {
    const res = await fetch(`/api/transactions?clientId=${id}&page=1&pageSize=100`)
    if (!res.ok) {
      setTransactions([])
      return
    }
    const data = await res.json()
    setTransactions(data.items || [])
  }

  const load = async () => {
    const apiUrl = clientProfileApiUrl(id)
    const cached = getJsonCache<any>(apiUrl)
    if (cached) {
      setClient(cached)
      setForm(clientFormFromData(cached))
      setLoading(false)
      setRefreshing(true)
      loadTransactions()
    } else {
      setLoading(true)
    }

    try {
      const res = await fetch(apiUrl)
      if (!res.ok) {
        if (!cached) setClient(null)
        return
      }
      const data = await res.json()
      setClient(data)
      setForm(clientFormFromData(data))
      setJsonCache(apiUrl, data)
      loadTransactions()
    } catch {
      if (!cached) setClient(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadTelegramConnect = async () => {
    const res = await fetch(`/api/telegram/connect/${id}`)
    if (res.ok) setTelegramConnect(await res.json())
    else setTelegramConnect(null)
  }

  useEffect(() => {
    if (!id) return
    load()
    loadTelegramConnect()
  }, [id])

  const copyConnectLink = async () => {
    if (!telegramConnect?.link) return
    await navigator.clipboard.writeText(telegramConnect.link)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const generateRenewalInvoices = async () => {
    setGeneratingRenewals(true)
    try {
      const res = await fetch(`/api/clients/${id}/generate-invoices`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate invoices')

      if (data.created > 0) {
        const numbers = (data.invoices || []).map((i: { invoiceNo: string }) => i.invoiceNo).join(', ')
        toast.success(
          data.created === 1
            ? `Renewal invoice ${numbers} created.`
            : `${data.created} renewal invoices created: ${numbers}`,
        )
        load()
        return
      }

      if (data.tooEarly > 0 && data.skipped === 0) {
        toast.message('No services are in the auto-invoice window yet (expiry is still too far out).')
      } else if (data.skipped > 0) {
        toast.message('Eligible services already have open renewal invoices.')
      } else if (data.processed === 0) {
        toast.message('No active recurring services to invoice.')
      } else {
        toast.message('Nothing to invoice right now.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate invoices')
    } finally {
      setGeneratingRenewals(false)
    }
  }

  const generateInvoice = async (s: any) => {
    if (!await toast.confirm(`Generate invoice for "${s.name}"?`)) return
    const sendInvoice = await toast.confirm('Also send invoice to client (email + Telegram)?')
    setGeneratingInvoiceId(s.id)
    try {
      const res = await fetch(`/api/services/${s.id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendInvoice }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate invoice')
      const parts = [`Invoice ${data.invoice.invoiceNo} created.`]
      if (sendInvoice) {
        const sent = data.invoiceSent
        if (sent?.email || sent?.telegram) parts.push('Sent to client.')
        else if (sent?.errors?.length) parts.push(`Send issues: ${sent.errors.join(', ')}`)
      }
      toast.success(parts.join(' '))
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate invoice')
    } finally {
      setGeneratingInvoiceId(null)
    }
  }

  const saveClient = async () => {
    if (!form.name || !form.email) return toast.error('Name and email are required')
    await fetch(`/api/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowEditModal(false)
    load()
  }

  const openRecordPayment = (inv: { id: string; invoiceNo: string; total: number; status?: string }) => {
    setPaymentInvoice(inv)
  }

  const deleteService = async (s: { id: string; name: string }) => {
    if (!await toast.confirm(`Delete service "${s.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/services/${s.id}`, { method: 'DELETE' })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to delete service')
      toast.success('Service deleted')
      load()
    } catch {
      toast.error('Failed to delete service')
    }
  }

  const deleteInvoice = async (inv: { id: string; invoiceNo: string; status: string }) => {
    const message = inv.status === 'PAID'
      ? `Delete ${inv.invoiceNo}? This removes the payment record and rolls back linked service dates.`
      : `Delete ${inv.invoiceNo}? This cannot be undone.`
    if (!await toast.confirm(message)) return
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to delete invoice')
      toast.success('Invoice deleted')
      load()
    } catch {
      toast.error('Failed to delete invoice')
    }
  }

  const markUnpaid = async (inv: { id: string; invoiceNo: string }) => {
    const confirmed = await toast.confirm(
      `Mark ${inv.invoiceNo} as unpaid? It will be removed from transactions and linked services will roll back one billing cycle.`,
    )
    if (!confirmed) return
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'UNPAID' }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to mark invoice as unpaid')
      toast.success('Invoice marked as unpaid')
      load()
    } catch {
      toast.error('Failed to mark invoice as unpaid')
    }
  }

  const viewPDF = (inv: { id: string }) => {
    window.open(`/api/invoices/${inv.id}/pdf?inline=1`, '_blank', 'noopener,noreferrer')
  }

  const sendEmail = async (inv: { id: string; clientId?: string }) => {
    try {
      const res = await fetch('/api/reminders/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: inv.clientId || id, type: 'invoice', invoiceId: inv.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Email send failed')
      toast.success(`Invoice email sent to ${client?.email}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Email send failed')
    }
  }

  const sendTelegram = async (inv: { id: string; clientId?: string }) => {
    const res = await fetch('/api/reminders/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: inv.clientId || id, type: 'invoice', invoiceId: inv.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error(data.error || 'Telegram send failed')
    toast.success(`Invoice PDF sent to ${client?.name} via Telegram`)
  }

  if (loading && !client) {
    return <div className="page-content text-gray-500 dark:text-gray-400">Loading client profile...</div>
  }

  if (!client) {
    return (
      <div className="page-content">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Client not found.</p>
        <Link href="/clients" className="btn-secondary">← Back to Clients</Link>
      </div>
    )
  }

  const initials = client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const activeServices = client.services?.filter((s: any) => s.status === 'ACTIVE').length || 0
  const unpaidInvoices = client.invoices?.filter((i: any) => i.status === 'UNPAID' || i.status === 'OVERDUE') || []
  const paidInvoices = client.invoices?.filter((i: any) => i.status === 'PAID') || []
  const unpaidTotal = unpaidInvoices.reduce((sum: number, i: any) => sum + i.total, 0)
  const paidTotal = paidInvoices.reduce((sum: number, i: any) => sum + i.total, 0)
  const invoicedTotal = client.invoices?.reduce((sum: number, i: any) => sum + i.total, 0) || 0
  return (
    <div className={`page-content${refreshing ? ' opacity-80 transition-opacity' : ''}`}>
      <div className="mb-4">
        <Link href="/clients" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-400">← Clients</Link>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-lg font-semibold flex-shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{client.name}</h1>
              {(client.companyKhmer || client.company) && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {client.companyKhmer && <p>{client.companyKhmer}</p>}
                  {client.company && <p>{client.company}</p>}
                </div>
              )}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                <div><span className="text-gray-400 dark:text-gray-500">Email:</span> {client.email}</div>
                <div><span className="text-gray-400 dark:text-gray-500">Phone:</span> {client.phone || '—'}</div>
                <div><span className="text-gray-400 dark:text-gray-500">Address:</span> {client.address || '—'}</div>
                <div><span className="text-gray-400 dark:text-gray-500">VAT TIN:</span> {client.vatTin || '—'}</div>
                <div>
                  <span className="text-gray-400 dark:text-gray-500">Telegram:</span>{' '}
                  {client.telegramId ? (
                    <span className="text-green-700 dark:text-green-300">Connected ({client.telegramId})</span>
                  ) : (
                    <span className="text-orange-600 dark:text-orange-400">Not connected</span>
                  )}
                </div>
                <div><span className="text-gray-400 dark:text-gray-500">Joined:</span> {formatDate(client.createdAt)}</div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-gray-400 dark:text-gray-500">Invoice & Reminder:</span>{' '}
                  {formatRenewalTiming(client.renewalDaysBeforeExpiry ?? 14)}
                </div>
              </div>
              {client.notes && (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">{client.notes}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary" onClick={() => setShowOrderModal(true)}>Add Order</button>
            <button
              className="btn-primary"
              onClick={generateRenewalInvoices}
              disabled={generatingRenewals}
            >
              {generatingRenewals ? 'Generating…' : 'Generate Invoices'}
            </button>
            <button className="btn-secondary" onClick={() => setShowEditModal(true)}>Edit Client</button>
            <button
              className="btn-danger"
              onClick={async () => {
                if (!await toast.confirm('Delete this client and all their data?')) return
                clearJsonCache(clientProfileApiUrl(id))
                await fetch(`/api/clients/${id}`, { method: 'DELETE' })
                router.push('/clients')
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Invoiced', value: formatCurrency(invoicedTotal), sub: `${client.invoices?.length || 0} invoices` },
          { label: 'Total Paid', value: formatCurrency(paidTotal), sub: `${paidInvoices.length} payments` },
          { label: 'Outstanding', value: formatCurrency(unpaidTotal), sub: `${unpaidInvoices.length} unpaid` },
          { label: 'Active Services', value: activeServices, sub: `${client.services?.length || 0} total` },
        ].map(stat => (
          <div key={stat.label} className="card p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1">{stat.value}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Telegram Notifications</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Send your client this link. When they tap Start in Telegram, their Chat ID is saved automatically.
            </p>
          </div>
          {client.telegramId && (
            <span className="badge badge-active">Connected</span>
          )}
        </div>
        {telegramConnect ? (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input className="input font-mono text-xs" readOnly value={telegramConnect.link} />
              <button className="btn-secondary whitespace-nowrap" onClick={copyConnectLink}>
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Bot: @{telegramConnect.botUsername}
              {client.telegramId && (
                <span className="text-green-700 dark:text-green-300 ml-2">· Chat ID {client.telegramId}</span>
              )}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-orange-600 dark:text-orange-400">
            Telegram bot not configured. Add TELEGRAM_BOT_TOKEN in Settings, then register the webhook.
          </p>
        )}
      </div>

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Services</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">{client.services?.length || 0} total</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Service</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Billing</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Renewal Date</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!client.services?.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No services yet</td></tr>
            )}
            {client.services?.map((s: any) => {
              const d = daysUntil(s.expiryDate)
              return (
                <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                    {s.productPackage && <div className="text-xs text-gray-400 dark:text-gray-500">{s.productPackage.name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${productTypeBadgeClass(s.productType?.color)}`}>{s.productType?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatBillingCycle(s.period, s.recurring)}</td>
                  <td className="px-4 py-3">
                    <div className={d < 0 ? 'text-red-600 dark:text-red-400' : d < 30 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}>
                      {formatDate(s.expiryDate)}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatCurrency(s.price)}</div>
                    {s.setupFee > 0 && <div className="text-xs text-gray-400 dark:text-gray-500">+{formatCurrency(s.setupFee)} setup</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-expired'}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button className="btn-secondary py-1 px-2 text-xs" onClick={() => setEditService(s)}>Edit</button>
                      <button
                        className="btn-secondary py-1 px-2 text-xs"
                        disabled={generatingInvoiceId === s.id}
                        onClick={() => generateInvoice(s)}
                      >
                        {generatingInvoiceId === s.id ? '...' : 'Invoice'}
                      </button>
                      <button className="btn-danger py-1 px-2 text-xs" onClick={() => deleteService(s)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Invoices</h2>
          <Link href="/invoices" className="text-xs text-blue-700 dark:text-blue-300 hover:underline">View all invoices →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice Date</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Due Date</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!client.invoices?.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No invoices yet</td></tr>
            )}
            {client.invoices?.map((inv: any) => (
              <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{inv.invoiceNo}</td>
                <td className="px-4 py-3 font-medium">
                  <div>{formatCurrency(inv.total)}</div>
                  {inv.amountPaid > 0 && inv.status !== 'PAID' && (
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      Paid {formatCurrency(inv.amountPaid)} · {formatCurrency(inv.total - inv.amountPaid)} due
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(inv.createdAt)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(inv.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${invoiceStatusColors[inv.status] || 'badge-unpaid'}`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => setEditInvoice(inv)}>Edit</button>
                    {inv.status !== 'PAID' && (
                      <button className="btn-secondary py-1 px-2 text-xs" onClick={() => openRecordPayment(inv)}>Pay</button>
                    )}
                    {inv.status === 'PAID' && (
                      <button className="btn-secondary py-1 px-2 text-xs" onClick={() => markUnpaid(inv)}>Unpaid</button>
                    )}
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => viewPDF(inv)}>PDF</button>
                    <button className="btn-danger py-1 px-2 text-xs" onClick={() => deleteInvoice(inv)}>Delete</button>
                    <button
                      className="btn-secondary inline-flex items-center justify-center p-1.5"
                      onClick={() => sendEmail(inv)}
                      title="Send via email"
                      aria-label="Send via email"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      className="btn-secondary inline-flex items-center justify-center p-1.5 text-sky-600 dark:text-sky-400"
                      onClick={() => sendTelegram(inv)}
                      title="Send via Telegram"
                      aria-label="Send via Telegram"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Transactions</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">{transactions.length} payment{transactions.length === 1 ? '' : 's'}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Paid Date</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Method</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice Date</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {!transactions.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No payments recorded yet</td></tr>
            )}
            {transactions.map((tx: any) => (
              <tr key={tx.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(tx.paidAt || tx.updatedAt)}</td>
                <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{tx.invoiceNo}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {tx.paymentMethod
                    ? PAYMENT_METHOD_LABELS[tx.paymentMethod as PaymentMethod]
                    : '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-green-700 dark:text-green-400">{formatCurrency(tx.amount ?? tx.total)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(tx.createdAt)}</td>
                <td className="px-4 py-3">
                  <button
                    className="btn-secondary py-1 px-2 text-xs"
                    onClick={() => setEditTransaction({
                      id: tx.id,
                      invoiceId: tx.invoiceId,
                      invoiceNo: tx.invoiceNo,
                      amount: tx.amount,
                      total: tx.amount ?? tx.total,
                      paymentMethod: tx.paymentMethod,
                      isLegacy: tx.isLegacy,
                      createdAt: tx.createdAt,
                      paidAt: tx.paidAt,
                      updatedAt: tx.updatedAt,
                      client: { name: client.name, email: client.email },
                    })}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {client.reminderLogs?.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Communications</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {client.reminderLogs.map((log: any) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{formatReminderLogMessage(log)}</span>
                  <span className="text-gray-400 dark:text-gray-500 mx-2">via</span>
                  <span className="text-gray-600 dark:text-gray-300">{log.channel}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {log.createdAtDisplay || formatDateTime(log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <OrderFormModal
        open={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        onSaved={load}
        defaultClientId={client.id}
        defaultClientName={client.name}
      />

      <ServiceFormModal
        open={Boolean(editService)}
        onClose={() => setEditService(null)}
        onSaved={load}
        service={editService}
        defaultClientId={client.id}
        defaultClientName={client.name}
        lockClient
      />

      <InvoiceFormModal
        open={Boolean(editInvoice)}
        onClose={() => setEditInvoice(null)}
        onSaved={load}
        invoice={editInvoice}
        defaultClientId={client.id}
        lockClient
      />

      <RecordPaymentModal
        open={Boolean(paymentInvoice)}
        invoice={paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        onSaved={load}
      />

      <TransactionEditModal
        open={Boolean(editTransaction)}
        transaction={editTransaction}
        onClose={() => setEditTransaction(null)}
        onSaved={load}
      />

      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold">Edit Client</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Full Name *</label>
                <input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="text" className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Email *</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Company (KH)</label>
                <input type="text" className="input" value={form.companyKhmer} onChange={e => setForm(f => ({ ...f, companyKhmer: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Company (EN)</label>
                <input type="text" className="input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <textarea className="input" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="label">VAT TIN</label>
                <input type="text" className="input" value={form.vatTin} onChange={e => setForm(f => ({ ...f, vatTin: e.target.value }))} />
              </div>
              <div>
                <label className="label">Telegram Chat ID (auto-filled via bot link)</label>
                <input type="text" className="input" value={form.telegramId} onChange={e => setForm(f => ({ ...f, telegramId: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="col-span-2 border-t border-gray-100 dark:border-gray-800 pt-4">
                <label className="label">Generate Invoice & Send Reminder</label>
                <select
                  className="input"
                  value={form.renewalDaysBeforeExpiry}
                  onChange={e => setForm(f => ({ ...f, renewalDaysBeforeExpiry: parseInt(e.target.value) }))}
                >
                  {RENEWAL_DAYS_BEFORE_EXPIRY_OPTIONS.map(days => (
                    <option key={days} value={days}>{formatRenewalTiming(days)}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Applies to auto-generated invoices and renewal reminders for this client&apos;s services.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveClient}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
