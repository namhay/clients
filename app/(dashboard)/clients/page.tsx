'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import ServiceFormModal from '@/components/services/ServiceFormModal'

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', phone:'', company:'', address:'', vatTin:'', telegramId:'', notes:'' })
  const [editId, setEditId] = useState<string|null>(null)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [serviceClient, setServiceClient] = useState<{ id: string; name: string } | null>(null)

  const load = async (q='') => {
    setLoading(true)
    const res = await fetch(`/api/clients?search=${q}`)
    setClients(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name || !form.email) return alert('Name and email are required')
    const method = editId ? 'PUT' : 'POST'
    const url = editId ? `/api/clients/${editId}` : '/api/clients'
    await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) })
    setShowModal(false); setForm({ name:'',email:'',phone:'',company:'',address:'',vatTin:'',telegramId:'',notes:'' }); setEditId(null); load(search)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this client and all their data?')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' }); load(search)
  }

  const edit = (c: any) => {
    setForm({ name:c.name,email:c.email,phone:c.phone||'',company:c.company||'',address:c.address||'',vatTin:c.vatTin||'',telegramId:c.telegramId||'',notes:c.notes||'' })
    setEditId(c.id); setShowModal(true)
  }

  const addService = (c: any) => {
    setServiceClient({ id: c.id, name: c.name })
    setShowServiceModal(true)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Clients</h1>
        <button className="btn-primary" onClick={() => { setShowModal(true); setEditId(null); setForm({ name:'',email:'',phone:'',company:'',address:'',vatTin:'',telegramId:'',notes:'' }) }}>
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
            <th className="text-left px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium">Joined</th>
            <th className="px-4 py-2.5"></th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">Loading...</td></tr>}
            {!loading && clients.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No clients found</td></tr>}
            {clients.map(c => (
              <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-2 group">
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {c.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">{c.name}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{c.company}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.email}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.phone || '-'}</td>
                <td className="px-4 py-3"><span className="badge badge-domain">{c._count?.services || 0}</span></td>
                <td className="px-4 py-3"><span className="badge badge-unpaid">{c._count?.invoices || 0}</span></td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <Link href={`/clients/${c.id}`} className="btn-secondary py-1 px-2 text-xs">View</Link>
                    <button className="btn-primary py-1 px-2 text-xs" onClick={() => addService(c)}>Add Service</button>
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => edit(c)}>Edit</button>
                    <button className="btn-danger py-1 px-2 text-xs" onClick={() => del(c.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ServiceFormModal
        open={showServiceModal}
        onClose={() => { setShowServiceModal(false); setServiceClient(null) }}
        onSaved={() => load(search)}
        defaultClientId={serviceClient?.id}
        defaultClientName={serviceClient?.name}
        lockClient
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold">{editId ? 'Edit Client' : 'Add New Client'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {[['name','Full Name *','text'],['email','Email *','email'],['phone','Phone','text'],['company','Company','text'],['address','Address','text'],['vatTin','VAT TIN','text'],['telegramId','Telegram ID','text']].map(([k,l,t]) => (
                <div key={k}><label className="label">{l}</label><input type={t} className="input" value={(form as any)[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} /></div>
              ))}
              <div className="col-span-2"><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({...f,notes:e.target.value}))} /></div>
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
