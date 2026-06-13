import { getSql, newId } from '@/lib/db'
import { type PaginatedResult, toPaginatedResult } from '@/lib/pagination'
import type { ServiceInput } from '@/lib/services'

export type ServiceRow = ServiceInput & {
  id: string
  createdAt: Date
  updatedAt: Date
}

export type ProductTypeNested = {
  id: string
  name: string
  slug: string
  color: string
  hasHostingSpecs: boolean
  active: boolean
  sortOrder: number
  reminderDaysBeforeExpiry: number
  reminderTiming: 'BEFORE' | 'AFTER'
  autoInvoiceDaysBeforeExpiry: number
  createdAt: Date
  updatedAt: Date
}

export type ProductPackageNested = {
  id: string
  productTypeId: string
  name: string
  diskSpaceGb: number | null
  bandwidthGb: number | null
  emailAccounts: number | null
  databases: number | null
  addonDomains: number | null
  billingType: 'RECURRING' | 'ONE_TIME'
  priceMonthly: number
  priceQuarterly: number
  priceSemiAnnual: number
  priceYearly: number
  active: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
} | null

export type ClientNested = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  companyKhmer: string | null
  address: string | null
  vatTin: string | null
  telegramId: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type ServiceWithRelations = ServiceRow & {
  client: ClientNested
  productType: ProductTypeNested
  productPackage: ProductPackageNested
}

const SERVICE_JOIN = `
  FROM "Service" s
  JOIN "Client" c ON c.id = s."clientId"
  JOIN "ProductType" pt ON pt.id = s."productTypeId"
  LEFT JOIN "ProductPackage" pp ON pp.id = s."productPackageId"
`

const SERVICE_SELECT = `
  s.id, s."clientId", s."productTypeId", s."productPackageId", s.name,
  s."startDate", s."expiryDate", s."nextDueDate", s.price, s."setupFee",
  s.recurring, s.period, s.status, s.notes, s."createdAt", s."updatedAt",
  c.id AS c_id, c.name AS c_name, c.email AS c_email, c.phone AS c_phone,
  c.company AS c_company, c."companyKhmer" AS c_companyKhmer, c.address AS c_address, c."vatTin" AS c_vatTin,
  c."telegramId" AS c_telegramId, c.notes AS c_notes, c."createdAt" AS c_createdAt, c."updatedAt" AS c_updatedAt,
  pt.id AS pt_id, pt.name AS pt_name, pt.slug AS pt_slug, pt.color AS pt_color,
  pt."hasHostingSpecs" AS pt_hasHostingSpecs, pt.active AS pt_active, pt."sortOrder" AS pt_sortOrder,
  pt."reminderDaysBeforeExpiry" AS pt_reminderDaysBeforeExpiry,
  pt."reminderTiming" AS pt_reminderTiming,
  pt."autoInvoiceDaysBeforeExpiry" AS pt_autoInvoiceDaysBeforeExpiry,
  pt."createdAt" AS pt_createdAt, pt."updatedAt" AS pt_updatedAt,
  pp.id AS pp_id, pp."productTypeId" AS pp_productTypeId, pp.name AS pp_name,
  pp."diskSpaceGb" AS pp_diskSpaceGb,
  pp."bandwidthGb" AS pp_bandwidthGb, pp."emailAccounts" AS pp_emailAccounts,
  pp.databases AS pp_databases, pp."addonDomains" AS pp_addonDomains,
  pp."billingType" AS pp_billingType,
  pp."priceMonthly" AS pp_priceMonthly, pp."priceQuarterly" AS pp_priceQuarterly,
  pp."priceSemiAnnual" AS pp_priceSemiAnnual, pp."priceYearly" AS pp_priceYearly,
  pp.active AS pp_active, pp."sortOrder" AS pp_sortOrder,
  pp."createdAt" AS pp_createdAt, pp."updatedAt" AS pp_updatedAt
`

function mapClientNested(row: Record<string, unknown>): ClientNested {
  return {
    id: String(row.c_id),
    name: String(row.c_name),
    email: String(row.c_email),
    phone: row.c_phone != null ? String(row.c_phone) : null,
    company: row.c_company != null ? String(row.c_company) : null,
    companyKhmer: row.c_companyKhmer != null ? String(row.c_companyKhmer) : null,
    address: row.c_address != null ? String(row.c_address) : null,
    vatTin: row.c_vatTin != null ? String(row.c_vatTin) : null,
    telegramId: row.c_telegramId != null ? String(row.c_telegramId) : null,
    notes: row.c_notes != null ? String(row.c_notes) : null,
    createdAt: new Date(row.c_createdAt as string),
    updatedAt: new Date(row.c_updatedAt as string),
  }
}

