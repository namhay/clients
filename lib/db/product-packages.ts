import { getSql, newId } from '@/lib/db'
import type { ProductPackageInput } from '@/lib/product-packages'
import type { ProductTypeRow } from '@/lib/db/product-types'

export type ProductPackageRow = ProductPackageInput & {
  id: string
  createdAt: Date
  updatedAt: Date
}

export type ProductPackageWithRelations = ProductPackageRow & {
  productType: ProductTypeRow
  _count: { services: number }
}

function mapProductPackage(row: Record<string, unknown>): ProductPackageRow {
  return {
    id: String(row.id),
    productTypeId: String(row.productTypeId),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    diskSpaceGb: row.diskSpaceGb != null ? Number(row.diskSpaceGb) : null,
    bandwidthGb: row.bandwidthGb != null ? Number(row.bandwidthGb) : null,
    emailAccounts: row.emailAccounts != null ? Number(row.emailAccounts) : null,
    databases: row.databases != null ? Number(row.databases) : null,
    addonDomains: row.addonDomains != null ? Number(row.addonDomains) : null,
    priceMonthly: Number(row.priceMonthly ?? 0),
    priceQuarterly: Number(row.priceQuarterly ?? 0),
    priceSemiAnnual: Number(row.priceSemiAnnual ?? 0),
    priceYearly: Number(row.priceYearly ?? 0),
    setupFee: Number(row.setupFee ?? 0),
    active: Boolean(row.active),
    sortOrder: Number(row.sortOrder ?? 0),
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  }
}

function mapWithRelations(row: Record<string, unknown>): ProductPackageWithRelations {
  const pkg = mapProductPackage(row)
  const productType: ProductTypeRow = {
    id: String(row.pt_id),
    name: String(row.pt_name),
    slug: String(row.pt_slug),
    color: String(row.pt_color),
    hasHostingSpecs: Boolean(row.pt_hasHostingSpecs),
    active: Boolean(row.pt_active),
    sortOrder: Number(row.pt_sortOrder),
    reminderDaysBeforeExpiry: Number(row.pt_reminderDaysBeforeExpiry ?? 14),
    reminderTiming: String(row.pt_reminderTiming ?? 'BEFORE').toUpperCase() === 'AFTER' ? 'AFTER' : 'BEFORE',
    autoInvoiceDaysBeforeExpiry: Number(row.pt_autoInvoiceDaysBeforeExpiry ?? 14),
    createdAt: new Date(row.pt_createdAt as string),
    updatedAt: new Date(row.pt_updatedAt as string),
  }
  return {
    ...pkg,
    productType,
    _count: { services: Number(row.service_count ?? 0) },
  }
}

const PACKAGE_SELECT = `
  pp.id, pp."productTypeId", pp.name, pp.description,
  pp."diskSpaceGb", pp."bandwidthGb", pp."emailAccounts", pp.databases, pp."addonDomains",
  pp."priceMonthly", pp."priceQuarterly", pp."priceSemiAnnual", pp."priceYearly",
  pp."setupFee", pp.active, pp."sortOrder", pp."createdAt", pp."updatedAt",
  pt.id AS pt_id, pt.name AS pt_name, pt.slug AS pt_slug, pt.color AS pt_color,
  pt."hasHostingSpecs" AS pt_hasHostingSpecs, pt.active AS pt_active, pt."sortOrder" AS pt_sortOrder,
  pt."reminderDaysBeforeExpiry" AS pt_reminderDaysBeforeExpiry,
  pt."reminderTiming" AS pt_reminderTiming,
  pt."autoInvoiceDaysBeforeExpiry" AS pt_autoInvoiceDaysBeforeExpiry,
  pt."createdAt" AS pt_createdAt, pt."updatedAt" AS pt_updatedAt,
  (SELECT COUNT(*)::int FROM "Service" s WHERE s."productPackageId" = pp.id) AS service_count
`

export type ProductPackageFilters = {
  activeOnly?: boolean
  productTypeId?: string
  productTypeSlug?: string
}

