export const PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH', 'CREDIT_CARD'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
}

export function parsePaymentMethod(value: unknown): PaymentMethod | null {
  const normalized = String(value || '').toUpperCase().replace(/[\s-]+/g, '_')
  if (normalized === 'BANK_TRANSFER' || normalized === 'BANKTRANSFER') return 'BANK_TRANSFER'
  if (normalized === 'CASH') return 'CASH'
  if (normalized === 'CREDIT_CARD' || normalized === 'CREDITCARD') return 'CREDIT_CARD'
  return null
}
