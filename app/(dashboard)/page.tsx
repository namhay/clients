import Link from 'next/link'
import StatCard from '@/components/dashboard/StatCard'
import { getAppDateFormat, getAppTimezone } from '@/lib/app-date'
import { getDashboardData } from '@/lib/analytics'
import { formatDateValue } from '@/lib/date-format'
import { productTypeBadgeClass } from '@/lib/product-badges'
import { formatCurrency, daysUntil } from '@/lib/utils'

const statusColor: Record<string, string> = {
  PAID: 'badge-paid',
  UNPAID: 'badge-unpaid',
  OVERDUE: 'badge-overdue',
}

export default async function DashboardPage() {
  const [stats, dateFormat, timezone] = await Promise.all([
    getDashboardData(),
    getAppDateFormat(),
    getAppTimezone(),
  ])
  const formatDate = (date: Date | string) => formatDateValue(date, dateFormat, timezone)

  const needsAttention = stats.unpaidInvoices > 0 || stats.expiringServices > 0 || stats.overdueInvoices > 0

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of clients, billing, and renewals.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/orders" className="btn-secondary">Orders</Link>
          <Link href="/invoices" className="btn-primary">Invoices</Link>
        </div>
      </div>

      {needsAttention && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="text-sm font-medium text-amber-900 dark:text-amber-200">Needs attention</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-amber-800 dark:text-amber-300">
            {stats.overdueInvoices > 0 && (
              <Link href="/invoices" className="hover:underline">
                {stats.overdueInvoices} overdue invoice{stats.overdueInvoices === 1 ? '' : 's'} ({formatCurrency(stats.overdueAmount)})
              </Link>
            )}
            {stats.unpaidInvoices > 0 && (
              <Link href="/invoices" className="hover:underline">
                {stats.unpaidInvoices} open invoice{stats.unpaidInvoices === 1 ? '' : 's'} ({formatCurrency(stats.outstandingAmount)})
              </Link>
            )}
            {stats.expiringServices > 0 && (
              <Link href="/reminders" className="hover:underline">
                {stats.expiringServices} service{stats.expiringServices === 1 ? '' : 's'} due for reminder
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Clients"
          value={stats.totalClients}
          sub={`${stats.activeServices} active services`}
          href="/clients"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats.outstandingAmount)}
          sub={`${stats.unpaidInvoices} open invoice${stats.unpaidInvoices === 1 ? '' : 's'}`}
          valueClassName="text-yellow-600 dark:text-yellow-400"
          href="/invoices"
        />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          sub={`${formatCurrency(stats.revenueThisMonth)} this month`}
          valueClassName="text-green-700 dark:text-green-300"
          href="/transactions"
        />
        <StatCard
          label="Due for Reminder"
          value={stats.expiringServices}
          sub={`${stats.expiredServices} expired service${stats.expiredServices === 1 ? '' : 's'}`}
          valueClassName="text-red-600 dark:text-red-400"
          href="/reminders"
        />
      </div>

      <div className="mb-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card card-compact min-w-0 xl:col-span-1">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Recent Invoices</h2>
            <Link href="/invoices" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">View all</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="w-[38%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Invoice</th>
                <th className="w-[32%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Client</th>
                <th className="w-[30%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Amount</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentInvoices.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 sm:px-4">
                    No invoices yet
                  </td>
                </tr>
              )}
              {stats.recentInvoices.map(inv => (
                <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="whitespace-nowrap">
                    <Link href="/invoices" className="font-medium text-blue-700 hover:underline dark:text-blue-300">
                      {inv.invoiceNo}
                    </Link>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{formatDate(inv.createdAt)}</div>
                  </td>
                  <td className="truncate" title={inv.client?.name}>{inv.client?.name}</td>
                  <td>
                    <div className="whitespace-nowrap">{formatCurrency(inv.total)}</div>
                    <span className={`badge ${statusColor[inv.status] || 'badge-unpaid'}`}>{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-compact min-w-0 xl:col-span-1">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Open Invoices</h2>
            <Link href="/reminders" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">Reminders</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="w-[40%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Client</th>
                <th className="w-[35%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Due</th>
                <th className="w-[25%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Amount</th>
              </tr>
            </thead>
            <tbody>
              {stats.openInvoices.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 sm:px-4">
                    No open invoices
                  </td>
                </tr>
              )}
              {stats.openInvoices.map(inv => (
                <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="truncate font-medium" title={inv.client?.name}>{inv.client?.name}</td>
                  <td className="whitespace-nowrap text-xs">
                    <div>{formatDate(inv.dueDate)}</div>
                    <span className={`badge ${statusColor[inv.status] || 'badge-unpaid'}`}>{inv.status}</span>
                  </td>
                  <td className="whitespace-nowrap">{formatCurrency(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-compact min-w-0 xl:col-span-1">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Due for Reminder</h2>
            <Link href="/services" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">Services</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="w-[34%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Client</th>
                <th className="w-[46%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Service</th>
                <th className="w-[20%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Days</th>
              </tr>
            </thead>
            <tbody>
              {stats.expiringList.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 sm:px-4">
                    No services due for reminder
                  </td>
                </tr>
              )}
              {stats.expiringList.map(svc => {
                const d = daysUntil(svc.expiryDate)
                return (
                  <tr key={svc.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="truncate font-medium" title={svc.client?.name}>
                      <Link href={`/clients/${svc.clientId}`} className="hover:text-blue-700 dark:hover:text-blue-300">
                        {svc.client?.name}
                      </Link>
                    </td>
                    <td>
                      <div className="truncate text-gray-600 dark:text-gray-300" title={svc.name}>{svc.name}</div>
                      <span className={`badge ${productTypeBadgeClass(svc.productType?.color)}`}>
                        {svc.productType?.name}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={`font-medium ${d < 0 ? 'text-red-600 dark:text-red-400' : d < 7 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {d < 0 ? `${Math.abs(d)}d ago` : `${d}d`}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Orders', value: stats.totalOrders, href: '/orders' },
          { label: 'Payments this month', value: stats.paymentsThisMonth, href: '/transactions' },
          { label: 'Active services', value: stats.activeServices, href: '/services' },
          { label: 'Reports', value: 'View', href: '/reports' },
        ].map(item => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm transition-colors hover:border-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-800"
          >
            <div className="text-xs text-gray-500 dark:text-gray-400">{item.label}</div>
            <div className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{item.value}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
