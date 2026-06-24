'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductPackageFormModal from '@/components/product-packages/ProductPackageFormModal'
import { formatCurrency } from '@/lib/utils'
import { productTypeBadgeClass } from '@/lib/product-badges'
import { useCachedList } from '@/lib/use-cached-list'
import { PRODUCT_TYPES_URL } from '@/lib/list-cache'
import { toast } from '@/lib/toast'

export default function ProductPackagesPage() {
  const searchParams = useSearchParams()
  const { items: types } = useCachedList<any>(PRODUCT_TYPES_URL)
  const [typeFilter, setTypeFilter] = useState('')
  const packagesEndpoint = typeFilter
    ? `/api/product-packages?productTypeId=${typeFilter}`
    : '/api/product-packages'
  const { items: packages, initialLoading, refreshing, reload } = useCachedList<any>(
    packagesEndpoint,
    [typeFilter],
  )
  const [showModal, setShowModal] = useState(false)
  const [editPackage, setEditPackage] = useState<any | null>(null)
  const [defaultProductTypeId, setDefaultProductTypeId] = useState('')

  useEffect(() => {
    const fromUrl = searchParams.get('productTypeId')
    const shouldAdd = searchParams.get('add') === '1'
    if (fromUrl) setTypeFilter(fromUrl)
    if (shouldAdd && fromUrl) {
      setEditPackage(null)
      setDefaultProductTypeId(fromUrl)
      setShowModal(true)
    }
  }, [searchParams])

  const openAdd = () => {
    setEditPackage(null)
    setDefaultProductTypeId(typeFilter || types[0]?.id || '')
    setShowModal(true)
  }

  const openEdit = (p: any) => {
    setEditPackage(p)
    setDefaultProductTypeId(p.productTypeId)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditPackage(null)
    setDefaultProductTypeId('')
  }

  const del = async (id: string, name: string) => {
    if (!await toast.confirm(`Delete "${name}"?`)) return
    const res = await fetch(`/api/product-packages/${id}`, { method: 'DELETE' })
    const result = await res.json()
    if (!res.ok) return toast.error(result.error || 'Failed to delete')
    reload()
  }

  return (
    <div className="page-content">
      <div className="page-header">
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
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Billing</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Price</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Services</th>
              <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className={refreshing ? 'opacity-60 transition-opacity' : undefined}>
            {initialLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>}
            {!initialLoading && packages.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No packages yet</td></tr>
            )}
            {packages.map(p => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <span className={`badge ${productTypeBadgeClass(p.productType?.color)}`}>
                    {p.productType?.name || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${p.billingType === 'ONE_TIME' ? 'badge-domain' : 'badge-hosting'}`}>
                    {p.billingType === 'ONE_TIME' ? 'One-time' : 'Recurring'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.billingType === 'ONE_TIME'
                    ? formatCurrency(p.priceYearly)
                    : (
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {formatCurrency(p.priceMonthly)}/mo · {formatCurrency(p.priceYearly)}/yr
                      </span>
                    )}
                </td>
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

      <ProductPackageFormModal
        open={showModal}
        types={types}
        editPackage={editPackage}
        defaultProductTypeId={defaultProductTypeId}
        onClose={closeModal}
        onSaved={reload}
      />
    </div>
  )
}