function mapProductTypeNested(row: Record<string, unknown>): ProductTypeNested {
  return {
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
}

function mapProductPackageNested(row: Record<string, unknown>): ProductPackageNested {
  if (row.pp_id == null) return null
  return {
    id: String(row.pp_id),
    productTypeId: String(row.pp_productTypeId),
    name: String(row.pp_name),
    diskSpaceGb: row.pp_diskSpaceGb != null ? Number(row.pp_diskSpaceGb) : null,
    bandwidthGb: row.pp_bandwidthGb != null ? Number(row.pp_bandwidthGb) : null,
    emailAccounts: row.pp_emailAccounts != null ? Number(row.pp_emailAccounts) : null,
    databases: row.pp_databases != null ? Number(row.pp_databases) : null,
    addonDomains: row.pp_addonDomains != null ? Number(row.pp_addonDomains) : null,
    billingType: String(row.pp_billingType ?? 'RECURRING').toUpperCase() === 'ONE_TIME' ? 'ONE_TIME' : 'RECURRING',
    priceMonthly: Number(row.pp_priceMonthly ?? 0),
    priceQuarterly: Number(row.pp_priceQuarterly ?? 0),
    priceSemiAnnual: Number(row.pp_priceSemiAnnual ?? 0),
    priceYearly: Number(row.pp_priceYearly ?? 0),
    active: Boolean(row.pp_active),
    sortOrder: Number(row.pp_sortOrder ?? 0),
    createdAt: new Date(row.pp_createdAt as string),
    updatedAt: new Date(row.pp_updatedAt as string),
  }
}

export function mapServiceWithRelations(row: Record<string, unknown>): ServiceWithRelations {
  return {
    id: String(row.id),
    clientId: String(row.clientId),
    productTypeId: String(row.productTypeId),
    productPackageId: row.productPackageId != null ? String(row.productPackageId) : null,
    name: String(row.name),
    startDate: new Date(row.startDate as string),
    expiryDate: new Date(row.expiryDate as string),
    nextDueDate: row.nextDueDate != null ? new Date(row.nextDueDate as string) : null,
    price: Number(row.price),
    setupFee: Number(row.setupFee ?? 0),
    recurring: Boolean(row.recurring),
    period: row.period != null ? String(row.period) : null,
    status: String(row.status),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
    client: mapClientNested(row),
    productType: mapProductTypeNested(row),
    productPackage: mapProductPackageNested(row),
  }
}

export type ServiceFilters = {
  productTypeId?: string
  productTypeSlug?: string
  clientId?: string
  expiryDateGte?: Date
  expiryDateLte?: Date
  status?: string
  statuses?: string[]
}

export async function listServices(filters: ServiceFilters = {}): Promise<ServiceWithRelations[]> {
  const sql = getSql()
  const { productTypeId, productTypeSlug, clientId, expiryDateGte, expiryDateLte, status, statuses } = filters

  let rows
  if (expiryDateLte && statuses?.length) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."expiryDate" <= ${expiryDateLte}
        AND s.status = ANY(${statuses})
      ORDER BY s."expiryDate" ASC
    `
  } else if (expiryDateGte && expiryDateLte && statuses?.length) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."expiryDate" >= ${expiryDateGte}
        AND s."expiryDate" <= ${expiryDateLte}
        AND s.status = ANY(${statuses})
      ORDER BY s."expiryDate" ASC
    `
  } else if (productTypeId && clientId && expiryDateLte && status) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."productTypeId" = ${productTypeId} AND s."clientId" = ${clientId}
        AND s."expiryDate" <= ${expiryDateLte} AND s.status = ${status}
      ORDER BY s."expiryDate" ASC
    `
  } else if (productTypeId && expiryDateLte && status) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."productTypeId" = ${productTypeId} AND s."expiryDate" <= ${expiryDateLte} AND s.status = ${status}
      ORDER BY s."expiryDate" ASC
    `
  } else if (productTypeSlug && clientId && expiryDateLte && status) {
    const slug = productTypeSlug.toUpperCase()
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE pt.slug = ${slug} AND s."clientId" = ${clientId}
        AND s."expiryDate" <= ${expiryDateLte} AND s.status = ${status}
      ORDER BY s."expiryDate" ASC
    `
  } else if (productTypeSlug && expiryDateLte && status) {
    const slug = productTypeSlug.toUpperCase()
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE pt.slug = ${slug} AND s."expiryDate" <= ${expiryDateLte} AND s.status = ${status}
      ORDER BY s."expiryDate" ASC
    `
  } else if (clientId && expiryDateLte && status) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."clientId" = ${clientId} AND s."expiryDate" <= ${expiryDateLte} AND s.status = ${status}
      ORDER BY s."expiryDate" ASC
    `
  } else if (expiryDateGte && expiryDateLte && status) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."expiryDate" >= ${expiryDateGte} AND s."expiryDate" <= ${expiryDateLte} AND s.status = ${status}
      ORDER BY s."expiryDate" ASC
    `
  } else if (expiryDateLte && status) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."expiryDate" <= ${expiryDateLte} AND s.status = ${status}
      ORDER BY s."expiryDate" ASC
    `
  } else if (productTypeId && clientId) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."productTypeId" = ${productTypeId} AND s."clientId" = ${clientId}
      ORDER BY s."expiryDate" ASC
    `
  } else if (productTypeId) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."productTypeId" = ${productTypeId}
      ORDER BY s."expiryDate" ASC
    `
  } else if (productTypeSlug && clientId) {
    const slug = productTypeSlug.toUpperCase()
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE pt.slug = ${slug} AND s."clientId" = ${clientId}
      ORDER BY s."expiryDate" ASC
    `
  } else if (productTypeSlug) {
    const slug = productTypeSlug.toUpperCase()
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE pt.slug = ${slug}
      ORDER BY s."expiryDate" ASC
    `
  } else if (clientId) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."clientId" = ${clientId}
      ORDER BY s."expiryDate" ASC
    `
  } else {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      ORDER BY s."expiryDate" ASC
    `
  }

  return rows.map(r => mapServiceWithRelations(r as Record<string, unknown>))
}

export async function getServiceById(id: string): Promise<ServiceWithRelations | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
    WHERE s.id = ${id}
    LIMIT 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapServiceWithRelations(row) : null
}

export async function getServicesForInvoice(invoiceId: string): Promise<ServiceWithRelations[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT ${sql.unsafe(SERVICE_SELECT)}
    FROM "Order" o
    JOIN "OrderItem" oi ON oi."orderId" = o.id
    JOIN "Service" s ON s.id = oi."serviceId"
    JOIN "Client" c ON c.id = s."clientId"
    JOIN "ProductType" pt ON pt.id = s."productTypeId"
    LEFT JOIN "ProductPackage" pp ON pp.id = s."productPackageId"
    WHERE o."invoiceId" = ${invoiceId}
    ORDER BY oi."sortOrder" ASC, oi."createdAt" ASC
  `
  return rows.map(r => mapServiceWithRelations(r as Record<string, unknown>))
}

