import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, invoiceEmailTemplate, reminderEmailTemplate } from '@/lib/email'
import { getAppSettings } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clientId, type, invoiceId, serviceId } = await req.json()
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const settings = await getAppSettings()
  const companyName = settings.companyName
  let html = ''
  let subject = ''
  if (type === 'invoice' && invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { items: true } })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    subject = `Invoice ${invoice.invoiceNo} — $${invoice.total.toFixed(2)} USD`
    html = invoiceEmailTemplate({
      clientName: client.name, invoiceNo: invoice.invoiceNo,
      amount: invoice.total, dueDate: invoice.dueDate.toISOString().split('T')[0],
      items: invoice.items.map(i => ({ description: i.description, total: i.total })),
      companyName, notes: invoice.notes || '',
    })
  } else if (type === 'reminder') {
    const details = serviceId
      ? (await prisma.service.findUnique({ where: { id: serviceId } }))?.name || 'Service'
      : 'Payment due'
    subject = `Reminder: Action required — ${details}`
    html = reminderEmailTemplate({
      clientName: client.name, type: serviceId ? 'service' : 'invoice',
      details, dueDate: new Date().toISOString().split('T')[0], companyName,
      companyEmail: settings.companyEmail,
    })
  }
  await sendEmail({ to: client.email, subject, html })
  await prisma.reminderLog.create({
    data: { clientId, type: subject, channel: 'Email', status: 'sent' },
  })
  return NextResponse.json({ success: true })
}
