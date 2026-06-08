import crypto from 'crypto'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function secret() {
  const key = process.env.NEXTAUTH_SECRET
  if (!key) throw new Error('NEXTAUTH_SECRET not set')
  return key
}

export function createInvoicePdfToken(invoiceId: string) {
  const exp = Date.now() + TOKEN_TTL_MS
  const sig = crypto.createHmac('sha256', secret()).update(`${invoiceId}:${exp}`).digest('hex')
  return `${exp}.${sig}`
}

export function verifyInvoicePdfToken(invoiceId: string, token: string) {
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Date.now() > Number(exp)) return false
  const expected = crypto.createHmac('sha256', secret()).update(`${invoiceId}:${exp}`).digest('hex')
  if (sig.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

export function getInvoicePdfDownloadUrl(invoiceId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const token = createInvoicePdfToken(invoiceId)
  return `${base.replace(/\/$/, '')}/api/invoices/${invoiceId}/pdf?token=${token}`
}