export async function getServiceNameById(id: string): Promise<string | null> {
  const sql = getSql()
  const rows = await sql`SELECT name FROM "Service" WHERE id = ${id} LIMIT 1`
  const row = rows[0] as { name: string } | undefined
  return row ? row.name : null
}

export async function createService(data: ServiceInput): Promise<ServiceWithRelations> {
  const sql = getSql()
  const id = newId()
  const now = new Date()
  await sql`
    INSERT INTO "Service" (
      id, "clientId", "productTypeId", "productPackageId", name,
      "startDate", "expiryDate", "nextDueDate", price, "setupFee",
      recurring, period, status, notes, "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${data.clientId}, ${data.productTypeId}, ${data.productPackageId}, ${data.name},
      ${data.startDate}, ${data.expiryDate}, ${data.nextDueDate}, ${data.price}, ${data.setupFee},
      ${data.recurring}, ${data.period}, ${data.status}, ${data.notes}, ${now}, ${now}
    )
  `
  const service = await getServiceById(id)
  if (!service) throw new Error('Failed to create service')
  return service
}

export async function updateService(id: string, data: ServiceInput): Promise<ServiceWithRelations> {
  const sql = getSql()
  const now = new Date()
  const rows = await sql`
    UPDATE "Service" SET
      "clientId" = ${data.clientId},
      "productTypeId" = ${data.productTypeId},
      "productPackageId" = ${data.productPackageId},
      name = ${data.name},
      "startDate" = ${data.startDate},
      "expiryDate" = ${data.expiryDate},
      "nextDueDate" = ${data.nextDueDate},
      price = ${data.price},
      "setupFee" = ${data.setupFee},
      recurring = ${data.recurring},
      period = ${data.period},
      status = ${data.status},
      notes = ${data.notes},
      "updatedAt" = ${now}
    WHERE id = ${id}
    RETURNING id
  `
  if (!rows[0]) throw new Error('Service not found')
  const service = await getServiceById(id)
  if (!service) throw new Error('Service not found')
  return service
}

