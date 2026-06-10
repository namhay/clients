import { sendEmail, invoiceEmailTemplate } from '@/lib/email'
import { generateInvoicePdfBuffer } from '@/lib/invoice-pdf'

export async function sendInvoiceEmailWithPdf(params: {
  invoiceId: string
  to: string
  clientName: string
  invoiceNo: string
  amount: number
  dueDate: string
  companyName: string
  companyEmail?: string
}) {
  const { buffer } = await generateInvoicePdfBuffer(params.invoiceId)
  const subject = `Invoice ${params.invoiceNo} — $${params.amount.toFixed(2)} USD`

  await sendEmail({
    to: params.to,
    subject,
    text: invoiceEmailTemplate({
      clientName: params.clientName,
      invoiceNo: params.invoiceNo,
      amount: params.amount,
      dueDate: params.dueDate,
    }),
    attachments: [
      {
        filename: `${params.invoiceNo}.pdf`,
        content: buffer,
        contentType: 'application/pdf',
      },
    ],
  })

  return { subject }
}
