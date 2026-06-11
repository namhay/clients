'use client'
import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'

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

type InvoiceFormModalProps = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  invoice?: any
  defaultClientId?: string
  lockClient?: boolean
}

export default function InvoiceFormModal({
  open,
  onClose,
  onSaved,
  invoice,
  defaultClientId,
  lockClient = false,
}: InvoiceFormModalProps) {
  const editId = invoice?.id ?? null
  const [clients, setClients] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    if (!open) return
    fetch('/api/clients').then(r => r.json()).then(setClients)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (invoice) {
      setForm({
        invoiceNo: invoice.invoiceNo,
        clientId: invoice.clientId,
        invoiceDate: new Date(invoice.createdAt).toISOString().split('T')[0],
        dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
        notes: invoice.notes || '',
        tax: String(invoice.tax ?? 0),
        status: invoice.status || 'UNPAID',
        items: invoice.items?.length
          ? invoice.items.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: String(item.unitPrice),
              total: item.total,
              periodStart: item.periodStart ? new Date(item.periodStart).toISOString().split('T')[0] : '',
              periodEnd: item.periodEnd ? new Date(item.periodEnd).toISOString().split('T')[0] : '',
            }))
          : [{ description: '', quantity: 1, unitPrice: '', total: 0, periodStart: '', periodEnd: '' }],
      })
      return
    }
    const today = new Date().toISOString().split('T')[0]
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setForm({
      ...emptyForm(),
      clientId: defaultClientId || '',
      invoiceDate: today,
      dueDate: d.toISOString().split('T')[0],
    })
  }, [open, invoice, defaultClientId])

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
      onClose()
      onSaved()
    } catch {
      toast.error('Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-base font-semibold">{editId ? 'Edit Invoice' : 'Create Invoice'}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
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
            {lockClient && defaultClientId ? (
              <input className="input bg-gray-50 dark:bg-gray-800" readOnly value={clients.find(c => c.id === defaultClientId)?.name || invoice?.client?.name || ''} />
            ) : (
              <select className="input" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">Select...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
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
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
