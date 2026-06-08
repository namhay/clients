'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { productTypeBadgeClass } from '@/lib/product-badges'

const emptyForm = (productTypeId = '') => ({
  productTypeId,
  name: '',
  description: '',
  diskSpaceGb: '5',
  bandwidthGb: '50',
  emailAccounts: '5',
  databases: '1',
  addonDomains: '0',
  priceMonthly: '',
  priceQuarterly: '',
  priceSemiAnnual: '',
  priceYearly: '',
  setupFee: '',
  active: true,
  sortOrder: '0',
})

export default function ProductPackagesPage() {
  const searchParams = useSearchParams()
  const [types, setTypes] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const selectedType = types.find(t => t.id === (form.productTypeId || typeFilter))
  const hasHostingSpecs = selectedType?.hasHostingSpecs

  const loadTypes = async () => {
    const res = await fetch('/api/product-types')
    if (res.ok) setTypes(await res.json())
  }

  const load = async () => {
    setLoading(true)
    try {
      const url = typeFilter
        ? `/api/product-packages?productTypeId=${typeFilter}`
        : '/api/product-packages'
      const res = await fetch(url)
      if (!res.ok) {
        setPackages([])
        return
      }
      setPackages(await res.json())
    } catch {
      setPackages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTypes().then(() => {
      const fromUrl = searchParams.get('productTypeId')
      if (fromUrl) setTypeFilter(fromUrl)
    })
  }, [searchParams])

  useEffect(() => { load() }, [typeFilter])

  const openAdd = () => {
    setEditId(null)
    setForm(emptyForm(typeFilter || types[0]?.id || ''))
    setShowModal(true)
  }

  const openEdit = (p: any) => {
    setEditId(p.id)
    setForm({
      productTypeId: p.productTypeId,
      name: p.name,
      description: p.description || '',
      diskSpaceGb: String(p.diskSpaceGb ?? 5),
      bandwidthGb: String(p.bandwidthGb ?? 50),
      emailAccounts: String(p.emailAccounts ?? 5),
      databases: String(p.databases ?? 1),
      addonDomains: String(p.addonDomains ?? 0),
      priceMonthly: String(p.priceMonthly),
      priceQuarterly: String(p.priceQuarterly),
      priceSemiAnnual: String(p.priceSemiAnnual),
      priceYearly: String(p.priceYearly),
      setupFee: String(p.setupFee),
      active: p.active,
      sortOrder: String(p.sortOrder),
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) return alert('Package name is required')
    if (!form.productTypeId) return alert('Product type is required')
    setSaving(true)
    try {
      const method = editId ? 'PUT' : 'POST'
      const url = editId ? `/api/product-packages/${editId}` : '/api/product-packages'
      const body: Record<string, unknown> = {
        ...form,
        priceMonthly: parseFloat(form.priceMonthly) || 0,
        priceQuarterly: parseFloat(form.priceQuarterly) || 0,
        priceSemiAnnual: parseFloat(form.priceSemiAnnual) || 0,
        priceYearly: parseFloat(form.priceYearly) || 0,
        setupFee: parseFloat(form.setupFee) || 0,
        sortOrder: parseInt(form.sortOrder) || 0,
      }
      if (hasHostingSpecs) {
        body.diskSpaceGb = parseInt(form.diskSpaceGb) || 0
        body.bandwidthGb = parseInt(form.bandwidthGb) || 0
        body.emailAccounts = parseInt(form.emailAccounts) || 0
        body.databases = parseInt(form.databases) || 0
        body.addonDomains = parseInt(form.addonDomains) || 0
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return alert(result.error || 'Failed to save package')
      setShowModal(false)
      setEditId(null)
      await load()
    } catch {
      alert('Failed to save package')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    const res = await fetch(`/api/product-packages/${id}`, { method: 'DELETE' })
    const result = await res.json()
    if (!res.ok) return alert(result.error || 'Failed to delete')
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Product Packages</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage plans and pricing for each product type</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Package
        </button>
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${!typeFilter ? 'bg-blue-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            All
          </button>
          {types.map(t => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${typeFilter === t.id ? 'bg-blue-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Package</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Details</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Monthly</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Yearly</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Setup</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Services</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>}
            {!loading && packages.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No packages yet</td></tr>
            )}
            {packages.map(p => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <span className={`badge ${productTypeBadgeClass(p.productType?.color)}`}>
                    {p.productType?.name || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                  {p.description && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{p.description}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                  {p.productType?.hasHostingSpecs
                    ? `${p.diskSpaceGb}GB · ${p.bandwidthGb}GB BW · ${p.emailAccounts} emails`
                    : '—'}
                </td>
                <td className="px-4 py-3">{formatCurrency(p.priceMonthly)}</td>
                <td className="px-4 py-3">{formatCurrency(p.priceYearly)}</td>
                <td className="px-4 py-3">{p.setupFee > 0 ? formatCurrency(p.setupFee) : '—'}</td>
                <td className="px-4 py-3"><span className="badge badge-hosting">{p._count?.services || 0}</span></td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.active ? 'badge-active' : 'badge-expired'}`}>
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn-danger py-1 px-2 text-xs" onClick={() => del(p.id, p.name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="text-base font-semibold">{editId ? 'Edit Package' : 'Add Product Package'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Product Type *</label>
                  <select
                    className="input"
                    value={form.productTypeId}
                    onChange={e => setForm(f => ({ ...f, productTypeId: e.target.value }))}
                  >
                    <option value="">Select type...</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Package Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Registration" />
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" />
                </div>
                <div>
                  <label className="label">Sort Order</label>
                  <input type="number" className="input" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.active ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, active: e.target.value === 'active' }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {hasHostingSpecs && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Hosting Resources</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[['diskSpaceGb', 'Disk (GB)'], ['bandwidthGb', 'Bandwidth (GB)'], ['emailAccounts', 'Email Accounts'], ['databases', 'Databases'], ['addonDomains', 'Addon Domains']].map(([k, l]) => (
                      <div key={k}>
                        <label className="label">{l}</label>
                        <input type="number" min="0" className="input" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Pricing by Billing Cycle</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[['priceMonthly', 'Monthly'], ['priceQuarterly', 'Quarterly'], ['priceSemiAnnual', 'Semi-Annual'], ['priceYearly', 'Annually'], ['setupFee', 'Setup Fee']].map(([k, l]) => (
                    <div key={k}>
                      <label className="label">{l} (USD)</label>
                      <input type="number" min="0" step="0.01" className="input" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
