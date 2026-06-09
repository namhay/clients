import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { countClients } from '@/lib/db/clients'
import { countUnpaidInvoices, getPaidInvoices, listInvoices } from '@/lib/db/invoices'
import { listServices } from '@/lib/db/services'
import {
  filterServicesDueForReminder,
  getReminderExpiryBounds,
} from '@/lib/reminders'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bounds = await getReminderExpiryBounds()

  const [totalClients, unpaidInvoices, paidInvoices, candidateServices, recentInvoices] = await Promise.all([
    countClients(),
    countUnpaidInvoices(),
    getPaidInvoices(),
    listServices({
      expiryDateGte: bounds.gte,
      expiryDateLte: bounds.lte,
      status: 'ACTIVE',
    }),
    listInvoices({ limit: 5 }),
  ])

  const expiringList = filterServicesDueForReminder(candidateServices)
  const totalRevenue = paidInvoices.reduce((s, i) => s + i.total, 0)

  return NextResponse.json({
    totalClients,
    unpaidInvoices,
    totalRevenue,
    expiringServices: expiringList.length,
    recentInvoices,
    expiringList,
  })
}
