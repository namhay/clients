'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from '@/lib/toast'

const OrderFormModal = dynamic(() => import('@/components/orders/OrderFormModal'), { ssr: false })

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', phone:'', company:'', companyKhmer:'', address:'', vatTin:'', telegramId:'', notes:'' })
  const emptyForm = { name:'', email:'', phone:'', company:'', companyKhmer:'', address:'', vatTin:'', telegramId:'', notes:'' }
  const [editId, setEditId] = useState<string|null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderClient, setOrderClient] = useState<{ id: string; name: string } | null>(null)

  const load = async (q='') => {
    setLoading(true)
    const res = await fetch(`/api/clients?search=${q}`)
    setClients(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name || !form.email) return toast.error('Name and email are required')
    const method = editId ? 'PUT' : 'POST'
    const url = editId ? `/api/clients/${editId}` : '/api/clients'
    await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
    setShowModal(false); setForm(emptyForm); setEditId(null); load(search)
  }

  const del = async (id: string) => {
    if (!await toast.confirm('Delete this client and all their data?')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' }); load(search)
  }

  const edit = (c: any) => {
    setForm({ name:c.name,email:c.email,phone:c.phone||'',company:c.company||'',companyKhmer:c.companyKhmer||'',address:c.address||'',vatTin:c.vatTin||'',telegramId:c.telegramId||'',notes:c.notes||'' })
    setEditId(c.id); setShowModal(true)
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
          <input className="input max-w-xs" placeholder="Search clients..." value={search} onChange={e => { setSearch(e.target.value); load(e.target.value) }} />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50"><tr>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Name</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Email</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Phone</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Services</th>
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Invoices</th>
            <th className="px-4 py-2.5"></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>}
            {!loading && clients.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No clients found</td></tr>}
            {clients.map(c => (
              <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-2 group">
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {c.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 flex items-center gap-1.5">
                        {c.name}
                        {c.telegramId && (
                          <span title="Telegram connected" className="text-sky-500 dark:text-sky-400 flex-shrink-0">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {(c.companyKhmer || c.company) && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {c.companyKhmer && <div>{c.companyKhmer}</div>}
                          {c.company && <div>{c.company}</div>}
                        </div>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.email}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.phone || '-'}</td>
                <td className="px-4 py-3"><span className="badge badge-domain">{c._count?.services || 0}</span></td>
                <td className="px-4 py-3"><span className="badge badge-unpaid">{c._count?.invoices || 0}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <Link href={`/clients/${c.id}`} className="btn-secondary py-1 px-2 text-xs">View</Link>
                    <button className="btn-primary py-1 px-2 text-xs" onClick={() => addOrder(c)}>Add Order</button>
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => edit(c)}>Edit</button>
                    <button className="btn-danger py-1 px-2 text-xs" onClick={() => del(c.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OrderFormModal
        open={showOrderModal}
        onClose={() => { setShowOrderModal(false); setOrderClient(null) }}
        onSaved={() => load(search)}
        defaultClientId={orderClient?.id}
        defaultClientName={orderClient?.name}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold">{editId ? 'Edit Client' : 'Add New Client'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Full Name *</label>
                <input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="text" className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Email *</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Company (KH)</label>
                <input type="text" className="input" value={form.companyKhmer} onChange={e => setForm(f => ({ ...f, companyKhmer: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Company (EN)</label>
                <input type="text" className="input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <textarea className="input" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="label">VAT TIN</label>
                <input type="text" className="input" value={form.vatTin} onChange={e => setForm(f => ({ ...f, vatTin: e.target.value }))} />
              </div>
              <div>
                <label className="label">Telegram ID</label>
                <input type="text" className="input" value={form.telegramId} onChange={e => setForm(f => ({ ...f, telegramId: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={save}>{editId ? 'Save Changes' : 'Add Client'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
