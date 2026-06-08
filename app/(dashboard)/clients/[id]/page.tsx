'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { formatBillingCycle } from '@/lib/billing'
import { formatDate, formatCurrency, daysUntil } from '@/lib/utils'
import ServiceFormModal from '@/components/services/ServiceFormModal'
import { productTypeBadgeClass } from '@/lib/product-badges'

const invoiceStatusColors: Record<string, string> = {
  PAID: 'badge-paid',
  UNPAID: 'badge-unpaid',
  OVERDUE: 'badge-overdue',
  CANCELLED: 'badge-domain',
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', address: '', vatTin: '', telegramId: '', notes: '' })
  const [telegramConnect, setTelegramConnect] = useState<{
    link: string
    botUsername: string
    connected: boolean
    telegramId: string | null
  } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

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

  const saveClient = async () => {
    if (!form.name || !form.email) return alert('Name and email are required')
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
    return <div className="p-6 text-gray-500">Loading client profile...</div>
  }

  if (!client) {
    return (
      <div className="p-6">
        <p className="text-gray-500 mb-4">Client not found.</p>
        <Link href="/clients" className="btn-secondary">← Back to Clients</Link>
      </div>
    )
  }

  const initials = client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const activeServices = client.services?.filter((s: any) => s.status === 'ACTIVE').length || 0
  const unpaidInvoices = client.invoices?.filter((i: any) => i.status === 'UNPAID' || i.status === 'OVERDUE') || []
  const unpaidTotal = unpaidInvoices.reduce((sum: number, i: any) => sum + i.total, 0)
  const paidTotal = client.invoices?.filter((i: any) => i.status === 'PAID').reduce((sum: number, i: any) => sum + i.total, 0) || 0

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/clients" className="text-sm text-gray-500 hover:text-blue-700">← Clients</Link>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold flex-shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{client.name}</h1>
              {client.company && <p className="text-sm text-gray-500 mt-0.5">{client.company}</p>}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600">
                <div><span className="text-gray-400">Email:</span> {client.email}</div>
                <div><span className="text-gray-400">Phone:</span> {client.phone || '—'}</div>
                <div><span className="text-gray-400">Address:</span> {client.address || '—'}</div>
                <div><span className="text-gray-400">VAT TIN:</span> {client.vatTin || '—'}</div>
                <div>
                  <span className="text-gray-400">Telegram:</span>{' '}
                  {client.telegramId ? (
                    <span className="text-green-700">Connected ({client.telegramId})</span>
                  ) : (
                    <span className="text-orange-600">Not connected</span>
                  )}
                </div>
                <div><span className="text-gray-400">Joined:</span> {formatDate(client.createdAt)}</div>
              </div>
              {client.notes && (
                <p className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{client.notes}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary" onClick={() => setShowServiceModal(true)}>Add Service</button>
            <button className="btn-secondary" onClick={() => setShowEditModal(true)}>Edit Client</button>
            <button
              className="btn-danger"
              onClick={async () => {
                if (!confirm('Delete this client and all their data?')) return
                await fetch(`/api/clients/${id}`, { method: 'DELETE' })
                router.push('/clients')
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Telegram Notifications</h2>
            <p className="text-xs text-gray-500 mt-1">
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
            <p className="text-xs text-gray-500">
              Bot: @{telegramConnect.botUsername}
              {client.telegramId && (
                <span className="text-green-700 ml-2">· Chat ID {client.telegramId}</span>
              )}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-orange-600">
            Telegram bot not configured. Add TELEGRAM_BOT_TOKEN in Settings, then register the webhook.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Services', value: client.services?.length || 0, sub: `${activeServices} active` },
          { label: 'Invoices', value: client.invoices?.length || 0, sub: `${unpaidInvoices.length} unpaid` },
          { label: 'Outstanding', value: formatCurrency(unpaidTotal), sub: 'unpaid balance' },
          { label: 'Total Paid', value: formatCurrency(paidTotal), sub: 'lifetime' },
        ].map(stat => (
          <div key={stat.label} className="card p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">{stat.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Services</h2>
          <span className="text-xs text-gray-400">{client.services?.length || 0} total</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Service</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Billing</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Next Due</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {!client.services?.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No services yet</td></tr>
            )}
            {client.services?.map((s: any) => {
              const dueDate = s.nextDueDate || s.expiryDate
              const d = daysUntil(dueDate)
              return (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{s.name}</div>
                    {s.productPackage && <div className="text-xs text-gray-400">{s.productPackage.name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${productTypeBadgeClass(s.productType?.color)}`}>{s.productType?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatBillingCycle(s.period, s.recurring)}</td>
                  <td className="px-4 py-3">
                    <div className={d < 0 ? 'text-red-600' : d < 30 ? 'text-orange-600' : 'text-gray-700'}>
                      {formatDate(dueDate)}
                    </div>
                    <div className="text-xs text-gray-400">{d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatCurrency(s.price)}</div>
                    {s.setupFee > 0 && <div className="text-xs text-gray-400">+{formatCurrency(s.setupFee)} setup</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-expired'}`}>{s.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Invoices</h2>
          <Link href="/invoices" className="text-xs text-blue-700 hover:underline">View all invoices →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Invoice #</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Due Date</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Items</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {!client.invoices?.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No invoices yet</td></tr>
            )}
            {client.invoices?.map((inv: any) => (
              <tr key={inv.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-blue-700">{inv.invoiceNo}</td>
                <td className="px-4 py-3 font-medium">{formatCurrency(inv.total)}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(inv.dueDate)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${invoiceStatusColors[inv.status] || 'badge-unpaid'}`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
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

      {client.reminderLogs?.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Communications</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {client.reminderLogs.map((log: any) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-800">{log.type}</span>
                  <span className="text-gray-400 mx-2">via</span>
                  <span className="text-gray-600">{log.channel}</span>
                </div>
                <div className="text-xs text-gray-400">{formatDate(log.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ServiceFormModal
        open={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        onSaved={load}
        defaultClientId={client.id}
        defaultClientName={client.name}
        lockClient
      />

      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold">Edit Client</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {[['name', 'Full Name *', 'text'], ['email', 'Email *', 'email'], ['phone', 'Phone', 'text'], ['company', 'Company', 'text'], ['address', 'Address', 'text'], ['vatTin', 'VAT TIN', 'text'], ['telegramId', 'Telegram Chat ID (auto-filled via bot link)', 'text']].map(([k, l, t]) => (
                <div key={k}>
                  <label className="label">{l}</label>
                  <input type={t} className="input" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveClient}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
