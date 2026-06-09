'use client'
import { useEffect, useState } from 'react'
import { formatCurrency, daysUntil } from '@/lib/utils'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(data => { setStats(data); setLoading(false) })
  }, [])

  if (loading) return <div className="p-6 text-gray-500 dark:text-gray-400">Loading dashboard...</div>

  const statusColor: Record<string,string> = { PAID:'badge-paid', UNPAID:'badge-unpaid', OVERDUE:'badge-overdue' }

  return (
    <div className="p-6">
      <div className="mb-6"><h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Welcome back. Here is what is happening today.</p></div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Clients', value: stats.totalClients, color: 'text-gray-900 dark:text-gray-100' },
          { label: 'Unpaid Invoices', value: stats.unpaidInvoices, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), color: 'text-green-700 dark:text-green-300' },
          { label: 'Expiring Soon', value: stats.expiringServices, color: 'text-red-600 dark:text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</div>
            <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Recent Invoices</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50"><tr><th className="text-left px-4 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">Client</th><th className="text-left px-4 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</th><th className="text-left px-4 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">Status</th></tr></thead>
            <tbody>
              {stats.recentInvoices.map((inv: any) => (
                <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2.5 font-medium">{inv.client?.name}</td>
                  <td className="px-4 py-2.5">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${statusColor[inv.status] || 'badge-unpaid'}`}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800"><h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Expiring Services</h2></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50"><tr><th className="text-left px-4 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">Client</th><th className="text-left px-4 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">Service</th><th className="text-left px-4 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium">Days Left</th></tr></thead>
            <tbody>
              {stats.expiringList.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500 text-xs">No expiring services</td></tr>}
              {stats.expiringList.map((svc: any) => {
                const d = daysUntil(svc.expiryDate)
                return (
                  <tr key={svc.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2.5 font-medium">{svc.client?.name}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{svc.name}</td>
                    <td className="px-4 py-2.5"><span className={`font-medium ${d < 0 ? 'text-red-600 dark:text-red-400' : d < 7 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>{d < 0 ? Math.abs(d) + 'd ago' : d + 'd'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