export async function listProductPackages(filters: ProductPackageFilters = {}): Promise<ProductPackageWithRelations[]> {
  const sql = getSql()
  const { activeOnly, productTypeId, productTypeSlug } = filters

  let rows
  if (productTypeId) {
    rows = activeOnly
      ? await sql`
          SELECT ${sql.unsafe(PACKAGE_SELECT)}
          FROM "ProductPackage" pp
          JOIN "ProductType" pt ON pt.id = pp."productTypeId"
          WHERE pp."productTypeId" = ${productTypeId} AND pp.active = true
          ORDER BY pp."sortOrder" ASC, pp.name ASC
        `
      : await sql`
          SELECT ${sql.unsafe(PACKAGE_SELECT)}
          FROM "ProductPackage" pp
          JOIN "ProductType" pt ON pt.id = pp."productTypeId"
          WHERE pp."productTypeId" = ${productTypeId}
          ORDER BY pp."sortOrder" ASC, pp.name ASC
        `
  } else if (productTypeSlug) {
    const slug = productTypeSlug.toUpperCase()
    rows = activeOnly
      ? await sql`
          SELECT ${sql.unsafe(PACKAGE_SELECT)}
          FROM "ProductPackage" pp
          JOIN "ProductType" pt ON pt.id = pp."productTypeId"
          WHERE pt.slug = ${slug} AND pp.active = true
          ORDER BY pp."sortOrder" ASC, pp.name ASC
        `
      : await sql`
          SELECT ${sql.unsafe(PACKAGE_SELECT)}
          FROM "ProductPackage" pp
          JOIN "ProductType" pt ON pt.id = pp."productTypeId"
          WHERE pt.slug = ${slug}
          ORDER BY pp."sortOrder" ASC, pp.name ASC
        `
  } else {
    rows = activeOnly
      ? await sql`
          SELECT ${sql.unsafe(PACKAGE_SELECT)}
          FROM "ProductPackage" pp
          JOIN "ProductType" pt ON pt.id = pp."productTypeId"
          WHERE pp.active = true
          ORDER BY pp."sortOrder" ASC, pp.name ASC
        `
      : await sql`
          SELECT ${sql.unsafe(PACKAGE_SELECT)}
          FROM "ProductPackage" pp
          JOIN "ProductType" pt ON pt.id = pp."productTypeId"
          ORDER BY pp."sortOrder" ASC, pp.name ASC
        `
  }

  return rows.map(r => mapWithRelations(r as Record<string, unknown>))
}

export async function getProductPackageById(id: string): Promise<ProductPackageWithRelations | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT ${sql.unsafe(PACKAGE_SELECT)}
    FROM "ProductPackage" pp
    JOIN "ProductType" pt ON pt.id = pp."productTypeId"
    WHERE pp.id = ${id}
    LIMIT 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapWithRelations(row) : null
}

export async function createProductPackage(data: ProductPackageInput): Promise<ProductPackageWithRelations> {
  const sql = getSql()
  const id = newId()
  const now = new Date()
  await sql`
    INSERT INTO "ProductPackage" (
      id, "productTypeId", name, description,
      "diskSpaceGb", "bandwidthGb", "emailAccounts", databases, "addonDomains",
      "priceMonthly", "priceQuarterly", "priceSemiAnnual", "priceYearly",
      "setupFee", active, "sortOrder", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${data.productTypeId}, ${data.name}, ${data.description},
      ${data.diskSpaceGb}, ${data.bandwidthGb}, ${data.emailAccounts}, ${data.databases}, ${data.addonDomains},
      ${data.priceMonthly}, ${data.priceQuarterly}, ${data.priceSemiAnnual}, ${data.priceYearly},
      ${data.setupFee}, ${data.active}, ${data.sortOrder}, ${now}, ${now}
    )
  `
  const pkg = await getProductPackageById(id)
  if (!pkg) throw new Error('Failed to create product package')
  return pkg
}

export async function updateProductPackage(id: string, data: ProductPackageInput): Promise<ProductPackageWithRelations> {
  const sql = getSql()
  const now = new Date()
  const rows = await sql`
    UPDATE "ProductPackage" SET
      "productTypeId" = ${data.productTypeId},
      name = ${data.name},
      description = ${data.description},
      "diskSpaceGb" = ${data.diskSpaceGb},
      "bandwidthGb" = ${data.bandwidthGb},
      "emailAccounts" = ${data.emailAccounts},
      databases = ${data.databases},
      "addonDomains" = ${data.addonDomains},
      "priceMonthly" = ${data.priceMonthly},
      "priceQuarterly" = ${data.priceQuarterly},
      "priceSemiAnnual" = ${data.priceSemiAnnual},
      "priceYearly" = ${data.priceYearly},
      "setupFee" = ${data.setupFee},
      active = ${data.active},
      "sortOrder" = ${data.sortOrder},
      "updatedAt" = ${now}
    WHERE id = ${id}
    RETURNING id
  `
  if (!rows[0]) throw new Error('Product package not found')
  const pkg = await getProductPackageById(id)
  if (!pkg) throw new Error('Product package not found')
  return pkg
}

export async function countProductPackageUsage(id: string): Promise<number> {
  const sql = getSql()
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM "Service" WHERE "productPackageId" = ${id}
  `
  return Number((rows[0] as { count: number }).count)
}

export async function deleteProductPackage(id: string) {
  const sql = getSql()
  await sql`DELETE FROM "ProductPackage" WHERE id = ${id}`
}
