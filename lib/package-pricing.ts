import { BillingPeriod } from '@/lib/billing'

export type PackagePricing = {
  billingType?: string
  priceMonthly: number
  priceQuarterly: number
  priceSemiAnnual: number
  priceYearly: number
}

export function getPackagePrice(
  pkg: PackagePricing,
  period: BillingPeriod | string | null,
): number {
  if (String(pkg.billingType || 'RECURRING').toUpperCase() === 'ONE_TIME') {
    return pkg.priceYearly
  }
  switch (period) {
    case 'MONTHLY': return pkg.priceMonthly
    case 'QUARTERLY': return pkg.priceQuarterly
    case 'SEMI_ANNUAL': return pkg.priceSemiAnnual
    case 'YEARLY': return pkg.priceYearly
    default: return pkg.priceYearly
  }
}
