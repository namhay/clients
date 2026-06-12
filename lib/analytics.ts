import { getSql } from '@/lib/db'
import { listInvoiceSummaries } from '@/lib/db/invoices'
import { countOrders } from '@/lib/db/orders'
import { countClients } from '@/lib/db/clients'
import {
  filterServicesInReminderWindow,
  listServicesForReminderDisplay,
} from '@/lib/reminders'

export type FinancialSummary = {
  paidCount: number
  paidTotal: number
  openCount: number
  openTotal: number
  overdueCount: number
  overdueTotal: number
  totalInvoices: number
}

export type MonthlyRevenueRow = {
  month: string
  label: string
  revenue: number
  count: number
}

export type ProductTypeServiceRow = {
  id: string
  name: string
  color: string
  active: number
  total: number
}

export type TopClientRow = {
  id: string
  name: string
  revenue: number
  invoiceCount: number
}

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid_count,
      COALESCE(SUM(total) FILTER (WHERE status = 'PAID'), 0)::float AS paid_total,
      COUNT(*) FILTER (WHERE status IN ('UNPAID', 'OVERDUE'))::int AS open_count,
      COALESCE(SUM(total) FILTER (WHERE status IN ('UNPAID', 'OVERDUE')), 0)::float AS open_total,
      COUNT(*) FILTER (WHERE status = 'OVERDUE')::int AS overdue_count,
      COALESCE(SUM(total) FILTER (WHERE status = 'OVERDUE'), 0)::float AS overdue_total
    FROM "Invoice"
  `
  const row = rows[0] as Record<string, number>
  return {
    totalInvoices: Number(row.total),
    paidCount: Number(row.paid_count),
    paidTotal: Number(row.paid_total),
    openCount: Number(row.open_count),
    openTotal: Number(row.open_total),
    overdueCount: Number(row.overdue_count),
    overdueTotal: Number(row.overdue_total),
  }
}

export async function getRevenueThisMonth(): Promise<{ revenue: number; count: number }> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      COALESCE(SUM(total), 0)::float AS revenue,
      COUNT(*)::int AS count
    FROM "Invoice"
    WHERE status = 'PAID'
      AND COALESCE("paidAt", "updatedAt") >= date_trunc('month', NOW())
  `
  const row = rows[0] as { revenue: number; count: number }
  return { revenue: Number(row.revenue), count: Number(row.count) }
}

export async function getMonthlyRevenue(months = 6): Promise<MonthlyRevenueRow[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      to_char(date_trunc('month', COALESCE("paidAt", "updatedAt")), 'YYYY-MM') AS month,
      COALESCE(SUM(total), 0)::float AS revenue,
      COUNT(*)::int AS count
    FROM "Invoice"
    WHERE status = 'PAID'
      AND COALESCE("paidAt", "updatedAt") >= (date_trunc('month', NOW()) - (${months - 1} || ' months')::interval)
    GROUP BY 1
    ORDER BY 1 ASC
  `

  const byMonth = new Map<string, { revenue: number; count: number }>()
  for (const row of rows) {
    const r = row as { month: string; revenue: number; count: number }
    byMonth.set(r.month, { revenue: Number(r.revenue), count: Number(r.count) })
  }

  const result: MonthlyRevenueRow[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = byMonth.get(key) ?? { revenue: 0, count: 0 }
    result.push({
      month: key,
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      revenue: entry.revenue,
      count: entry.count,
    })
  }
  return result
}

export async function getServicesByProductType(): Promise<ProductTypeServiceRow[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      pt.id,
      pt.name,
      pt.color,
      COUNT(*) FILTER (WHERE s.status = 'ACTIVE')::int AS active,
      COUNT(*)::int AS total
    FROM "Service" s
    JOIN "ProductType" pt ON pt.id = s."productTypeId"
    GROUP BY pt.id, pt.name, pt.color, pt."sortOrder"
    ORDER BY pt."sortOrder", pt.name
  `
  return rows.map(r => {
    const row = r as { id: string; name: string; color: string; active: number; total: number }
    return {
      id: String(row.id),
      name: String(row.name),
      color: String(row.color),
      active: Number(row.active),
      total: Number(row.total),
    }
  })
}

export async function getServiceStatusCounts(): Promise<{ active: number; expired: number; total: number }> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
      COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
      COUNT(*)::int AS total
    FROM "Service"
  `
  const row = rows[0] as { active: number; expired: number; total: number }
  return {
    active: Number(row.active),
    expired: Number(row.expired),
    total: Number(row.total),
  }
}

export async function getTopClientsByRevenue(limit = 5): Promise<TopClientRow[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      c.id,
      c.name,
      COALESCE(SUM(i.total), 0)::float AS revenue,
      COUNT(i.id)::int AS invoice_count
    FROM "Client" c
    LEFT JOIN "Invoice" i ON i."clientId" = c.id AND i.status = 'PAID'
    GROUP BY c.id, c.name
    HAVING COALESCE(SUM(i.total), 0) > 0
    ORDER BY revenue DESC
    LIMIT ${limit}
  `
  return rows.map(r => {
    const row = r as { id: string; name: string; revenue: number; invoice_count: number }
    return {
      id: String(row.id),
      name: String(row.name),
      revenue: Number(row.revenue),
      invoiceCount: Number(row.invoice_count),
    }
  })
}

export async function getDashboardData() {
  const [
    totalClients,
    financial,
    revenueThisMonth,
    serviceStatus,
    recentInvoices,
    openInvoices,
    candidateServices,
    orders,
  ] = await Promise.all([
    countClients(),
    getFinancialSummary(),
    getRevenueThisMonth(),
    getServiceStatusCounts(),
    listInvoiceSummaries('recent', 6),
    listInvoiceSummaries('open', 5),
    listServicesForReminderDisplay(),
    countOrders(),
  ])

  const dueForReminder = filterServicesInReminderWindow(candidateServices)
  const expiringList = dueForReminder.slice(0, 6)

  return {
    totalClients,
    activeServices: serviceStatus.active,
    expiredServices: serviceStatus.expired,
    unpaidInvoices: financial.openCount,
    outstandingAmount: financial.openTotal,
    overdueInvoices: financial.overdueCount,
    overdueAmount: financial.overdueTotal,
    totalRevenue: financial.paidTotal,
    revenueThisMonth: revenueThisMonth.revenue,
    paymentsThisMonth: revenueThisMonth.count,
    totalOrders: orders,
    expiringServices: dueForReminder.length,
    recentInvoices,
    openInvoices,
    expiringList,
  }
}

export async function getReportsData() {
  const [
    financial,
    monthlyRevenue,
    servicesByType,
    serviceStatus,
    topClients,
    recentTransactions,
    totalClients,
    orders,
  ] = await Promise.all([
    getFinancialSummary(),
    getMonthlyRevenue(12),
    getServicesByProductType(),
    getServiceStatusCounts(),
    getTopClientsByRevenue(5),
    listInvoiceSummaries('paid', 6),
    countClients(),
    countOrders(),
  ])

  return {
    financial,
    monthlyRevenue,
    servicesByType,
    serviceStatus,
    topClients,
    recentTransactions,
    totalClients,
    totalOrders: orders,
  }
}
