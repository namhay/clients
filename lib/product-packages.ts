export type ProductPackageInput = {
  productTypeId: string
  name: string
  description: string | null
  diskSpaceGb: number | null
  bandwidthGb: number | null
  emailAccounts: number | null
  databases: number | null
  addonDomains: number | null
  priceMonthly: number
  priceQuarterly: number
  priceSemiAnnual: number
  priceYearly: number
  setupFee: number
  active: boolean
  sortOrder: number
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

  return {
    productTypeId,
    name,
    description: body.description ? String(body.description).trim() : null,
    diskSpaceGb: hasHostingSpecs ? (parseOptionalInt(body.diskSpaceGb) ?? 0) : null,
    bandwidthGb: hasHostingSpecs ? (parseOptionalInt(body.bandwidthGb) ?? 0) : null,
    emailAccounts: hasHostingSpecs ? (parseOptionalInt(body.emailAccounts) ?? 0) : null,
    databases: hasHostingSpecs ? (parseOptionalInt(body.databases) ?? 0) : null,
    addonDomains: hasHostingSpecs ? (parseOptionalInt(body.addonDomains) ?? 0) : null,
    priceMonthly: parseFloat(String(body.priceMonthly)) || 0,
    priceQuarterly: parseFloat(String(body.priceQuarterly)) || 0,
    priceSemiAnnual: parseFloat(String(body.priceSemiAnnual)) || 0,
    priceYearly: parseFloat(String(body.priceYearly)) || 0,
    setupFee: parseFloat(String(body.setupFee)) || 0,
    active: body.active !== false,
    sortOrder: parseInt(String(body.sortOrder)) || 0,
  }
}

export function productPackageFields(data: ProductPackageInput): ProductPackageInput {
  return data
}
