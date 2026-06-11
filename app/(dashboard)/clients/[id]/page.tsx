'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { formatBillingCycle } from '@/lib/billing'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { formatCurrency, daysUntil } from '@/lib/utils'
import type { TransactionRow } from '@/components/transactions/TransactionEditModal'
import { productTypeBadgeClass } from '@/lib/product-badges'
import { formatReminderLogMessage } from '@/lib/reminder-log-display'
import { toast } from '@/lib/toast'

const OrderFormModal = dynamic(() => import('@/components/orders/OrderFormModal'), { ssr: false })
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

export default function ClientProfilePage() {
  const { formatDate, formatDateTime } = useAppSettings()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', companyKhmer: '', address: '', vatTin: '', telegramId: '', notes: '' })
  const [telegramConnect, setTelegramConnect] = useState<{
    link: string
    botUsername: string
    connected: boolean
    telegramId: string | null
  } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null)
  const [generatingRenewals, setGeneratingRenewals] = useState(false)
  const [editTransaction, setEditTransaction] = useState<TransactionRow | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/clients/${id}`)
    if (!res.ok) {
      setClient(null)
      setLoading(false)
      return
    }
    const data = await res.json()
    setClient(data)
    setForm({
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      company: data.company || '',
      companyKhmer: data.companyKhmer || '',
      address: data.address || '',
      vatTin: data.vatTin || '',
      telegramId: data.telegramId || '',
      notes: data.notes || '',
    })
    setLoading(false)
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

  const markPaid = async (invoiceId: string) => {
    await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    })
    load()
  }

  if (loading) {
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
  const transactions = [...paidInvoices].sort((a: any, b: any) => {
    const aDate = new Date(a.paidAt || a.updatedAt).getTime()
    const bDate = new Date(b.paidAt || b.updatedAt).getTime()
    return bDate - aDate
  })

  return (
    <div className="page-content">
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
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Next Due</th>
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
              const dueDate = s.nextDueDate || s.expiryDate
              const d = daysUntil(dueDate)
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
                      {formatDate(dueDate)}
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
                    <button
                      className="btn-secondary py-1 px-2 text-xs"
                      disabled={generatingInvoiceId === s.id}
                      onClick={() => generateInvoice(s)}
                    >
                      {generatingInvoiceId === s.id ? '...' : 'Invoice'}
                    </button>
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
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Due Date</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Items</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {!client.invoices?.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No invoices yet</td></tr>
            )}
            {client.invoices?.map((inv: any) => (
              <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{inv.invoiceNo}</td>
                <td className="px-4 py-3 font-medium">{formatCurrency(inv.total)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(inv.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${invoiceStatusColors[inv.status] || 'badge-unpaid'}`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                  {inv.items?.map((i: any) => i.description).join(', ') || '—'}
                </td>
                <td className="px-4 py-3">
                  {inv.status !== 'PAID' && (
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => markPaid(inv.id)}>Mark Paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Transactions</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">{transactions.length} paid</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Paid Date</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice Date</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {!transactions.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No payments recorded yet</td></tr>
            )}
            {transactions.map((tx: any) => (
              <tr key={tx.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(tx.paidAt || tx.updatedAt)}</td>
                <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{tx.invoiceNo}</td>
                <td className="px-4 py-3 font-semibold text-green-700 dark:text-green-400">{formatCurrency(tx.total)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(tx.createdAt)}</td>
                <td className="px-4 py-3">
                  <button
                    className="btn-secondary py-1 px-2 text-xs"
                    onClick={() => setEditTransaction({
                      id: tx.id,
                      invoiceNo: tx.invoiceNo,
                      total: tx.total,
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
