'use client'
import { useState } from 'react'
import { PRODUCT_TYPE_COLORS } from '@/lib/product-types'
import { productTypeBadgeClass } from '@/lib/product-badges'
import { useCachedList } from '@/lib/use-cached-list'
import { toast } from '@/lib/toast'

const emptyForm = () => ({
  name: '',
  slug: '',
  color: 'blue',
  hasHostingSpecs: false,
  active: true,
  sortOrder: '0',
})

export default function ProductTypesPage() {
  const { items: types, initialLoading, refreshing, reload } = useCachedList<any>('/api/product-types')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const openAdd = () => {
    setEditId(null)
    setForm(emptyForm())
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
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to save')
      setShowModal(false)
      setEditId(null)
      await reload()
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
    reload()
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
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className={refreshing ? 'opacity-60 transition-opacity' : undefined}>
            {initialLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>}
            {!initialLoading && types.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No product types yet</td></tr>
            )}
            {types.map(t => (
              <tr key={t.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <span className={`badge ${productTypeBadgeClass(t.color)}`}>{t.name}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3">{t._count?.packages || 0}</td>
                <td className="px-4 py-3">{t._count?.services || 0}</td>
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
