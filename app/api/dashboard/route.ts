import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()
  const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30)
  const [totalClients, unpaidInvoices, paidInvoices, expiringServices, recentInvoices, expiringList] = await Promise.all([
    prisma.client.count(),
    prisma.invoice.count({ where: { status: { in: ['UNPAID', 'OVERDUE'] } } }),
    prisma.invoice.findMany({ where: { status: 'PAID' } }),
    prisma.service.count({ where: { expiryDate: { lte: thirtyDays }, status: 'ACTIVE' } }),
    prisma.invoice.findMany({ take: 5, include: { client: true, items: true }, orderBy: { createdAt: 'desc' } }),
    prisma.service.findMany({ where: { expiryDate: { lte: thirtyDays }, status: 'ACTIVE' }, include: { client: true }, orderBy: { expiryDate: 'asc' } }),
  ])
  const totalRevenue = paidInvoices.reduce((s, i) => s + i.total, 0)
  return NextResponse.json({ totalClients, unpaidInvoices, totalRevenue, expiringServices, recentInvoices, expiringList })
}
