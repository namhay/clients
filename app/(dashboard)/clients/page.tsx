'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Pagination from '@/components/Pagination'
import { toast } from '@/lib/toast'
import { usePaginatedList } from '@/lib/use-paginated-list'
import { prefetchClientProfile } from '@/lib/list-cache'
import ClientLink from '@/components/clients/ClientLink'
import { formatRenewalDaysShort, parseRenewalDaysBeforeExpiry } from '@/lib/clients'

const OrderFormModal = dynamic(() => import('@/components/orders/OrderFormModal'), { ssr: false })
const ClientFormModal = dynamic(() => import('@/components/clients/ClientFormModal'), { ssr: false })

export default function ClientsPage() {
  const {
    searchInput,
    setSearchInput,
    debouncedSearch,
    page,
    setPage,
    items: clients,
    total,
    totalPages,
    loading,
    initialLoading,
    refreshing,
    reload,
  } = usePaginatedList<any>({ endpoint: '/api/clients' })

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    companyKhmer: '',
    address: '',
    vatTin: '',
    telegramId: '',
    notes: '',
    renewalDaysBeforeExpiry: 14,
  })
  const emptyForm = {
    name: '',
    email: '',
    phone: '',
    company: '',
    companyKhmer: '',
    address: '',
    vatTin: '',
    telegramId: '',
    notes: '',
    renewalDaysBeforeExpiry: 14,
  }
  const [editId, setEditId] = useState<string|null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderClient, setOrderClient] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    for (const c of clients.slice(0, 8)) {
      void prefetchClientProfile(c.id)
    }
  }, [clients])

  const save = async () => {
    if (!form.name || !form.email) return toast.error('Name and email are required')
    const method = editId ? 'PUT' : 'POST'
    const url = editId ? `/api/clients/${editId}` : '/api/clients'
    await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
    setShowModal(false); setForm(emptyForm); setEditId(null); reload()
  }

  const del = async (id: string) => {
    if (!await toast.confirm('Delete this client and all their data?')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' }); reload()
  }

  const edit = (c: any) => {
    setForm({
      name: c.name,
      email: c.email,
      phone: c.phone || '',
      company: c.company || '',
      companyKhmer: c.companyKhmer || '',
      address: c.address || '',
      vatTin: c.vatTin || '',
      telegramId: c.telegramId || '',
      notes: c.notes || '',
      renewalDaysBeforeExpiry: c.renewalDaysBeforeExpiry ?? 14,
    })
    setEditId(c.id)
    setShowModal(true)
  }

  const addOrder = (c: any) => {
    setOrderClient({ id: c.id, name: c.name })
    setShowOrderModal(true)
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Clients</h1>
        <button className="btn-primary" onClick={() => { setShowModal(true); setEditId(null); setForm(emptyForm) }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Add Client
        </button>
      </div>
      <div className="card">
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <input className="input max-w-xs" placeholder="Search clients..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50"><tr>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Name</th>
            <th className="hidden md:table-cell text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Email</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Phone</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Services</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoices</th>
            <th className="px-4 py-2.5"></th>
          </tr></thead>
          <tbody className={refreshing ? 'opacity-60 transition-opacity' : undefined}>
            {initialLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>}
            {!initialLoading && clients.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                {debouncedSearch.trim() ? 'No clients match your search' : 'No clients found'}
              </td></tr>
            )}
            {clients.map(c => (
              <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <ClientLink clientId={c.id} className="flex items-center gap-2 group">
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {c.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 flex items-center gap-1.5">
                        {c.name}
                        {c.telegramId && (
                          <span
                            title={`Telegram ID: ${c.telegramId}`}
                            className="text-sky-500 dark:text-sky-400 flex-shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatRenewalDaysShort(parseRenewalDaysBeforeExpiry(c.renewalDaysBeforeExpiry))}
                      </div>
                    </div>
                  </ClientLink>
                </td>
                <td className="hidden md:table-cell px-4 py-3 text-gray-600 dark:text-gray-300">{c.email}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.phone || '-'}</td>
                <td className="px-4 py-3"><span className="badge badge-domain">{c._count?.services || 0}</span></td>
                <td className="px-4 py-3"><span className="badge badge-unpaid">{c._count?.invoices || 0}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <ClientLink clientId={c.id} className="btn-secondary py-1 px-2 text-xs">View</ClientLink>
                    <button className="btn-primary py-1 px-2 text-xs" onClick={() => addOrder(c)}>Add Order</button>
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => edit(c)}>Edit</button>
                    <button className="btn-danger py-1 px-2 text-xs" onClick={() => del(c.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={25}
          onPageChange={setPage}
          loading={loading}
        />
      </div>

      <OrderFormModal
        open={showOrderModal}
        onClose={() => { setShowOrderModal(false); setOrderClient(null) }}
        onSaved={reload}
        defaultClientId={orderClient?.id}
        defaultClientName={orderClient?.name}
      />

      <ClientFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditId(null); setForm(emptyForm) }}
        onSave={save}
        editMode={Boolean(editId)}
        form={form}
        setForm={setForm}
      />
    </div>
  )
}
