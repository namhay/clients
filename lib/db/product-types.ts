import { getSql, newId } from '@/lib/db'
import type { ProductTypeInput } from '@/lib/product-types'

export type ProductTypeRow = ProductTypeInput & {
  id: string
  createdAt: Date
  updatedAt: Date
}

type ProductTypeWithCounts = ProductTypeRow & {
  _count: { packages: number; services: number }
}

function mapProductType(row: Record<string, unknown>): ProductTypeRow {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    color: String(row.color),
    hasHostingSpecs: Boolean(row.hasHostingSpecs),
    active: Boolean(row.active),
    sortOrder: Number(row.sortOrder),
    reminderDaysBeforeExpiry: Number(row.reminderDaysBeforeExpiry ?? 14),
    autoInvoiceDaysBeforeExpiry: Number(row.autoInvoiceDaysBeforeExpiry ?? 14),
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  }
}

function mapWithCounts(row: Record<string, unknown>): ProductTypeWithCounts {
  return {
    ...mapProductType(row),
    _count: {
      packages: Number(row.package_count ?? 0),
      services: Number(row.service_count ?? 0),
    },
  }
}

export async function listProductTypes(activeOnly = false): Promise<ProductTypeWithCounts[]> {
  const sql = getSql()
  const rows = activeOnly
    ? await sql`
        SELECT pt.*,
          (SELECT COUNT(*)::int FROM "ProductPackage" pp WHERE pp."productTypeId" = pt.id) AS package_count,
          (SELECT COUNT(*)::int FROM "Service" s WHERE s."productTypeId" = pt.id) AS service_count
        FROM "ProductType" pt
        WHERE pt.active = true
        ORDER BY pt."sortOrder" ASC, pt.name ASC
      `
    : await sql`
        SELECT pt.*,
          (SELECT COUNT(*)::int FROM "ProductPackage" pp WHERE pp."productTypeId" = pt.id) AS package_count,
          (SELECT COUNT(*)::int FROM "Service" s WHERE s."productTypeId" = pt.id) AS service_count
        FROM "ProductType" pt
        ORDER BY pt."sortOrder" ASC, pt.name ASC
      `
  return rows.map(r => mapWithCounts(r as Record<string, unknown>))
}

export async function getProductTypeById(id: string): Promise<ProductTypeWithCounts | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT pt.*,
      (SELECT COUNT(*)::int FROM "ProductPackage" pp WHERE pp."productTypeId" = pt.id) AS package_count,
      (SELECT COUNT(*)::int FROM "Service" s WHERE s."productTypeId" = pt.id) AS service_count
    FROM "ProductType" pt
    WHERE pt.id = ${id}
    LIMIT 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapWithCounts(row) : null
}

export async function getProductTypeBySlug(slug: string): Promise<ProductTypeRow | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT id, name, slug, color, "hasHostingSpecs", active, "sortOrder",
      "reminderDaysBeforeExpiry", "autoInvoiceDaysBeforeExpiry", "createdAt", "updatedAt"
    FROM "ProductType" WHERE slug = ${slug.toUpperCase()} LIMIT 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapProductType(row) : null
}

export async function createProductType(data: ProductTypeInput): Promise<ProductTypeRow> {
  const sql = getSql()
  const id = newId()
  const now = new Date()
  const rows = await sql`
    INSERT INTO "ProductType" (
      id, name, slug, color, "hasHostingSpecs", active, "sortOrder",
      "reminderDaysBeforeExpiry", "autoInvoiceDaysBeforeExpiry", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${data.name}, ${data.slug}, ${data.color}, ${data.hasHostingSpecs}, ${data.active},
      ${data.sortOrder}, ${data.reminderDaysBeforeExpiry}, ${data.autoInvoiceDaysBeforeExpiry},
      ${now}, ${now}
    )
    RETURNING id, name, slug, color, "hasHostingSpecs", active, "sortOrder",
      "reminderDaysBeforeExpiry", "autoInvoiceDaysBeforeExpiry", "createdAt", "updatedAt"
  `
  return mapProductType(rows[0] as Record<string, unknown>)
}

export async function updateProductType(id: string, data: ProductTypeInput): Promise<ProductTypeRow> {
  const sql = getSql()
  const now = new Date()
  const rows = await sql`
    UPDATE "ProductType" SET
      name = ${data.name},
      slug = ${data.slug},
      color = ${data.color},
      "hasHostingSpecs" = ${data.hasHostingSpecs},
      active = ${data.active},
      "sortOrder" = ${data.sortOrder},
      "reminderDaysBeforeExpiry" = ${data.reminderDaysBeforeExpiry},
      "autoInvoiceDaysBeforeExpiry" = ${data.autoInvoiceDaysBeforeExpiry},
      "updatedAt" = ${now}
    WHERE id = ${id}
    RETURNING id, name, slug, color, "hasHostingSpecs", active, "sortOrder",
      "reminderDaysBeforeExpiry", "autoInvoiceDaysBeforeExpiry", "createdAt", "updatedAt"
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) throw new Error('Product type not found')
  return mapProductType(row)
}

export async function countProductTypeUsage(id: string) {
  const sql = getSql()
  const rows = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM "ProductPackage" WHERE "productTypeId" = ${id}) AS packages,
      (SELECT COUNT(*)::int FROM "Service" WHERE "productTypeId" = ${id}) AS services
  `
  const row = rows[0] as { packages: number; services: number }
  return { pkgCount: Number(row.packages), svcCount: Number(row.services) }
}

export async function deleteProductType(id: string) {
  const sql = getSql()
  await sql`DELETE FROM "ProductType" WHERE id = ${id}`
}

export async function getMaxReminderWindowDays(): Promise<number> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      COALESCE(MAX("reminderDaysBeforeExpiry"), 14) AS reminder_max,
      COALESCE(MAX("autoInvoiceDaysBeforeExpiry"), 14) AS invoice_max
    FROM "ProductType"
  `
  const row = rows[0] as { reminder_max: number; invoice_max: number }
  return Math.max(Number(row.reminder_max), Number(row.invoice_max), 1)
}
