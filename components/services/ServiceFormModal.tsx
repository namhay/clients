'use client'
import { useEffect, useState } from 'react'
import { BILLING_CYCLES, calculateBillingDates, toDateInput } from '@/lib/billing'
import { getPackagePrice } from '@/lib/package-pricing'

const emptyForm = () => ({
  clientId: '',
  productTypeId: '',
  productPackageId: '',
  name: '',
  price: '',
  setupFee: '',
  startDate: new Date().toISOString().split('T')[0],
  expiryDate: '',
  nextDueDate: '',
  recurring: true,
  period: 'YEARLY',
  status: 'ACTIVE',
  notes: '',
})

type ServiceFormModalProps = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  service?: any
  defaultClientId?: string
  defaultClientName?: string
  lockClient?: boolean
}

export default function ServiceFormModal({
  open,
  onClose,
  onSaved,
  service,
  defaultClientId,
  defaultClientName,
  lockClient = false,
}: ServiceFormModalProps) {
  const editId = service?.id ?? null
  const [clients, setClients] = useState<any[]>([])
  const [productTypes, setProductTypes] = useState<any[]>([])
  const [productPackages, setProductPackages] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [generateInvoice, setGenerateInvoice] = useState(false)
  const [sendInvoice, setSendInvoice] = useState(false)

  const selectedType = productTypes.find(t => t.id === form.productTypeId)

  const applyBillingDates = (next: ReturnType<typeof emptyForm>) => {
    if (!next.recurring || !next.period || !next.startDate) return next
    const { nextDueDate, expiryDate } = calculateBillingDates(next.startDate, next.period)
    return {
      ...next,
      nextDueDate: toDateInput(nextDueDate),
      expiryDate: toDateInput(expiryDate),
    }
  }

  const applyPackagePricing = (next: ReturnType<typeof emptyForm>, pkgId?: string) => {
    const id = pkgId ?? next.productPackageId
    const pkg = productPackages.find(p => p.id === id)
    if (!pkg) return next
    const period = next.recurring ? next.period : 'YEARLY'
    return {
      ...next,
      productPackageId: id,
      price: String(getPackagePrice(pkg, period)),
      setupFee: String(pkg.setupFee ?? 0),
    }
  }

  const updateForm = (patch: Partial<ReturnType<typeof emptyForm>>, recalcDates = false) => {
    setForm(prev => {
      let next = { ...prev, ...patch }
      if (patch.productTypeId && patch.productTypeId !== prev.productTypeId) {
        next = { ...next, productPackageId: '' }
      }
      if (patch.productPackageId || (patch.period && next.productPackageId)) {
        next = applyPackagePricing(next, patch.productPackageId)
      }
      if (recalcDates && next.recurring) next = applyBillingDates(next)
      if (!next.recurring) next = { ...next, period: 'YEARLY', nextDueDate: '' }
      if (next.productPackageId && (patch.period || patch.recurring !== undefined)) {
        next = applyPackagePricing(next)
      }
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    fetch('/api/clients').then(r => r.json()).then(setClients)
    fetch('/api/product-types?active=true').then(r => r.json()).then(types => {
      setProductTypes(types)
    })
  }, [open])

  useEffect(() => {
    if (!open || !form.productTypeId) {
      setProductPackages([])
      return
    }
    fetch(`/api/product-packages?productTypeId=${form.productTypeId}&active=true`)
      .then(r => r.json())
      .then(setProductPackages)
  }, [open, form.productTypeId])

  useEffect(() => {
    if (!open) return
    if (service) {
      setForm({
        clientId: service.clientId,
        productTypeId: service.productTypeId || service.productType?.id || '',
        productPackageId: service.productPackageId || service.productPackage?.id || '',
        name: service.name,
        price: String(service.price),
        setupFee: String(service.setupFee ?? 0),
        startDate: toDateInput(service.startDate),
        expiryDate: toDateInput(service.expiryDate),
        nextDueDate: toDateInput(service.nextDueDate || service.expiryDate),
        recurring: service.recurring,
        period: service.period || 'YEARLY',
        status: service.status,
        notes: service.notes || '',
      })
      setGenerateInvoice(false)
      setSendInvoice(false)
    } else {
      const base = applyBillingDates({
        ...emptyForm(),
        clientId: defaultClientId || '',
      })
      setForm(base)
      setGenerateInvoice(false)
      setSendInvoice(false)
    }
  }, [open, service, defaultClientId])

  useEffect(() => {
    if (!open || service || form.productTypeId || productTypes.length === 0) return
    setForm(prev => ({ ...prev, productTypeId: productTypes[0].id }))
  }, [open, service, form.productTypeId, productTypes])

  const save = async () => {
    if (!form.clientId || !form.name || !form.expiryDate) {
      return alert('Fill required fields: client, name, and renewal date')
    }
    if (!form.productTypeId) {
      return alert('Please select a product type')
    }
    if (!form.productPackageId) {
      return alert('Please select a product package')
    }
    setSaving(true)
    try {
      const method = editId ? 'PUT' : 'POST'
      const url = editId ? `/api/services/${editId}` : '/api/services'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          productTypeId: form.productTypeId,
          productPackageId: form.productPackageId,
          name: form.name,
          price: parseFloat(form.price) || 0,
          setupFee: parseFloat(form.setupFee) || 0,
          startDate: form.startDate,
          expiryDate: form.expiryDate,
          recurring: form.recurring,
          period: form.recurring ? form.period : null,
          nextDueDate: form.recurring ? form.nextDueDate || form.expiryDate : null,
          status: form.status,
          notes: form.notes,
          ...(!editId && {
            generateInvoice,
            sendInvoice: generateInvoice && sendInvoice,
          }),
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        const message = result.error?.includes('Unknown argument')
          ? 'Failed to save service. Please try again.'
          : (result.error || 'Failed to save service')
        return alert(message)
      }
      if (!editId && result.invoice) {
        const parts = [`Invoice ${result.invoice.invoiceNo} created.`]
        if (result.invoiceSent) {
          if (result.invoiceSent.email) parts.push('Email sent.')
          if (result.invoiceSent.telegram) parts.push('Telegram sent.')
          if (result.invoiceSent.errors?.length) parts.push(`Warnings: ${result.invoiceSent.errors.join('; ')}`)
        }
        alert(parts.join(' '))
      }
      onClose()
      onSaved()
    } catch {
      alert('Failed to save service. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const clientLabel = lockClient
    ? (defaultClientName || clients.find(c => c.id === form.clientId)?.name || 'Client')
    : null

  const selectedPkg = productPackages.find(p => p.id === form.productPackageId)
  const isHosting = selectedType?.hasHostingSpecs

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-base font-semibold">
            {editId ? 'Edit Service' : lockClient && clientLabel ? `Add Service — ${clientLabel}` : 'Add Service'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Product Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {lockClient ? (
                <div className="col-span-2">
                  <label className="label">Client</label>
                  <div className="input bg-gray-50 text-gray-700">{clientLabel}</div>
                </div>
              ) : (
                <div>
                  <label className="label">Client *</label>
                  <select className="input" value={form.clientId} onChange={e => updateForm({ clientId: e.target.value })}>
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className={lockClient ? '' : ''}>
                <label className="label">Product Type *</label>
                <select className="input" value={form.productTypeId} onChange={e => updateForm({ productTypeId: e.target.value })}>
                  <option value="">Select type...</option>
                  {productTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {productTypes.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    No product types yet. <a href="/product-types" className="underline">Create one</a>
                  </p>
                )}
              </div>
              {form.productTypeId && (
                <div>
                  <label className="label">{selectedType?.name || 'Product'} Package *</label>
                  <select
                    className="input"
                    value={form.productPackageId}
                    onChange={e => updateForm({ productPackageId: e.target.value })}
                  >
                    <option value="">Select package...</option>
                    {productPackages.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {productPackages.length === 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      No packages yet. <a href="/product-packages" className="underline">Create one</a>
                    </p>
                  )}
                </div>
              )}
              <div className="col-span-2">
                <label className="label">
                  {isHosting ? 'Domain / Website *' : 'Product / Domain Name *'}
                </label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => updateForm({ name: e.target.value })}
                  placeholder={isHosting ? 'e.g. example.com' : 'e.g. example.com or certificate name'}
                />
              </div>
              {selectedPkg && isHosting && (
                <div className="col-span-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  <span className="font-medium text-gray-700">{selectedPkg.name}</span>
                  {' — '}{selectedPkg.diskSpaceGb}GB disk · {selectedPkg.bandwidthGb}GB bandwidth · {selectedPkg.emailAccounts} emails · {selectedPkg.databases} DB
                  {selectedPkg.description && <span className="block mt-1 text-gray-500">{selectedPkg.description}</span>}
                </div>
              )}
              {selectedPkg && !isHosting && selectedPkg.description && (
                <div className="col-span-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                  {selectedPkg.description}
                </div>
              )}
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => updateForm({ status: e.target.value })}>
                  {['ACTIVE', 'EXPIRED', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => updateForm({ notes: e.target.value })} placeholder="Internal notes..." />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pricing & Billing</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Billing Type</label>
                <select
                  className="input"
                  value={form.recurring ? 'recurring' : 'onetime'}
                  onChange={e => updateForm({ recurring: e.target.value === 'recurring' }, e.target.value === 'recurring')}
                >
                  <option value="recurring">Recurring</option>
                  <option value="onetime">One-time</option>
                </select>
              </div>
              {form.recurring && (
                <div>
                  <label className="label">Billing Cycle</label>
                  <select
                    className="input"
                    value={form.period}
                    onChange={e => updateForm({ period: e.target.value }, true)}
                  >
                    {BILLING_CYCLES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">{form.recurring ? 'Recurring Amount (USD)' : 'Price (USD)'}</label>
                <input type="number" min="0" step="0.01" className="input" value={form.price} onChange={e => updateForm({ price: e.target.value })} />
              </div>
              <div>
                <label className="label">Setup Fee (USD)</label>
                <input type="number" min="0" step="0.01" className="input" value={form.setupFee} onChange={e => updateForm({ setupFee: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Billing Dates</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Registration Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.startDate}
                  onChange={e => updateForm({ startDate: e.target.value }, form.recurring)}
                />
              </div>
              {form.recurring && (
                <div>
                  <label className="label">Next Due Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.nextDueDate}
                    onChange={e => updateForm({ nextDueDate: e.target.value, expiryDate: e.target.value })}
                  />
                </div>
              )}
              <div className={form.recurring ? '' : 'col-span-2'}>
                <label className="label">{form.recurring ? 'Renewal / Expiry Date *' : 'Expiry Date *'}</label>
                <input
                  type="date"
                  className="input"
                  value={form.expiryDate}
                  onChange={e => updateForm({ expiryDate: e.target.value })}
                />
              </div>
            </div>
            {form.recurring && (
              <p className="text-xs text-gray-400 mt-2">
                Dates auto-calculate from billing cycle. You can override next due and renewal dates manually.
              </p>
            )}
          </div>

          {!editId && (
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Invoice</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={generateInvoice}
                    onChange={e => {
                      setGenerateInvoice(e.target.checked)
                      if (!e.target.checked) setSendInvoice(false)
                    }}
                  />
                  <span className="text-sm text-gray-700">Generate Invoice?</span>
                </label>
                {generateInvoice && (
                  <label className="flex items-center gap-2 cursor-pointer ml-6">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={sendInvoice}
                      onChange={e => setSendInvoice(e.target.checked)}
                    />
                    <span className="text-sm text-gray-700">Send Invoice</span>
                    <span className="text-xs text-gray-400">(email + Telegram if configured)</span>
                  </label>
                )}
                {generateInvoice && (
                  <p className="text-xs text-gray-400 ml-6">
                    Invoice due date uses the service next due / expiry date. Line items include recurring price and setup fee.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Service'}
          </button>
        </div>
      </div>
    </div>
  )
}
