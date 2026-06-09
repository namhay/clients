'use client'
import { useEffect, useState } from 'react'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'

const statusColors: Record<string, string> = {
  PAID: 'badge-paid',
  UNPAID: 'badge-unpaid',
  OVERDUE: 'badge-overdue',
  CANCELLED: 'badge-domain',
}

const emptyForm = () => ({
  invoiceNo: '',
  clientId: '',
  invoiceDate: '',
  dueDate: '',
  notes: '',
  tax: '0',
  status: 'UNPAID',
  items: [{ description: '', quantity: 1, unitPrice: '', total: 0, periodStart: '', periodEnd: '' }],
})

export default function InvoicesPage() {
  const { formatDate } = useAppSettings()
  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const load = async () => {
    setLoading(true)
    const [invs, cls] = await Promise.all([
      fetch(`/api/invoices${statusFilter ? `?status=${statusFilter}` : ''}`).then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ])
    setInvoices(invs)
    setClients(cls)
    setLoading(false)
  }
  useEffect(() => { load() }, [statusFilter])

  const updateItem = (i: number, field: string, val: unknown) => {
    setForm(f => {
      const items = [...f.items]
      items[i] = { ...items[i], [field]: val }
      if (field === 'unitPrice' || field === 'quantity') {
        items[i].total = (Number(items[i].unitPrice) || 0) * (Number(items[i].quantity) || 1)
      }
      return { ...f, items }
    })
  }

  const openCreate = () => {
    setEditId(null)
    const today = new Date().toISOString().split('T')[0]
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setForm({ ...emptyForm(), invoiceDate: today, dueDate: d.toISOString().split('T')[0] })
    setShowModal(true)
  }

  const openEdit = (inv: any) => {
    setEditId(inv.id)
    setForm({
      invoiceNo: inv.invoiceNo,
      clientId: inv.clientId,
      invoiceDate: new Date(inv.createdAt).toISOString().split('T')[0],
      dueDate: new Date(inv.dueDate).toISOString().split('T')[0],
      notes: inv.notes || '',
      tax: String(inv.tax ?? 0),
      status: inv.status || 'UNPAID',
      items: inv.items?.length
        ? inv.items.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
            total: item.total,
            periodStart: item.periodStart ? new Date(item.periodStart).toISOString().split('T')[0] : '',
            periodEnd: item.periodEnd ? new Date(item.periodEnd).toISOString().split('T')[0] : '',
          }))
        : [{ description: '', quantity: 1, unitPrice: '', total: 0, periodStart: '', periodEnd: '' }],
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.clientId || !form.invoiceDate || !form.dueDate) return toast.error('Select client, invoice date, and due date')
    if (editId && !form.invoiceNo.trim()) return toast.error('Invoice number is required')
    const items = form.items
      .filter(i => i.description)
      .map(i => ({
        description: i.description,
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        total: Number(i.total) || 0,
        ...(i.periodStart ? { periodStart: i.periodStart } : {}),
        ...(i.periodEnd ? { periodEnd: i.periodEnd } : {}),
      }))
    if (!items.length) return toast.error('Add at least one item')

    setSaving(true)
    try {
      const payload = {
        ...form,
        tax: Number(form.tax) || 0,
        items,
        ...(editId && { invoiceNo: form.invoiceNo.trim() }),
      }
      const url = editId ? `/api/invoices/${editId}` : '/api/invoices'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to save invoice')
      toast.success(editId ? 'Invoice updated' : 'Invoice created')
      setShowModal(false)
      setEditId(null)
      load()
    } catch {
      toast.error('Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  const markPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to mark invoice as paid')
      toast.success('Invoice marked as paid')
      load()
    } catch {
      toast.error('Failed to mark invoice as paid')
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

  const viewPDF = (inv: any) => {
    window.open(`/api/invoices/${inv.id}/pdf?inline=1`, '_blank', 'noopener,noreferrer')
  }

  const sendEmail = async (inv: any) => {
    await fetch('/api/reminders/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: inv.clientId, type: 'invoice', invoiceId: inv.id }),
    })
    toast.success(`Invoice email sent to ${inv.client?.email}`)
  }

  const sendTelegram = async (inv: any) => {
    const res = await fetch('/api/reminders/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: inv.clientId, type: 'invoice', invoiceId: inv.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return toast.error(data.error || 'Telegram send failed')
    toast.success(`Invoice PDF sent to ${inv.client?.name} via Telegram`)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Invoices</h1>
        <button className="btn-primary" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create Invoice
        </button>
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex gap-2">
          {['', 'UNPAID', 'PAID', 'OVERDUE'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{s || 'All'}</button>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50"><tr>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice #</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Client</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice Date</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Due Date</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th>
            <th className="px-4 py-2.5">Actions</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>}
            {!loading && invoices.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No invoices found</td></tr>}
            {invoices.map(inv => (
              <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-300">{inv.invoiceNo}</td>
                <td className="px-4 py-3 font-medium">{inv.client?.name}<div className="text-xs text-gray-400 dark:text-gray-500">{inv.client?.email}</div></td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(inv.total)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(inv.createdAt)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(inv.dueDate)}</td>
                <td className="px-4 py-3"><span className={`badge ${statusColors[inv.status] || 'badge-unpaid'}`}>{inv.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => openEdit(inv)}>Edit</button>
                    {inv.status !== 'PAID' && (
                      <button className="btn-secondary py-1 px-2 text-xs" onClick={() => markPaid(inv.id)}>✓ Paid</button>
                    )}
                    {inv.status === 'PAID' && (
                      <button className="btn-secondary py-1 px-2 text-xs" onClick={() => markUnpaid(inv)}>Unpaid</button>
                    )}
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => viewPDF(inv)}>View</button>
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => sendEmail(inv)}>📧</button>
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => sendTelegram(inv)}>✈</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="text-base font-semibold">{editId ? 'Edit Invoice' : 'Create Invoice'}</h2>
              <button onClick={() => { setShowModal(false); setEditId(null) }} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {editId && (
                <div>
                  <label className="label">Invoice Number *</label>
                  <input className="input" value={form.invoiceNo} onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))} placeholder="e.g. 26-043 or INV-0001" />
                </div>
              )}
              <div>
                <label className="label">Client *</label>
                <select className="input" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                  <option value="">Select...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Invoice Date *</label>
                  <input type="date" className="input" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Due Date *</label>
                  <input type="date" className="input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
              {editId && (
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {['UNPAID', 'PAID', 'OVERDUE', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Invoice Items</label>
                <div className="space-y-2">
                  {form.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_60px_80px_80px] gap-2">
                      <input className="input text-xs" placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                      <input type="number" className="input text-xs" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                      <input type="number" className="input text-xs" placeholder="Price" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} />
                      <div className="input text-xs flex items-center text-gray-500 dark:text-gray-400">${(item.total || 0).toFixed(2)}</div>
                    </div>
                  ))}
                  <button className="btn-secondary text-xs py-1" onClick={() => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unitPrice: '', total: 0, periodStart: '', periodEnd: '' }] }))}>+ Add Item</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tax (%)</label>
                  <input type="number" className="input" value={form.tax} onChange={e => setForm(f => ({ ...f, tax: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Bank transfer details..." />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900">
              <button className="btn-secondary" onClick={() => { setShowModal(false); setEditId(null) }}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
