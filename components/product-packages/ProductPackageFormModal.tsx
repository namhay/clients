'use client'
import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'

type ProductTypeOption = {
  id: string
  name: string
  hasHostingSpecs?: boolean
}

type PackageRecord = {
  id: string
  productTypeId: string
  name: string
  diskSpaceGb?: number | null
  bandwidthGb?: number | null
  emailAccounts?: number | null
  databases?: number | null
  addonDomains?: number | null
  billingType?: string
  priceMonthly?: number
  priceQuarterly?: number
  priceSemiAnnual?: number
  priceYearly?: number
  active?: boolean
  sortOrder?: number
}

type PackageForm = {
  productTypeId: string
  name: string
  billingType: 'RECURRING' | 'ONE_TIME'
  diskSpaceGb: string
  bandwidthGb: string
  emailAccounts: string
  databases: string
  addonDomains: string
  oneTimePrice: string
  priceMonthly: string
  priceQuarterly: string
  priceSemiAnnual: string
  priceYearly: string
  active: boolean
  sortOrder: string
}

const emptyForm = (productTypeId = ''): PackageForm => ({
  productTypeId,
  name: '',
  billingType: 'RECURRING',
  diskSpaceGb: '5',
  bandwidthGb: '50',
  emailAccounts: '5',
  databases: '1',
  addonDomains: '0',
  oneTimePrice: '',
  priceMonthly: '',
  priceQuarterly: '',
  priceSemiAnnual: '',
  priceYearly: '',
  active: true,
  sortOrder: '0',
})

function packageToForm(pkg: PackageRecord): PackageForm {
  return {
    productTypeId: pkg.productTypeId,
    name: pkg.name,
    diskSpaceGb: String(pkg.diskSpaceGb ?? 5),
    bandwidthGb: String(pkg.bandwidthGb ?? 50),
    emailAccounts: String(pkg.emailAccounts ?? 5),
    databases: String(pkg.databases ?? 1),
    addonDomains: String(pkg.addonDomains ?? 0),
    billingType: pkg.billingType === 'ONE_TIME' ? 'ONE_TIME' : 'RECURRING',
    oneTimePrice: pkg.billingType === 'ONE_TIME' ? String(pkg.priceYearly ?? '') : '',
    priceMonthly: String(pkg.priceMonthly ?? ''),
    priceQuarterly: String(pkg.priceQuarterly ?? ''),
    priceSemiAnnual: String(pkg.priceSemiAnnual ?? ''),
    priceYearly: String(pkg.priceYearly ?? ''),
    active: pkg.active ?? true,
    sortOrder: String(pkg.sortOrder ?? 0),
  }
}

type Props = {
  open: boolean
  types: ProductTypeOption[]
  editPackage?: PackageRecord | null
  defaultProductTypeId?: string
  onClose: () => void
  onSaved?: () => void | Promise<void>
}

export default function ProductPackageFormModal({
  open,
  types,
  editPackage = null,
  defaultProductTypeId = '',
  onClose,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<PackageForm>(emptyForm(defaultProductTypeId))

  useEffect(() => {
    if (!open) return
    if (editPackage) {
      setForm(packageToForm(editPackage))
      return
    }
    setForm(emptyForm(defaultProductTypeId || types[0]?.id || ''))
  }, [open, editPackage, defaultProductTypeId, types])

  const selectedType = types.find(t => t.id === form.productTypeId)
  const hasHostingSpecs = selectedType?.hasHostingSpecs

  const save = async () => {
    if (!form.name.trim()) return toast.error('Package name is required')
    if (!form.productTypeId) return toast.error('Product type is required')
    setSaving(true)
    try {
      const method = editPackage ? 'PUT' : 'POST'
      const url = editPackage ? `/api/product-packages/${editPackage.id}` : '/api/product-packages'
      const body: Record<string, unknown> = {
        ...form,
        billingType: form.billingType,
        oneTimePrice: parseFloat(form.oneTimePrice) || 0,
        priceMonthly: parseFloat(form.priceMonthly) || 0,
        priceQuarterly: parseFloat(form.priceQuarterly) || 0,
        priceSemiAnnual: parseFloat(form.priceSemiAnnual) || 0,
        priceYearly: parseFloat(form.priceYearly) || 0,
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
      if (!res.ok) return toast.error(result.error || 'Failed to save package')
      toast.success(editPackage ? 'Package updated' : 'Package created')
      onClose()
      await onSaved?.()
    } catch {
      toast.error('Failed to save package')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-base font-semibold">{editPackage ? 'Edit Package' : 'Add Product Package'}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
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
                    <input type="number" min="0" className="input" value={form[k as keyof PackageForm] as string} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Pricing</h3>
            <div className="mb-3">
              <label className="label">Billing Type</label>
              <select
                className="input max-w-xs"
                value={form.billingType}
                onChange={e => setForm(f => ({
                  ...f,
                  billingType: e.target.value as 'RECURRING' | 'ONE_TIME',
                }))}
              >
                <option value="RECURRING">Recurring</option>
                <option value="ONE_TIME">One-time</option>
              </select>
            </div>
            {form.billingType === 'ONE_TIME' ? (
              <div>
                <label className="label">One-time Price (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input max-w-xs"
                  value={form.oneTimePrice}
                  onChange={e => setForm(f => ({ ...f, oneTimePrice: e.target.value }))}
                  placeholder="e.g. 299"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[['priceMonthly', 'Monthly'], ['priceQuarterly', 'Quarterly'], ['priceSemiAnnual', 'Semi-Annual'], ['priceYearly', 'Annually']].map(([k, l]) => (
                  <div key={k}>
                    <label className="label">{l} (USD)</label>
                    <input type="number" min="0" step="0.01" className="input" value={form[k as keyof PackageForm] as string} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : editPackage ? 'Save Changes' : 'Add Package'}
          </button>
        </div>
      </div>
    </div>
  )
}
