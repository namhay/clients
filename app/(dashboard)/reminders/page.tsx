import Link from 'next/link'
import ReminderSendButtons from '@/components/reminders/ReminderSendButtons'
import StatCard from '@/components/dashboard/StatCard'
import { getAppDateFormat, getAppTimezone } from '@/lib/app-date'
import { formatDateValue, formatDateTimeValue } from '@/lib/date-format'
import { productTypeBadgeClass } from '@/lib/product-badges'
import { formatReminderRule } from '@/lib/product-types'
import { formatReminderLogMessage } from '@/lib/reminder-log-display'
import { getRemindersPageData } from '@/lib/reminders-page'
import { daysUntil, formatCurrency } from '@/lib/utils'

const statusColor: Record<string, string> = {
  PAID: 'badge-paid',
  UNPAID: 'badge-unpaid',
  OVERDUE: 'badge-overdue',
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams?: { logPage?: string }
}) {
  const logPage = Math.max(1, parseInt(searchParams?.logPage || '1', 10) || 1)

  const [data, dateFormat, timezone] = await Promise.all([
    getRemindersPageData(logPage),
    getAppDateFormat(),
    getAppTimezone(),
  ])
  const formatDate = (date: Date | string) => formatDateValue(date, dateFormat, timezone)
  const formatDateTime = (date: Date | string) => formatDateTimeValue(date, dateFormat, timezone)

  const { openInvoices, expiringServices, recentLogs, recentLogsPagination, summary, schedule } = data
  const { total: logsTotal, page: logsPage, pageSize: logsPageSize, totalPages: logsTotalPages } = recentLogsPagination
  const logsRangeStart = logsTotal === 0 ? 0 : (logsPage - 1) * logsPageSize + 1
  const logsRangeEnd = Math.min(logsPage * logsPageSize, logsTotal)

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reminders</h1>
          <p className="page-subtitle">
            Follow up on open invoices and service renewals before they expire.
          </p>
        </div>
        <Link href="/settings" className="btn-secondary">
          Reminder settings
        </Link>
      </div>

      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="text-sm font-medium text-blue-900 dark:text-blue-200">Automatic reminders</div>
        <p className="mt-1 text-sm text-blue-800 dark:text-blue-300">
          Service expiry reminders run daily at {schedule.timeLabel} via cron.
          {schedule.lastRunDate
            ? ` Last auto-run: ${schedule.lastRunDate}.`
            : ' No automatic run recorded yet.'}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Open Invoices"
          value={summary.openCount}
          sub={`${formatCurrency(summary.outstandingAmount)} outstanding`}
          valueClassName="text-yellow-600 dark:text-yellow-400"
          href="/invoices"
        />
        <StatCard
          label="Overdue"
          value={summary.overdueCount}
          sub={summary.overdueCount === 0 ? 'all clear' : summary.overdueCount === 1 ? 'needs immediate follow-up' : 'need immediate follow-up'}
          valueClassName="text-red-600 dark:text-red-400"
          href="/invoices"
        />
        <StatCard
          label="Services Due"
          value={summary.expiringCount}
          sub="based on product type rules"
          valueClassName="text-orange-600 dark:text-orange-400"
          href="/services"
        />
        <StatCard
          label="Telegram Ready"
          value={summary.telegramReady}
          sub="clients with Telegram connected"
          href="/clients"
        />
      </div>

      <div className="mb-4 grid min-w-0 grid-cols-1 gap-4">
        <div className="card card-compact min-w-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Open Invoices ({openInvoices.length})
            </h2>
            <Link href="/invoices" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
              View all
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="w-[18%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Client</th>
                <th className="w-[14%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Invoice No.</th>
                <th className="w-[12%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Price</th>
                <th className="w-[12%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="w-[14%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Due</th>
                <th className="w-[30%] text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {openInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 sm:px-4">
                    No open invoices
                  </td>
                </tr>
              )}
              {openInvoices.map(inv => (
                <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="truncate font-medium" title={inv.client?.name}>
                    <Link href={`/clients/${inv.clientId}`} className="hover:text-blue-700 dark:hover:text-blue-300">
                      {inv.client?.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap font-medium">{inv.invoiceNo}</td>
                  <td className="whitespace-nowrap">{formatCurrency(inv.total)}</td>
                  <td>
                    <span className={`badge ${statusColor[inv.status] || 'badge-unpaid'}`}>{inv.status}</span>
                  </td>
                  <td className="whitespace-nowrap text-xs">{formatDate(inv.dueDate)}</td>
                  <td>
                    <ReminderSendButtons
                      clientId={inv.clientId}
                      invoiceId={inv.id}
                      variant="invoice"
                      hasTelegram={Boolean(inv.client?.telegramId)}
                      clientEmail={inv.client?.email}
                      clientName={inv.client?.name}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-compact min-w-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Services Due for Reminder ({expiringServices.length})
            </h2>
            <Link href="/services" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
              View all
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="w-[16%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Client</th>
                <th className="w-[22%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Service</th>
                <th className="w-[12%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Type</th>
                <th className="w-[18%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Remaining</th>
                <th className="w-[12%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Expires</th>
                <th className="w-[20%] text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expiringServices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 sm:px-4">
                    No services due for reminder based on each product type&apos;s settings
                  </td>
                </tr>
              )}
              {expiringServices.map(svc => {
                const d = daysUntil(svc.expiryDate)
                const remindDays = svc.productType?.reminderDaysBeforeExpiry ?? 14
                const remindTiming = svc.productType?.reminderTiming ?? 'BEFORE'
                const remindRule = formatReminderRule(remindDays, remindTiming)
                return (
                  <tr key={svc.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="truncate font-medium" title={svc.client?.name}>
                      <Link href={`/clients/${svc.clientId}`} className="hover:text-blue-700 dark:hover:text-blue-300">
                        {svc.client?.name}
                      </Link>
                    </td>
                    <td className="truncate font-medium" title={svc.name}>{svc.name}</td>
                    <td>
                      <span className={`badge ${productTypeBadgeClass(svc.productType?.color)}`}>
                        {svc.productType?.name}
                      </span>
                    </td>
                    <td>
                      <div className={`whitespace-nowrap text-xs font-medium ${d < 0 ? 'text-red-600 dark:text-red-400' : d < 7 ? 'text-orange-600 dark:text-orange-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{remindRule}</div>
                    </td>
                    <td className="whitespace-nowrap text-xs">{formatDate(svc.expiryDate)}</td>
                    <td>
                      <ReminderSendButtons
                        clientId={svc.clientId}
                        serviceId={svc.id}
                        variant="service"
                        hasTelegram={Boolean(svc.client?.telegramId)}
                        clientEmail={svc.client?.email}
                        clientName={svc.client?.name}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-compact min-w-0">
        <div className="border-b border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Recent Communications{logsTotal > 0 ? ` (${logsTotal})` : ''}
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="w-[30%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Client</th>
              <th className="w-[40%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Message</th>
              <th className="w-[15%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Channel</th>
              <th className="w-[15%] text-left text-xs font-medium text-gray-500 dark:text-gray-400">Sent</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 sm:px-4">
                  No reminders sent yet
                </td>
              </tr>
            )}
            {recentLogs.map(log => (
              <tr key={log.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="truncate font-medium" title={log.clientName}>
                  <Link href={`/clients/${log.clientId}`} className="hover:text-blue-700 dark:hover:text-blue-300">
                    {log.clientName}
                  </Link>
                </td>
                <td className="truncate text-gray-600 dark:text-gray-300" title={formatReminderLogMessage(log)}>
                  {formatReminderLogMessage(log)}
                </td>
                <td>
                  <span className="badge badge-gray">{log.channel}</span>
                </td>
                <td className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(log.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logsTotal > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-3 dark:border-gray-800 sm:px-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {logsRangeStart}–{logsRangeEnd} of {logsTotal}
            </p>
            {logsTotalPages > 1 && (
              <div className="flex items-center gap-2">
                {logsPage > 1 ? (
                  <Link href={`/reminders?logPage=${logsPage - 1}`} className="btn-secondary py-1 px-2 text-xs">
                    Previous
                  </Link>
                ) : (
                  <span className="btn-secondary py-1 px-2 text-xs opacity-40 pointer-events-none">Previous</span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Page {logsPage} of {logsTotalPages}
                </span>
                {logsPage < logsTotalPages ? (
                  <Link href={`/reminders?logPage=${logsPage + 1}`} className="btn-secondary py-1 px-2 text-xs">
                    Next
                  </Link>
                ) : (
                  <span className="btn-secondary py-1 px-2 text-xs opacity-40 pointer-events-none">Next</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
