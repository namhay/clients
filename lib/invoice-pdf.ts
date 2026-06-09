import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import InvoicePDF from '@/components/invoices/InvoicePDF'
import { getInvoiceCompanyProfile } from '@/lib/invoice-company'
import { registerInvoiceFonts } from '@/lib/invoice-fonts'
import { getInvoiceForPdf } from '@/lib/db/invoices'

type InvoiceWithRelations = NonNullable<Awaited<ReturnType<typeof getInvoiceForPdf>>>

/** Absolute file:// URL for @react-pdf/renderer on Node (data URIs are unreliable server-side). */
export function getInvoiceAssetSrc(filename: string): string | undefined {
  const assetPath = path.join(process.cwd(), 'public', filename)
  if (!fs.existsSync(assetPath)) return undefined
  return pathToFileURL(assetPath).href
}

export function getPaymentQrSrc() {
  return getInvoiceAssetSrc('aba-qr.png')
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
      address: invoice.client.address,
      vatTin: invoice.client.vatTin,
    },
  }
}

export async function generateInvoicePdfBuffer(invoiceId: string) {
  registerInvoiceFonts()

  const invoice = await getInvoiceForPdf(invoiceId)
  if (!invoice) throw new Error('Invoice not found')
  const company = await getInvoiceCompanyProfile()
  const pdfInvoice = toPdfInvoicePayload(invoice)

  const doc = React.createElement(InvoicePDF, {
    invoice: pdfInvoice,
    company,
    paymentQrSrc: getPaymentQrSrc(),
    logoSrc: getInvoiceAssetSrc('invoice-logo.png'),
    stampSrc: getInvoiceAssetSrc('invoice-stamp.png'),
  })
  const raw = await renderToBuffer(doc as unknown as React.ReactElement)
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array)
  return { buffer, invoice, company }
}
