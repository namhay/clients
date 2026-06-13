'use client'
import { useEffect, useState } from 'react'
import { BILLING_CYCLES } from '@/lib/billing'
import { getPackagePrice } from '@/lib/package-pricing'
import { isOneTimePackage } from '@/lib/product-packages'
import { CLIENTS_ALL_URL, fetchCachedList, PRODUCT_TYPES_ACTIVE_URL } from '@/lib/list-cache'
import { toast } from '@/lib/toast'

type OrderLine = {
  key: string
  productTypeId: string
  productPackageId: string
  name: string
  price: string
  recurring: boolean
  period: string
  startDate: string
  expiryDate: string
}

const syncLineDates = (date: string) => ({
  startDate: date,
  expiryDate: date,
})

const newLine = (): OrderLine => {
  const today = new Date().toISOString().split('T')[0]
  return {
    key: crypto.randomUUID(),
    productTypeId: '',
    productPackageId: '',
    name: '',
    price: '',
    recurring: true,
    period: 'YEARLY',
    ...syncLineDates(today),
  }
}

type OrderFormModalProps = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultClientId?: string
  defaultClientName?: string
}

export default function OrderFormModal({
  open,
  onClose,
  onSaved,
  defaultClientId,
  defaultClientName,
}: OrderFormModalProps) {
  const [clients, setClients] = useState<any[]>([])
  const [productTypes, setProductTypes] = useState<any[]>([])
  const [packagesByType, setPackagesByType] = useState<Record<string, any[]>>({})
  const [clientId, setClientId] = useState('')
  const [lines, setLines] = useState<OrderLine[]>([newLine()])
  const [generateInvoice, setGenerateInvoice] = useState(true)
  const [sendInvoice, setSendInvoice] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetchCachedList(CLIENTS_ALL_URL).then(setClients)
    void fetchCachedList(PRODUCT_TYPES_ACTIVE_URL).then(setProductTypes)
    setClientId(defaultClientId || '')
    setLines([newLine()])
    setGenerateInvoice(true)
    setSendInvoice(false)
    setPackagesByType({})
  }, [open, defaultClientId])

  const loadPackages = (productTypeId: string) => {
    if (!productTypeId) return
    fetch(`/api/product-packages?productTypeId=${productTypeId}&active=true`)
      .then(r => r.json())
      .then(pkgs => setPackagesByType(prev => (
        prev[productTypeId] ? prev : { ...prev, [productTypeId]: pkgs }
      )))
  }

  const updateLine = (key: string, patch: Partial<OrderLine>) => {
    setLines(prev => prev.map(line => {
      if (line.key !== key) return line
      let next = { ...line, ...patch }
      if (patch.productTypeId && patch.productTypeId !== line.productTypeId) {
        next = { ...next, productPackageId: '', price: '' }
        loadPackages(patch.productTypeId)
      }
      if (patch.productPackageId || (patch.period && next.productPackageId)) {
        const pkgs = packagesByType[next.productTypeId] || []
        const pkg = pkgs.find(p => p.id === (patch.productPackageId || next.productPackageId))
        if (pkg) {
          const oneTime = isOneTimePackage(pkg)
          const period = oneTime ? 'YEARLY' : (next.recurring ? next.period : 'YEARLY')
          next = {
            ...next,
            recurring: oneTime ? false : next.recurring,
            price: String(getPackagePrice(pkg, period)),
          }
        }
      }
      if (patch.startDate || patch.expiryDate) {
        const date = patch.startDate || patch.expiryDate || next.startDate
        next = { ...next, ...syncLineDates(date) }
      }
      if (patch.recurring === false) {
        next = { ...next, period: 'YEARLY' }
      }
      return next
    }))
  }

  const addLine = () => setLines(prev => [...prev, newLine()])

  const removeLine = (key: string) => {
    setLines(prev => (prev.length <= 1 ? prev : prev.filter(l => l.key !== key)))
  }

  const save = async () => {
    if (!clientId) return toast.error('Select a client')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.productTypeId) return toast.error(`Product ${i + 1}: select a product type`)
      if (!line.productPackageId) return toast.error(`Product ${i + 1}: select a package`)
      if (!line.name.trim()) return toast.error(`Product ${i + 1}: enter a name`)
      if (!line.expiryDate) return toast.error(`Product ${i + 1}: enter renewal date`)
    }

    setSaving(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          generateInvoice,
          sendInvoice: generateInvoice && sendInvoice,
          items: lines.map(line => ({
            productTypeId: line.productTypeId,
            productPackageId: line.productPackageId,
            name: line.name.trim(),
            price: parseFloat(line.price) || 0,
            startDate: line.startDate,
            expiryDate: line.expiryDate,
            recurring: line.recurring,
            period: line.recurring ? line.period : null,
          })),
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) return toast.error(result.error || 'Failed to create order')

      const parts = [`Order created with ${lines.length} product(s).`]
      if (result.invoice) {
        parts.push(`Invoice ${result.invoice.invoiceNo} created.`)
        if (result.invoiceSent) {
          if (result.invoiceSent.email) parts.push('Email sent.')
          if (result.invoiceSent.telegram) parts.push('Telegram sent.')
          if (result.invoiceSent.errors?.length) parts.push(`Warnings: ${result.invoiceSent.errors.join('; ')}`)
        }
      }
      toast.success(parts.join(' '))
      onClose()
      onSaved()
    } catch {
      toast.error('Failed to create order')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const clientLabel = defaultClientName || clients.find(c => c.id === clientId)?.name

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-base font-semibold">
            {defaultClientName ? `New Order — ${defaultClientName}` : 'New Order'}
          </h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {defaultClientId ? (
              <div className="col-span-2">
                <label className="label">Client</label>
                <div className="input bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300">{clientLabel}</div>
              </div>
            ) : (
              <div className="col-span-2">
                <label className="label">Client *</label>
                <select className="input" value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Products</h3>

            {lines.map((line, index) => {
              const selectedType = productTypes.find(t => t.id === line.productTypeId)
              const packages = packagesByType[line.productTypeId] || []
              const selectedPkg = packages.find(p => p.id === line.productPackageId)
              const packageIsOneTime = selectedPkg ? isOneTimePackage(selectedPkg) : false
              const isHosting = selectedType?.hasHostingSpecs

              return (
                <div key={line.key} className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Product {index + 1}</span>
                    {lines.length > 1 && (
                      <button type="button" className="text-xs text-red-600 dark:text-red-400 hover:underline" onClick={() => removeLine(line.key)}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Product Type *</label>
                      <select
                        className="input"
                        value={line.productTypeId}
                        onChange={e => updateLine(line.key, { productTypeId: e.target.value })}
                      >
                        <option value="">Select type...</option>
                        {productTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">{selectedType?.name || 'Product'} Package *</label>
                      <select
                        className="input"
                        value={line.productPackageId}
                        onChange={e => updateLine(line.key, { productPackageId: e.target.value })}
                        disabled={!line.productTypeId}
                      >
                        <option value="">Select package...</option>
                        {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="label">{isHosting ? 'Domain / Website *' : 'Product / Domain Name *'}</label>
                      <input
                        className="input"
                        value={line.name}
                        onChange={e => updateLine(line.key, { name: e.target.value })}
                        placeholder="e.g. example.com"
                      />
                    </div>
                    <div>
                      <label className="label">Billing Type</label>
                      <select
                        className="input"
                        value={line.recurring ? 'recurring' : 'onetime'}
                        disabled={packageIsOneTime}
                        onChange={e => updateLine(line.key, { recurring: e.target.value === 'recurring' })}
                      >
                        <option value="recurring">Recurring</option>
                        <option value="onetime">One-time</option>
                      </select>
                    </div>
                    {line.recurring && (
                      <div>
                        <label className="label">Billing Cycle</label>
                        <select
                          className="input"
                          value={line.period}
                          onChange={e => updateLine(line.key, { period: e.target.value })}
                        >
                          {BILLING_CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="label">Price (USD)</label>
                      <input type="number" min="0" step="0.01" className="input" value={line.price} onChange={e => updateLine(line.key, { price: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Start Date</label>
                      <input type="date" className="input" value={line.startDate} onChange={e => updateLine(line.key, { startDate: e.target.value })} />
                    </div>
                    <div className={line.recurring ? '' : 'col-span-2'}>
                      <label className="label">{line.recurring ? 'Renewal Date *' : 'Expiry Date *'}</label>
                      <input type="date" className="input" value={line.expiryDate} onChange={e => updateLine(line.key, { expiryDate: e.target.value })} />
                    </div>
                  </div>
                </div>
              )
            })}

            <button type="button" className="btn-secondary text-xs py-1.5 px-3 w-full sm:w-auto" onClick={addLine}>
              + Add Product
            </button>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <span className="text-sm text-gray-700 dark:text-gray-300">Generate Invoice</span>
              </label>
              <label
                className={`flex items-center gap-2 ${generateInvoice ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={sendInvoice}
                  disabled={!generateInvoice}
                  onChange={e => setSendInvoice(e.target.checked)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Send invoice</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
