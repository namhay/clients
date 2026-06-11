import Link from 'next/link'
import StatCard from '@/components/dashboard/StatCard'
import BarChartRow from '@/components/dashboard/BarChartRow'
import MonthlyRevenueChart from '@/components/dashboard/MonthlyRevenueChart'
import { getAppDateFormat, getAppTimezone } from '@/lib/app-date'
import { getReportsData } from '@/lib/analytics'
import { formatDateValue } from '@/lib/date-format'
import { productTypeBadgeClass } from '@/lib/product-badges'
import { formatCurrency } from '@/lib/utils'

const barColors: Record<string, string> = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  purple: 'bg-purple-600',
  gray: 'bg-gray-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  indigo: 'bg-indigo-600',
}

export default async function ReportsPage() {
  const [data, dateFormat, timezone] = await Promise.all([
    getReportsData(),
    getAppDateFormat(),
    getAppTimezone(),
  ])
  const formatDate = (date: Date | string) => formatDateValue(date, dateFormat, timezone)

  const { financial, monthlyRevenue, servicesByType, serviceStatus, topClients, recentTransactions, totalClients, totalOrders } = data
  const maxServiceType = Math.max(...servicesByType.map(s => s.total), 1)

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Revenue, services, and client performance across ClientDesk.</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(financial.paidTotal)}
          sub={`${financial.paidCount} paid invoices`}
          valueClassName="text-green-700 dark:text-green-300"
          href="/transactions"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(financial.openTotal)}
          sub={`${financial.openCount} open invoices`}
          valueClassName="text-yellow-600 dark:text-yellow-400"
          href="/invoices"
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(financial.overdueTotal)}
          sub={`${financial.overdueCount} overdue`}
          valueClassName="text-red-600 dark:text-red-400"
          href="/invoices"
        />
        <StatCard
          label="Active Services"
          value={serviceStatus.active}
          sub={`${totalClients} clients · ${totalOrders} orders`}
          href="/services"
        />
      </div>

      <div className="card mb-4 p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">Monthly Revenue (last 12 months)</h2>
        <MonthlyRevenueChart data={monthlyRevenue} formatValue={formatCurrency} />
        {monthlyRevenue.every(m => m.revenue === 0) && (
          <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">No paid invoices in the last 12 months.</p>
        )}
      </div>

      <div className="mb-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">Services by Product Type</h2>
          <div className="space-y-3">
            {servicesByType.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">No services yet.</p>
            )}
            {servicesByType.map(row => (
              <div key={row.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`badge ${productTypeBadgeClass(row.color)}`}>{row.name}</span>
                  <span className="text-gray-500 dark:text-gray-400">{row.active} active / {row.total} total</span>
                </div>
                <BarChartRow
                  label={row.name}
                  value={row.total}
                  max={maxServiceType}
                  barClassName={barColors[row.color] || 'bg-blue-600'}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-medium text-gray-900 dark:text-gray-100">Invoice & Service Health</h2>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Invoices</div>
              <div className="space-y-2">
                <BarChartRow label="Paid" value={financial.paidCount} max={financial.totalInvoices} barClassName="bg-green-500" />
                <BarChartRow label="Unpaid" value={financial.openCount - financial.overdueCount} max={financial.totalInvoices} barClassName="bg-yellow-500" />
                <BarChartRow label="Overdue" value={financial.overdueCount} max={financial.totalInvoices} barClassName="bg-red-500" />
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Services</div>
              <div className="space-y-2">
                <BarChartRow label="Active" value={serviceStatus.active} max={serviceStatus.total} barClassName="bg-green-500" />
                <BarChartRow label="Expired" value={serviceStatus.expired} max={serviceStatus.total} barClassName="bg-red-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-compact min-w-0">
          <div className="border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Top Clients by Revenue</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="w-[50%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Client</th>
                <th className="w-[25%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Invoices</th>
                <th className="w-[25%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topClients.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 sm:px-4">
                    No paid revenue yet
                  </td>
                </tr>
              )}
              {topClients.map(client => (
                <tr key={client.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="truncate font-medium">
                    <Link href={`/clients/${client.id}`} className="hover:text-blue-700 dark:hover:text-blue-300" title={client.name}>
                      {client.name}
                    </Link>
                  </td>
                  <td>{client.invoiceCount}</td>
                  <td className="whitespace-nowrap font-medium text-green-700 dark:text-green-300">
                    {formatCurrency(client.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-compact min-w-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Recent Payments</h2>
            <Link href="/transactions" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">View all</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="w-[40%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Invoice</th>
                <th className="w-[35%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Client</th>
                <th className="w-[25%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Paid</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 sm:px-4">
                    No payments yet
                  </td>
                </tr>
              )}
              {recentTransactions.map(inv => (
                <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="whitespace-nowrap font-medium">{inv.invoiceNo}</td>
                  <td className="truncate" title={inv.client?.name}>{inv.client?.name}</td>
                  <td>
                    <div className="whitespace-nowrap">{formatCurrency(inv.total)}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(inv.paidAt || inv.updatedAt)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
