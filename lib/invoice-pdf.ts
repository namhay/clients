import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import InvoicePDF from '@/components/invoices/InvoicePDF'
import { getAppDateFormat, getAppTimezone } from '@/lib/app-date'
import { getInvoiceCompanyProfile } from '@/lib/invoice-company'
import { registerInvoiceFontsForPdf } from '@/lib/invoice-fonts'
import { getInvoiceForPdf } from '@/lib/db/invoices'
import { listPaymentsForInvoice } from '@/lib/db/invoice-payments'
import { enrichInvoiceItemsWithPeriods } from '@/lib/invoices'
import { getBrandingAssetSrc } from '@/lib/branding-assets'
import { generateKhqrQrDataUrl, getKhqrConfig } from '@/lib/khqr'

type InvoiceWithRelations = NonNullable<Awaited<ReturnType<typeof getInvoiceForPdf>>>

export async function getPaymentQrSrc() {
  return getBrandingAssetSrc('qr')
}

export function getInvoiceBalanceDue(
  total: number,
  payments: { amount: number }[] = [],
): number {
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  return Math.max(0, total - paid)
}

export async function getDynamicPaymentQrSrc(params: {
  invoiceNo: string
  total: number
  payments: { amount: number }[]
  merchantName: string
}): Promise<{ src: string; amount: number; currency: 'USD' | 'KHR' } | null> {
  const config = getKhqrConfig()
  if (!config) return null

  const amount = getInvoiceBalanceDue(params.total, params.payments)
  if (amount <= 0) return null

  try {
    const src = await generateKhqrQrDataUrl({
      amount,
      merchantName: params.merchantName,
      acquiringBank: config.acquiringBank,
      billNumber: params.invoiceNo,
      config,
    })
    return { src, amount, currency: config.currency }
  } catch (error) {
    console.error('Dynamic KHQR generation failed:', error)
    return null
  }
}

export function toPdfInvoicePayload(
  invoice: InvoiceWithRelations,
  payments: Awaited<ReturnType<typeof listPaymentsForInvoice>> = [],
) {
  return {
    invoiceNo: invoice.invoiceNo,
    status: invoice.status,
    dueDate: invoice.dueDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    total: invoice.total,
    subtotal: invoice.subtotal,
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
    payments: payments.map(p => ({
      paidAt: p.paidAt.toISOString(),
      paymentMethod: p.paymentMethod,
      amount: p.amount,
    })),
  }
}

export async function generateInvoicePdfBuffer(invoiceId: string) {
  registerInvoiceFontsForPdf()

  const invoice = await getInvoiceForPdf(invoiceId)
  if (!invoice) throw new Error('Invoice not found')
  const [company, dateFormat, timezone, items, payments] = await Promise.all([
    getInvoiceCompanyProfile(),
    getAppDateFormat(),
    getAppTimezone(),
    enrichInvoiceItemsWithPeriods(invoice),
    listPaymentsForInvoice(invoiceId),
  ])
  const pdfInvoice = toPdfInvoicePayload({ ...invoice, items }, payments)
  const [dynamicQr, staticQrSrc, logoSrc, stampSrc] = await Promise.all([
    getDynamicPaymentQrSrc({
      invoiceNo: invoice.invoiceNo,
      total: invoice.total,
      payments,
      merchantName: company.bankAccountName || company.name,
    }),
    getBrandingAssetSrc('qr'),
    getBrandingAssetSrc('logo'),
    getBrandingAssetSrc('stamp'),
  ])
  const paymentQrSrc = dynamicQr?.src ?? staticQrSrc

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
