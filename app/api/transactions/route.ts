import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getPaymentTransactionSummary,
  listPaymentTransactions,
  listPaymentTransactionsPaginated,
} from '@/lib/db/invoice-payments'
import { isPaginatedRequest, parsePageParams } from '@/lib/pagination'
import type { RevenuePeriod } from '@/lib/revenue-periods'
import { DEFAULT_TIMEZONE } from '@/lib/date-format'

const PERIODS: RevenuePeriod[] = ['all', 'today', 'this_week', 'this_month', 'last_month']

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const timezone = searchParams.get('timezone') || DEFAULT_TIMEZONE
  const rawPeriod = searchParams.get('period') || 'all'
  const period: RevenuePeriod = PERIODS.includes(rawPeriod as RevenuePeriod)
    ? (rawPeriod as RevenuePeriod)
    : 'all'

  if (isPaginatedRequest(searchParams)) {
    const { page, pageSize } = parsePageParams(searchParams)
    const clientId = searchParams.get('clientId') || undefined
    const [result, stats] = await Promise.all([
      listPaymentTransactionsPaginated(page, pageSize, period, timezone, clientId),
      getPaymentTransactionSummary(timezone),
    ])
    return NextResponse.json({
      ...result,
      items: result.items.map(tx => ({
        id: tx.id,
        invoiceId: tx.invoiceId,
        invoiceNo: tx.invoiceNo,
        clientId: tx.clientId,
        amount: tx.amount,
        total: tx.amount,
        paymentMethod: tx.paymentMethod,
        paidAt: tx.paidAt.toISOString(),
        createdAt: tx.invoiceCreatedAt.toISOString(),
        isLegacy: tx.isLegacy,
        client: tx.client,
      })),
      summary: stats.summary,
      allTime: stats.allTime,
    })
  }

  const transactions = await listPaymentTransactions()
  return NextResponse.json(transactions.map(tx => ({
    id: tx.id,
    invoiceId: tx.invoiceId,
    invoiceNo: tx.invoiceNo,
    clientId: tx.clientId,
    amount: tx.amount,
    total: tx.amount,
    paymentMethod: tx.paymentMethod,
    paidAt: tx.paidAt.toISOString(),
    createdAt: tx.invoiceCreatedAt.toISOString(),
    isLegacy: tx.isLegacy,
    client: tx.client,
  })))
}
