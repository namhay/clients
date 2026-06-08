'use client'
import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

export default function ReportsPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/invoices').then(r=>r.json()).then(setInvoices)
    fetch('/api/services').then(r=>r.json()).then(setServices)
  }, [])
  const paid = invoices.filter(i=>i.status==='PAID')
  const unpaid = invoices.filter(i=>i.status==='UNPAID'||i.status==='OVERDUE')
  const totalRevenue = paid.reduce((s,i)=>s+i.total,0)
  const outstanding = unpaid.reduce((s,i)=>s+i.total,0)
  const byType = services.reduce((acc: Record<string, number>, s: any) => {
    const key = s.productType?.name || 'Unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Reports</h1>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'Total Revenue', value: formatCurrency(totalRevenue), color:'text-green-700 dark:text-green-300' },
          { label:'Outstanding', value: formatCurrency(outstanding), color:'text-yellow-600 dark:text-yellow-400' },
          { label:'Total Invoices', value: invoices.length, color:'text-gray-900 dark:text-gray-100' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</div>
            <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Services by Type</h2>
          {Object.entries(byType).map(([type, count]:any) => (
            <div key={type} className="flex items-center gap-3 mb-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 w-20">{type}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className="h-4 bg-blue-600 rounded-full" style={{width:`${(count/services.length*100).toFixed(0)}%`}}></div>
              </div>
              <div className="text-xs font-medium w-6">{count}</div>
            </div>
          ))}
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Invoice Status</h2>
          {[['PAID',paid.length,'bg-green-500'],['UNPAID/OVERDUE',unpaid.length,'bg-yellow-500']].map(([label,count,color]:any) => (
            <div key={label} className="flex items-center gap-3 mb-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 w-24">{label}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div className={`h-4 ${color} rounded-full`} style={{width:`${invoices.length?((count as number)/invoices.length*100).toFixed(0):0}%`}}></div>
              </div>
              <div className="text-xs font-medium w-6">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
