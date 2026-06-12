import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import InvoicePDF from '@/components/invoices/InvoicePDF'
import { getAppDateFormat, getAppTimezone } from '@/lib/app-date'
import { getInvoiceCompanyProfile } from '@/lib/invoice-company'
import { registerInvoiceFontsForPdf } from '@/lib/invoice-fonts'
import { getInvoiceForPdf } from '@/lib/db/invoices'
import { enrichInvoiceItemsWithPeriods } from '@/lib/invoices'
import { getBrandingAssetSrc } from '@/lib/branding-assets'

type InvoiceWithRelations = NonNullable<Awaited<ReturnType<typeof getInvoiceForPdf>>>

export async function getPaymentQrSrc() {
  return getBrandingAssetSrc('qr')
}

export function toPdfInvoicePayload(invoice: InvoiceWithRelations) {
  return {
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    dueDate: invoice.dueDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    total: invoice.total,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    notes: invoice.notes,
    items: invoice.items.map(i => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
      periodStart: i.periodStart?.toISOString() ?? null,
      periodEnd: i.periodEnd?.toISOString() ?? null,
    })),
    client: {
      name: invoice.client.name,
      email: invoice.client.email,
      phone: invoice.client.phone,
      company: invoice.client.company,
      companyKhmer: invoice.client.companyKhmer,
      address: invoice.client.address,
      vatTin: invoice.client.vatTin,
    },
  }
}

export async function generateInvoicePdfBuffer(invoiceId: string) {
  registerInvoiceFontsForPdf()

  const invoice = await getInvoiceForPdf(invoiceId)
  if (!invoice) throw new Error('Invoice not found')
  const [company, dateFormat, timezone, items] = await Promise.all([
    getInvoiceCompanyProfile(),
    getAppDateFormat(),
    getAppTimezone(),
    enrichInvoiceItemsWithPeriods(invoice),
  ])
  const pdfInvoice = toPdfInvoicePayload({ ...invoice, items })
  const [paymentQrSrc, logoSrc, stampSrc] = await Promise.all([
    getBrandingAssetSrc('qr'),
    getBrandingAssetSrc('logo'),
    getBrandingAssetSrc('stamp'),
  ])

  const doc = React.createElement(InvoicePDF, {
    invoice: pdfInvoice,
    company,
    dateFormat,
    timezone,
    paymentQrSrc,
    logoSrc,
    stampSrc,
  })
  const raw = await renderToBuffer(doc as unknown as React.ReactElement)
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array)
  return { buffer, invoice, company }
}
