import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClientById } from '@/lib/db/clients'
import { getInvoiceById } from '@/lib/db/invoices'
import { createReminderLog } from '@/lib/db/reminder-logs'
import { getServiceById } from '@/lib/db/services'
import { formatAppDate } from '@/lib/app-date'
import { sendEmail, serviceReminderEmailTemplate } from '@/lib/email'
import { sendInvoiceEmailWithPdf } from '@/lib/invoice-email'
import { getAppSettings } from '@/lib/settings'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clientId, type, invoiceId, serviceId } = await req.json()
  const client = await getClientById(clientId)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  try {
    const settings = await getAppSettings()
    const companyName = settings.companyName
    let subject = ''

    if (type === 'invoice' && invoiceId) {
      const invoice = await getInvoiceById(invoiceId)
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      const result = await sendInvoiceEmailWithPdf({
        invoiceId,
        to: client.email,
        clientName: client.name,
        invoiceNo: invoice.invoiceNo,
        amount: invoice.total,
        dueDate: await formatAppDate(invoice.dueDate),
        companyName,
        companyEmail: settings.companyEmail,
      })
      subject = result.subject
    } else if (type === 'reminder') {
      let details = 'Payment due'
      let dueDate = await formatAppDate(new Date())

      if (serviceId) {
        const service = await getServiceById(serviceId)
        if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
        details = `${service.productType.name} — ${service.name}`
        dueDate = await formatAppDate(service.expiryDate)
      }

      subject = `Reminder: ${details} expiring soon`
      await sendEmail({
        to: client.email,
        subject,
        text: serviceReminderEmailTemplate({
          clientName: client.name,
          details,
          dueDate,
        }),
      })
    } else {
      return NextResponse.json({ error: 'Invalid email type' }, { status: 400 })
    }

    await createReminderLog({
      clientId,
      type: subject,
      channel: 'Email',
      status: 'sent',
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Email send failed'
    console.error('[reminders/email]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
