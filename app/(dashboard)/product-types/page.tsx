'use client'
import { useEffect, useState } from 'react'
import { PRODUCT_TYPE_COLORS, formatReminderRule } from '@/lib/product-types'
import { productTypeBadgeClass } from '@/lib/product-badges'
import { toast } from '@/lib/toast'

const emptyForm = () => ({
  name: '',
  slug: '',
  color: 'blue',
  hasHostingSpecs: false,
  active: true,
  sortOrder: '0',
  reminderDaysBeforeExpiry: '14',
  reminderTiming: 'BEFORE' as 'BEFORE' | 'AFTER',
  autoInvoiceDaysBeforeExpiry: '14',
})

export default function ProductTypesPage() {
  const [types, setTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/product-types')
      if (!res.ok) {
        setTypes([])
        return
      }
      setTypes(await res.json())
    } catch {
      setTypes([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openAdd = async () => {
    setEditId(null)
    let nextForm = emptyForm()
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        const days = String(data.reminderDays ?? 14)
        nextForm = { ...nextForm, reminderDaysBeforeExpiry: days, autoInvoiceDaysBeforeExpiry: days }
      }
    } catch { /* use defaults */ }
    setForm(nextForm)
    setShowModal(true)
  }

  const openEdit = (t: any) => {
    setEditId(t.id)
    setForm({
      name: t.name,
      slug: t.slug,
      color: t.color || 'blue',
      hasHostingSpecs: t.hasHostingSpecs,
      active: t.active,
      sortOrder: String(t.sortOrder),
      reminderDaysBeforeExpiry: String(t.reminderDaysBeforeExpiry ?? 14),
      reminderTiming: t.reminderTiming === 'AFTER' ? 'AFTER' : 'BEFORE',
      autoInvoiceDaysBeforeExpiry: String(t.autoInvoiceDaysBeforeExpiry ?? 14),
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const method = editId ? 'PUT' : 'POST'
      const url = editId ? `/api/product-types/${editId}` : '/api/product-types'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sortOrder: parseInt(form.sortOrder) || 0,
          reminderDaysBeforeExpiry: parseInt(form.reminderDaysBeforeExpiry) || 14,
          autoInvoiceDaysBeforeExpiry: parseInt(form.autoInvoiceDaysBeforeExpiry) || 14,
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to save')
      setShowModal(false)
      setEditId(null)
      await load()
    } catch {
      toast.error('Failed to save product type')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string, name: string) => {
    if (!await toast.confirm(`Delete product type "${name}"?`)) return
    const res = await fetch(`/api/product-types/${id}`, { method: 'DELETE' })
    const result = await res.json()
    if (!res.ok) return toast.error(result.error || 'Failed to delete')
    load()
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Product Types</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage service categories — Domain, Hosting, SSL, Design, or custom types</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Type
        </button>
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Slug</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Packages</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Services</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Reminder</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Auto Invoice</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>}
            {!loading && types.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No product types yet</td></tr>
            )}
            {types.map(t => (
              <tr key={t.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <span className={`badge ${productTypeBadgeClass(t.color)}`}>{t.name}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3">{t._count?.packages || 0}</td>
                <td className="px-4 py-3">{t._count?.services || 0}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {formatReminderRule(t.reminderDaysBeforeExpiry ?? 14, t.reminderTiming ?? 'BEFORE')}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.autoInvoiceDaysBeforeExpiry ?? 14}d</td>
                <td className="px-4 py-3">
                  <span className={`badge ${t.active ? 'badge-active' : 'badge-expired'}`}>
                    {t.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => openEdit(t)}>Edit</button>
                    <button className="btn-danger py-1 px-2 text-xs" onClick={() => del(t.id, t.name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold">{editId ? 'Edit Product Type' : 'Add Product Type'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Domain" />
              </div>
              <div>
                <label className="label">Slug</label>
                <input className="input font-mono text-sm" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toUpperCase() }))} placeholder="Auto-generated if empty" />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Uppercase code used in filters and API (e.g. DOMAIN)</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Badge Color</label>
                  <select className="input" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}>
                    {PRODUCT_TYPE_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Sort Order</label>
                  <input type="number" className="input" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.active ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, active: e.target.value === 'active' }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Renewal Timing</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Reminder timing</label>
                    <select
                      className="input"
                      value={form.reminderTiming}
                      onChange={e => setForm(f => ({ ...f, reminderTiming: e.target.value as 'BEFORE' | 'AFTER' }))}
                    >
                      <option value="BEFORE">Before due date</option>
                      <option value="AFTER">After due date</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">
                      Reminder alert ({form.reminderTiming === 'AFTER' ? 'days after' : 'days before'} due date)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={form.reminderDaysBeforeExpiry}
                      onChange={e => setForm(f => ({ ...f, reminderDaysBeforeExpiry: e.target.value }))}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      e.g. 14 before expiry, or 5 after overdue
                    </p>
                  </div>
                </div>
                <div>
                  <label className="label">Auto-generate invoice (days before expiry)</label>
                  <input
                    type="number"
                    min="1"
                    className="input max-w-xs"
                    value={form.autoInvoiceDaysBeforeExpiry}
                    onChange={e => setForm(f => ({ ...f, autoInvoiceDaysBeforeExpiry: e.target.value }))}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">When renewal invoice should be created</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Type'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
