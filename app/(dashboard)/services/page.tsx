'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatBillingCycle } from '@/lib/billing'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { daysUntil, formatCurrency } from '@/lib/utils'
import { productTypeBadgeClass } from '@/lib/product-badges'
import { toast } from '@/lib/toast'

const ServiceFormModal = dynamic(() => import('@/components/services/ServiceFormModal'), { ssr: false })

export default function ServicesPage() {
  const { formatDate } = useAppSettings()
  const [services, setServices] = useState<any[]>([])
  const [productTypes, setProductTypes] = useState<any[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editService, setEditService] = useState<any>(null)
  const load = async () => {
    setLoading(true)
    const url = typeFilter
      ? `/api/services?productTypeId=${typeFilter}`
      : '/api/services'
    const svcs = await fetch(url).then(r => r.json())
    setServices(svcs)
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/product-types?active=true').then(r => r.json()).then(setProductTypes)
  }, [])

  useEffect(() => { load() }, [typeFilter])

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return services
    return services.filter(s => {
      const haystack = [
        s.client?.name,
        s.name,
        s.productType?.name,
        s.productPackage?.name,
        s.status,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [services, search])

  const openAdd = () => {
    setEditService(null)
    setShowModal(true)
  }

  const openEdit = (s: any) => {
    setEditService(s)
    setShowModal(true)
  }

  const del = async (id: string) => {
    if (!await toast.confirm('Delete this service?')) return
    await fetch(`/api/services/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Services</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage products, pricing, and billing cycles</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Service
        </button>
      </div>

      <div className="card">
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <input
            className="input max-w-xs"
            placeholder="Search services..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${!typeFilter ? 'bg-blue-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            All
          </button>
          {productTypes.map(t => (
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
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Client</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Service</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Type</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Billing</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Next Due</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>}
            {!loading && filteredServices.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                {search.trim() ? 'No services match your search' : 'No services found'}
              </td></tr>
            )}
            {filteredServices.map(s => {
              const dueDate = s.nextDueDate || s.expiryDate
              const d = daysUntil(dueDate)
              return (
                <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${s.clientId}`}
                      className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400"
                    >
                      {s.client?.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-600 dark:text-gray-300">{s.name}</div>
                    {s.productPackage && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.productPackage.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${productTypeBadgeClass(s.productType?.color)}`}>
                      {s.productType?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatBillingCycle(s.period, s.recurring)}</td>
                  <td className="px-4 py-3">
                    <div className={d < 0 ? 'text-red-600 dark:text-red-400' : d < 30 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}>
                      {formatDate(dueDate)}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {d < 0 ? `${Math.abs(d)} days overdue` : `${d} days left`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{formatCurrency(s.price)}</div>
                    {s.setupFee > 0 && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">+{formatCurrency(s.setupFee)} setup</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-expired'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button className="btn-secondary py-1 px-2 text-xs" onClick={() => openEdit(s)}>Edit</button>
                      <button className="btn-danger py-1 px-2 text-xs" onClick={() => del(s.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ServiceFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditService(null) }}
        onSaved={load}
        service={editService}
      />
    </div>
  )
}
