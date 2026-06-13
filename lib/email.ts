import nodemailer from 'nodemailer'
import type { AppSettingsData } from '@/lib/settings'
import { getAppSettings } from '@/lib/settings'

async function resolveSmtpConfig(): Promise<AppSettingsData> {
  const settings = await getAppSettings()
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    throw new Error(
      'SMTP is not configured. Add SMTP host, user, and password in Settings, or set SMTP_* in Vercel environment variables.',
    )
  }
  return settings
}

async function getTransporter() {
  const settings = await resolveSmtpConfig()
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 465,
    secure: settings.smtpSecure,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    connectionTimeout: 20_000,
    socketTimeout: 45_000,
    greetingTimeout: 20_000,
  })
}

export type EmailAttachment = {
  filename: string
  content: Buffer
  contentType?: string
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: {
  to: string
  subject: string
  html?: string
  text?: string
  attachments?: EmailAttachment[]
}) {
  const settings = await resolveSmtpConfig()
  const transporter = await getTransporter()

  try {
    return await transporter.sendMail({
      from: settings.smtpFrom || settings.smtpUser,
      to,
      subject,
      html,
      text,
      attachments: attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || 'application/octet-stream',
      })),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Email send failed'
    if (/timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(message)) {
      throw new Error(
        `SMTP connection failed or timed out (${message}). On Vercel, PDF + email can take 30–60s — ensure SMTP_* env vars are set and consider Vercel Pro (60s timeout) or an HTTP email API like Resend.`,
      )
    }
    throw e instanceof Error ? e : new Error(message)
  } finally {
    transporter.close()
  }
}

function emailSignoff() {
  return `If you have any questions, please contact us at https://t.me/itsmart099

Best Regards,

IT-SMART.BIZ
`
}

function emailFooter(brand: string) {
  return `<div style="background:#f9fafb;padding:16px 32px;font-size:12px;color:#999;border-top:1px solid #e5e7eb">This email was sent by ${brand}.</div>`
}

export function invoiceEmailTemplate(params: {
  clientName: string
  invoiceNo: string
  amount: number
  dueDate: string
}) {
  return `Dear ${params.clientName},

Please find attached invoice ${params.invoiceNo} for $${params.amount.toFixed(2)} USD.

Due date: ${params.dueDate}

You can scan QR code on the PDF invoice to pay the invoice. You also can pay by check to our Business Bank Account as mentioned in the PDF invoice.

${emailSignoff()}`
}

export function serviceReminderEmailTemplate(params: {
  clientName: string
  details: string
  dueDate: string
}) {
  return `Dear ${params.clientName},

This is a friendly reminder regarding: ${params.details}

Expiry date: ${params.dueDate}

Please renew before the expiry date to avoid service interruption.

${emailSignoff()}`
}

export function paymentReceivedEmailTemplate(params: {
  clientName: string
  invoiceNo: string
}) {
  return `Dear ${params.clientName},

We have received your payment for invoice ${params.invoiceNo}. Thank you!

${emailSignoff()}`
}

/** @deprecated Use serviceReminderEmailTemplate (plain text) for service reminders */
export function reminderEmailTemplate(params: {
  clientName: string
  type: 'invoice' | 'service'
  details: string
  dueDate: string
  companyName: string
  companyEmail?: string
}) {
  return serviceReminderEmailTemplate({
    clientName: params.clientName,
    details: params.details,
    dueDate: params.dueDate,
  })
}

export function passwordResetEmailTemplate(params: {
  name: string
  resetUrl: string
  companyName: string
}) {
  return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#1d4ed8;padding:24px 32px"><h1 style="color:#fff;margin:0;font-size:24px">${params.companyName}</h1></div>
<div style="padding:32px">
  <h2 style="font-size:20px;margin:0 0 16px">Reset your password</h2>
  <p>Hi <strong>${params.name}</strong>,</p>
  <p>We received a request to reset your ClientDesk password. Click the button below to choose a new password. This link expires in 1 hour.</p>
  <p style="margin:28px 0">
    <a href="${params.resetUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Reset Password</a>
  </p>
  <p style="color:#666;font-size:14px">If you did not request this, you can ignore this email.</p>
  <p style="color:#999;font-size:12px;word-break:break-all">${params.resetUrl}</p>
</div>
${emailFooter(params.companyName || 'IT-SMART.BIZ')}
</body></html>`
}
