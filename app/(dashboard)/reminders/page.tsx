'use client'
import { useEffect, useState } from 'react'
import { formatReminderRule } from '@/lib/product-types'
import { useAppSettings } from '@/components/providers/AppSettingsProvider'
import { daysUntil } from '@/lib/utils'

export default function RemindersPage() {
  const { formatDate } = useAppSettings()
  const [unpaid, setUnpaid] = useState<any[]>([])
  const [expiring, setExpiring] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [invs, svcs] = await Promise.all([
      fetch('/api/invoices?status=UNPAID').then(r=>r.json()),
      fetch('/api/services?dueForReminder=true').then(r=>r.json()),
    ])
    setUnpaid(invs); setExpiring(svcs); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const send = async (clientId: string, channel: 'email'|'telegram', type: string, invoiceId?: string, serviceId?: string) => {
    const endpoint = channel === 'email' ? '/api/reminders/email' : '/api/reminders/telegram'
    try {
      const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ clientId, type:'reminder', invoiceId, serviceId }) })
      if (!res.ok) throw new Error((await res.json()).error)
      alert(`${channel === 'email' ? 'Email' : 'Telegram'} reminder sent!`)
      setLogs(l => [{ date: formatDate(new Date()), client: 'Sent', type, channel, status:'Sent' }, ...l])
    } catch(e:any) { alert('Error: ' + e.message) }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Reminders</h1>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Unpaid Invoices ({unpaid.length})</h2>
          <div className="space-y-2">
            {unpaid.length === 0 && <div className="text-sm text-gray-400 dark:text-gray-500 py-4">No unpaid invoices.</div>}
            {unpaid.map(inv => (
              <div key={inv.id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{inv.client?.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{inv.invoiceNo} · ${inv.total.toFixed(2)} · Due {formatDate(inv.dueDate)}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => send(inv.clientId,'email','Invoice',inv.id)}>📧 Email</button>
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => send(inv.clientId,'telegram','Invoice',inv.id)}>✈ TG</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Due for Reminder ({expiring.length})</h2>
          <div className="space-y-2">
            {expiring.length === 0 && <div className="text-sm text-gray-400 dark:text-gray-500 py-4">No services due for reminder based on each product type&apos;s settings.</div>}
            {expiring.map(svc => {
              const d = daysUntil(svc.expiryDate)
              const remindDays = svc.productType?.reminderDaysBeforeExpiry ?? 14
              const remindTiming = svc.productType?.reminderTiming ?? 'BEFORE'
              const remindRule = formatReminderRule(remindDays, remindTiming)
              return (
                <div key={svc.id} className="card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{svc.client?.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {svc.productType?.name} · {svc.name} · Expires {formatDate(svc.expiryDate)}
                      </div>
                      <div className={`text-xs font-medium mt-0.5 ${d<0?'text-red-600 dark:text-red-400':d<7?'text-orange-600 dark:text-orange-400':'text-yellow-600 dark:text-yellow-400'}`}>
                        {d < 0
                          ? `${Math.abs(d)} days overdue · remind ${remindRule}`
                          : `${d} days left · remind ${remindRule}`}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button className="btn-secondary py-1 px-2 text-xs" onClick={() => send(svc.clientId,'email','Service',undefined,svc.id)}>📧 Email</button>
                      <button className="btn-secondary py-1 px-2 text-xs" onClick={() => send(svc.clientId,'telegram','Service',undefined,svc.id)}>✈ TG</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
