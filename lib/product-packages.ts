export type PackageBillingType = 'RECURRING' | 'ONE_TIME'

export type ProductPackageInput = {
  productTypeId: string
  name: string
  description: string | null
  diskSpaceGb: number | null
  bandwidthGb: number | null
  emailAccounts: number | null
  databases: number | null
  addonDomains: number | null
  billingType: PackageBillingType
  priceMonthly: number
  priceQuarterly: number
  priceSemiAnnual: number
  priceYearly: number
  setupFee: number
  active: boolean
  sortOrder: number
}

export function parsePackageBillingType(value: unknown): PackageBillingType {
  return String(value || 'RECURRING').toUpperCase() === 'ONE_TIME' ? 'ONE_TIME' : 'RECURRING'
}

export function isOneTimePackage(pkg: { billingType?: string }): boolean {
  return parsePackageBillingType(pkg.billingType) === 'ONE_TIME'
}

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = parseInt(String(value))
  return Number.isNaN(n) ? null : n
}

export function parseProductPackageInput(
  body: Record<string, unknown>,
  hasHostingSpecs = false,
): ProductPackageInput {
  const productTypeId = String(body.productTypeId || '').trim()
  if (!productTypeId) throw new Error('Product type is required')

  const name = String(body.name || '').trim()
  if (!name) throw new Error('Package name is required')

  const billingType = parsePackageBillingType(body.billingType)
  const oneTimePrice = parseFloat(String(body.oneTimePrice ?? body.priceYearly)) || 0

  return {
    productTypeId,
    name,
    description: body.description ? String(body.description).trim() : null,
    diskSpaceGb: hasHostingSpecs ? (parseOptionalInt(body.diskSpaceGb) ?? 0) : null,
    bandwidthGb: hasHostingSpecs ? (parseOptionalInt(body.bandwidthGb) ?? 0) : null,
    emailAccounts: hasHostingSpecs ? (parseOptionalInt(body.emailAccounts) ?? 0) : null,
    databases: hasHostingSpecs ? (parseOptionalInt(body.databases) ?? 0) : null,
    addonDomains: hasHostingSpecs ? (parseOptionalInt(body.addonDomains) ?? 0) : null,
    billingType,
    priceMonthly: billingType === 'ONE_TIME' ? 0 : parseFloat(String(body.priceMonthly)) || 0,
    priceQuarterly: billingType === 'ONE_TIME' ? 0 : parseFloat(String(body.priceQuarterly)) || 0,
    priceSemiAnnual: billingType === 'ONE_TIME' ? 0 : parseFloat(String(body.priceSemiAnnual)) || 0,
    priceYearly: billingType === 'ONE_TIME' ? oneTimePrice : parseFloat(String(body.priceYearly)) || 0,
    setupFee: parseFloat(String(body.setupFee)) || 0,
    active: body.active !== false,
    sortOrder: parseInt(String(body.sortOrder)) || 0,
  }
}

export function productPackageFields(data: ProductPackageInput): ProductPackageInput {
  return data
}
