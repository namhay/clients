export const RENEWAL_DAYS_BEFORE_EXPIRY_OPTIONS = [14, 7, 0] as const

export type RenewalDaysBeforeExpiry = (typeof RENEWAL_DAYS_BEFORE_EXPIRY_OPTIONS)[number]

export function parseRenewalDaysBeforeExpiry(value: unknown): RenewalDaysBeforeExpiry {
  const n = parseInt(String(value))
  if (n === 0 || n === 7 || n === 14) return n
  return 14
}

export function formatRenewalTiming(days: number): string {
  if (days === 0) return 'Same day on renewal date'
  if (days === 7) return '7 days before renewal date'
  return '14 days before renewal date'
}

export function parseClientInput(body: Record<string, unknown>) {
  const name = String(body.name || '').trim()
  if (!name) throw new Error('Name is required')

  const email = String(body.email || '').trim()
  if (!email) throw new Error('Email is required')

  return {
    name,
    email,
    phone: body.phone ? String(body.phone).trim() : null,
    company: body.company ? String(body.company).trim() : null,
    companyKhmer: body.companyKhmer ? String(body.companyKhmer).trim() : null,
    address: body.address ? String(body.address).trim() : null,
    vatTin: body.vatTin ? String(body.vatTin).trim() : null,
    telegramId: body.telegramId ? String(body.telegramId).trim() : null,
    notes: body.notes ? String(body.notes).trim() : null,
    renewalDaysBeforeExpiry: parseRenewalDaysBeforeExpiry(body.renewalDaysBeforeExpiry),
  }
}
