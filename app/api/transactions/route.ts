import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTransactionSummary, listTransactions, listTransactionsPaginated } from '@/lib/db/invoices'
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
    const [result, stats] = await Promise.all([
      listTransactionsPaginated(page, pageSize, period, timezone),
      getTransactionSummary(timezone),
    ])
    return NextResponse.json({ ...result, summary: stats.summary, allTime: stats.allTime })
  }

  const transactions = await listTransactions()
  return NextResponse.json(transactions)
}