export async function deleteService(id: string) {
  const sql = getSql()
  const existing = await getServiceById(id)
  if (!existing) throw new Error('Service not found')

  // Order items keep history; drop the link so the service row can be removed.
  await sql`UPDATE "OrderItem" SET "serviceId" = NULL WHERE "serviceId" = ${id}`

  const rows = await sql`DELETE FROM "Service" WHERE id = ${id} RETURNING id`
  if (!rows[0]) throw new Error('Service not found')
}

export async function countServicesByProductType(productTypeId: string): Promise<number> {
  const sql = getSql()
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM "Service" WHERE "productTypeId" = ${productTypeId}
  `
  return Number((rows[0] as { count: number }).count)
}

export type ServiceTableFilters = {
  productTypeId?: string
  search?: string
}

function serviceTableSearchPattern(search: string) {
  return `%${search.trim()}%`
}

async function countServicesForTable(filters: ServiceTableFilters): Promise<number> {
  const sql = getSql()
  const { productTypeId, search } = filters
  const pattern = search?.trim() ? serviceTableSearchPattern(search) : null

  if (productTypeId && pattern) {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      FROM "Service" s
      JOIN "Client" c ON c.id = s."clientId"
      JOIN "ProductType" pt ON pt.id = s."productTypeId"
      LEFT JOIN "ProductPackage" pp ON pp.id = s."productPackageId"
      WHERE s."productTypeId" = ${productTypeId}
        AND (
          c.name ILIKE ${pattern} OR s.name ILIKE ${pattern}
          OR pt.name ILIKE ${pattern} OR COALESCE(pp.name, '') ILIKE ${pattern}
          OR s.status::text ILIKE ${pattern}
        )
    `
    return Number((rows[0] as { count: number }).count)
  }

  if (productTypeId) {
    const rows = await sql`
      SELECT COUNT(*)::int AS count FROM "Service" WHERE "productTypeId" = ${productTypeId}
    `
    return Number((rows[0] as { count: number }).count)
  }

  if (pattern) {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      FROM "Service" s
      JOIN "Client" c ON c.id = s."clientId"
      JOIN "ProductType" pt ON pt.id = s."productTypeId"
      LEFT JOIN "ProductPackage" pp ON pp.id = s."productPackageId"
      WHERE c.name ILIKE ${pattern} OR s.name ILIKE ${pattern}
        OR pt.name ILIKE ${pattern} OR COALESCE(pp.name, '') ILIKE ${pattern}
        OR s.status::text ILIKE ${pattern}
    `
    return Number((rows[0] as { count: number }).count)
  }

  const rows = await sql`SELECT COUNT(*)::int AS count FROM "Service"`
  return Number((rows[0] as { count: number }).count)
}

export async function listServicesPaginated(
  filters: ServiceTableFilters,
  page = 1,
  pageSize = 25,
): Promise<PaginatedResult<ServiceWithRelations>> {
  const sql = getSql()
  const offset = (page - 1) * pageSize
  const { productTypeId, search } = filters
  const pattern = search?.trim() ? serviceTableSearchPattern(search) : null

  let rows
  if (productTypeId && pattern) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."productTypeId" = ${productTypeId}
        AND (
          c.name ILIKE ${pattern} OR s.name ILIKE ${pattern}
          OR pt.name ILIKE ${pattern} OR COALESCE(pp.name, '') ILIKE ${pattern}
          OR s.status::text ILIKE ${pattern}
        )
      ORDER BY s."expiryDate" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `
  } else if (productTypeId) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE s."productTypeId" = ${productTypeId}
      ORDER BY s."expiryDate" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `
  } else if (pattern) {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      WHERE c.name ILIKE ${pattern} OR s.name ILIKE ${pattern}
        OR pt.name ILIKE ${pattern} OR COALESCE(pp.name, '') ILIKE ${pattern}
        OR s.status::text ILIKE ${pattern}
      ORDER BY s."expiryDate" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `
  } else {
    rows = await sql`
      SELECT ${sql.unsafe(SERVICE_SELECT)} ${sql.unsafe(SERVICE_JOIN)}
      ORDER BY s."expiryDate" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `
  }

  const total = await countServicesForTable(filters)
  return toPaginatedResult(
    rows.map(r => mapServiceWithRelations(r as Record<string, unknown>)),
    total,
    page,
    pageSize,
  )
}
