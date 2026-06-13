import { getSql, newId } from '@/lib/db'
import type { InvoiceInput, InvoiceItemInput } from '@/lib/invoices'
import type { ClientRow } from '@/lib/db/clients'
import { type PaginatedResult, toPaginatedResult } from '@/lib/pagination'
import {
  getPeriodUtcBounds,
  summarizeRevenueByPeriod,
  type RevenuePeriod,
  type RevenuePeriodSummary,
} from '@/lib/revenue-periods'

export type InvoiceItemRow = {
  id: string
  invoiceId: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  periodStart: Date | null
  periodEnd: Date | null
}

export type InvoiceRow = {
  id: string
  clientId: string
  invoiceNo: string
  subtotal: number
  tax: number
  total: number
  status: string
  dueDate: Date
  paidAt: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type ClientNested = Pick<ClientRow, 'id' | 'name' | 'email' | 'phone' | 'company' | 'companyKhmer' | 'address' | 'vatTin' | 'telegramId' | 'notes' | 'createdAt' | 'updatedAt'>

export type InvoiceWithRelations = InvoiceRow & {
  client: ClientNested
  items: InvoiceItemRow[]
}

function mapClientNested(row: Record<string, unknown>): ClientNested {
  return {
    id: String(row.c_id ?? row.id),
    name: String(row.c_name ?? row.name),
    email: String(row.c_email ?? row.email),
    phone: row.c_phone != null ? String(row.c_phone) : (row.phone != null ? String(row.phone) : null),
    company: row.c_company != null ? String(row.c_company) : (row.company != null ? String(row.company) : null),
    companyKhmer: row.c_companyKhmer != null ? String(row.c_companyKhmer) : (row.companyKhmer != null ? String(row.companyKhmer) : null),
    address: row.c_address != null ? String(row.c_address) : (row.address != null ? String(row.address) : null),
    vatTin: row.c_vatTin != null ? String(row.c_vatTin) : (row.vatTin != null ? String(row.vatTin) : null),
    telegramId: row.c_telegramId != null ? String(row.c_telegramId) : (row.telegramId != null ? String(row.telegramId) : null),
    notes: row.c_notes != null ? String(row.c_notes) : (row.notes != null ? String(row.notes) : null),
    createdAt: new Date((row.c_createdAt ?? row.createdAt) as string),
    updatedAt: new Date((row.c_updatedAt ?? row.updatedAt) as string),
  }
}

export function mapInvoiceRow(row: Record<string, unknown>): InvoiceRow {
  return {
    id: String(row.id),
    clientId: String(row.clientId),
    invoiceNo: String(row.invoiceNo),
    subtotal: Number(row.subtotal),
    tax: Number(row.tax ?? 0),
    total: Number(row.total),
    status: String(row.status),
    dueDate: new Date(row.dueDate as string),
    paidAt: row.paidAt != null ? new Date(row.paidAt as string) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  }
}

export function mapInvoiceItem(row: Record<string, unknown>): InvoiceItemRow {
  return {
    id: String(row.id),
    invoiceId: String(row.invoiceId),
    description: String(row.description),
    quantity: Number(row.quantity ?? 1),
    unitPrice: Number(row.unitPrice),
    total: Number(row.total),
    periodStart: row.periodStart != null ? new Date(row.periodStart as string) : null,
    periodEnd: row.periodEnd != null ? new Date(row.periodEnd as string) : null,
  }
}

async function attachItems(invoices: InvoiceRow[]): Promise<InvoiceWithRelations[]> {
  if (!invoices.length) return []
  const sql = getSql()
  const ids = invoices.map(i => i.id)
  const itemRows = await sql`
    SELECT * FROM "InvoiceItem"
    WHERE "invoiceId" = ANY(${ids})
    ORDER BY id ASC
  `
  const itemsByInvoice = new Map<string, InvoiceItemRow[]>()
  for (const row of itemRows) {
    const item = mapInvoiceItem(row as Record<string, unknown>)
    const list = itemsByInvoice.get(item.invoiceId) || []
    list.push(item)
    itemsByInvoice.set(item.invoiceId, list)
  }

  const clientIds = Array.from(new Set(invoices.map(i => i.clientId)))
  const clientRows = await sql`SELECT * FROM "Client" WHERE id = ANY(${clientIds})`
  const clientsById = new Map<string, ClientNested>()
  for (const row of clientRows) {
    const client = mapClientNested(row as Record<string, unknown>)
    clientsById.set(client.id, client)
  }

  return invoices.map(invoice => ({
    ...invoice,
    client: clientsById.get(invoice.clientId)!,
    items: itemsByInvoice.get(invoice.id) || [],
  }))
}

const INVOICE_CLIENT_SELECT = `
  i.*,
  c.id AS c_id, c.name AS c_name, c.email AS c_email, c.phone AS c_phone,
  c.company AS c_company, c."companyKhmer" AS c_companyKhmer, c.address AS c_address, c."vatTin" AS c_vatTin,
  c."telegramId" AS c_telegramId, c.notes AS c_notes,
  c."createdAt" AS c_createdAt, c."updatedAt" AS c_updatedAt
`

function mapInvoiceWithClientRow(row: Record<string, unknown>): InvoiceWithRelations {
  return {
    ...mapInvoiceRow(row),
    client: mapClientNested(row),
    items: [],
  }
}

export type InvoiceListMode = 'recent' | 'open' | 'paid'

/** Lightweight invoice rows with client — no line items (dashboard/reports). */
export async function listInvoiceSummaries(
  mode: InvoiceListMode,
  limit: number,
): Promise<InvoiceWithRelations[]> {
  const sql = getSql()
  let rows
  if (mode === 'open') {
    rows = await sql`
      SELECT ${sql.unsafe(INVOICE_CLIENT_SELECT)}
      FROM "Invoice" i
      INNER JOIN "Client" c ON c.id = i."clientId"
      WHERE i.status IN ('UNPAID', 'OVERDUE')
      ORDER BY i."dueDate" ASC
      LIMIT ${limit}
    `
  } else if (mode === 'paid') {
    rows = await sql`
      SELECT ${sql.unsafe(INVOICE_CLIENT_SELECT)}
      FROM "Invoice" i
      INNER JOIN "Client" c ON c.id = i."clientId"
      WHERE i.status = 'PAID'
      ORDER BY COALESCE(i."paidAt", i."updatedAt") DESC
      LIMIT ${limit}
    `
  } else {
    rows = await sql`
      SELECT ${sql.unsafe(INVOICE_CLIENT_SELECT)}
      FROM "Invoice" i
      INNER JOIN "Client" c ON c.id = i."clientId"
      ORDER BY i."createdAt" DESC
      LIMIT ${limit}
    `
  }
  return rows.map(r => mapInvoiceWithClientRow(r as Record<string, unknown>))
}

export type InvoiceFilters = {
  status?: string
  clientId?: string
  limit?: number
}

export async function listInvoices(filters: InvoiceFilters = {}): Promise<InvoiceWithRelations[]> {
  const sql = getSql()
  const { status, clientId, limit } = filters

  let rows
  if (status && clientId) {
    rows = await sql`
      SELECT * FROM "Invoice"
      WHERE status = ${status} AND "clientId" = ${clientId}
      ORDER BY "createdAt" DESC
    `
  } else if (status) {
    rows = await sql`
      SELECT * FROM "Invoice"
      WHERE status = ${status}
      ORDER BY "createdAt" DESC
    `
  } else if (clientId) {
    rows = await sql`
      SELECT * FROM "Invoice"
      WHERE "clientId" = ${clientId}
      ORDER BY "createdAt" DESC
    `
  } else if (limit) {
    rows = await sql`
      SELECT * FROM "Invoice"
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `
  } else {
    rows = await sql`SELECT * FROM "Invoice" ORDER BY "createdAt" DESC`
  }

  const invoices = rows.map(r => mapInvoiceRow(r as Record<string, unknown>))
  return attachItems(invoices)
}

export async function listInvoiceRowsByClient(clientId: string): Promise<InvoiceRow[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM "Invoice"
    WHERE "clientId" = ${clientId}
    ORDER BY "createdAt" DESC
  `
  return rows.map(r => mapInvoiceRow(r as Record<string, unknown>))
}

export type InvoiceTableFilters = {
  status?: string
  search?: string
}

const INVOICE_LIST_FROM = `
  FROM "Invoice" i
  INNER JOIN "Client" c ON c.id = i."clientId"
`

function invoiceSearchPattern(search: string) {
  return `%${search.trim()}%`
}

async function countInvoicesForTable(filters: InvoiceTableFilters): Promise<number> {
  const sql = getSql()
  const { status, search } = filters
  const pattern = search?.trim() ? invoiceSearchPattern(search) : null

  if (status && pattern) {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      ${sql.unsafe(INVOICE_LIST_FROM)}
      WHERE i.status = ${status}
        AND (
          i."invoiceNo" ILIKE ${pattern}
          OR c.name ILIKE ${pattern}
          OR c.email ILIKE ${pattern}
          OR i.status::text ILIKE ${pattern}
          OR EXISTS (
            SELECT 1 FROM "InvoiceItem" ii
            WHERE ii."invoiceId" = i.id AND ii.description ILIKE ${pattern}
          )
        )
    `
    return Number((rows[0] as { count: number }).count)
  }

  if (status) {
    const rows = await sql`
      SELECT COUNT(*)::int AS count FROM "Invoice" WHERE status = ${status}
    `
    return Number((rows[0] as { count: number }).count)
  }

  if (pattern) {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      ${sql.unsafe(INVOICE_LIST_FROM)}
      WHERE i."invoiceNo" ILIKE ${pattern}
        OR c.name ILIKE ${pattern}
        OR c.email ILIKE ${pattern}
        OR i.status::text ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM "InvoiceItem" ii
          WHERE ii."invoiceId" = i.id AND ii.description ILIKE ${pattern}
        )
    `
    return Number((rows[0] as { count: number }).count)
  }

  const rows = await sql`SELECT COUNT(*)::int AS count FROM "Invoice"`
  return Number((rows[0] as { count: number }).count)
}

export async function listInvoicesPaginated(
  filters: InvoiceTableFilters = {},
  page = 1,
  pageSize = 25,
): Promise<PaginatedResult<InvoiceWithRelations>> {
  const sql = getSql()
  const offset = (page - 1) * pageSize
  const { status, search } = filters
  const pattern = search?.trim() ? invoiceSearchPattern(search) : null

  let rows
  if (status && pattern) {
    rows = await sql`
      SELECT ${sql.unsafe(INVOICE_CLIENT_SELECT)}
      ${sql.unsafe(INVOICE_LIST_FROM)}
      WHERE i.status = ${status}
        AND (
          i."invoiceNo" ILIKE ${pattern}
          OR c.name ILIKE ${pattern}
          OR c.email ILIKE ${pattern}
          OR i.status::text ILIKE ${pattern}
          OR EXISTS (
            SELECT 1 FROM "InvoiceItem" ii
            WHERE ii."invoiceId" = i.id AND ii.description ILIKE ${pattern}
          )
        )
      ORDER BY i."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
  } else if (status) {
    rows = await sql`
      SELECT ${sql.unsafe(INVOICE_CLIENT_SELECT)}
      ${sql.unsafe(INVOICE_LIST_FROM)}
      WHERE i.status = ${status}
      ORDER BY i."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
  } else if (pattern) {
    rows = await sql`
      SELECT ${sql.unsafe(INVOICE_CLIENT_SELECT)}
      ${sql.unsafe(INVOICE_LIST_FROM)}
      WHERE i."invoiceNo" ILIKE ${pattern}
        OR c.name ILIKE ${pattern}
        OR c.email ILIKE ${pattern}
        OR i.status::text ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM "InvoiceItem" ii
          WHERE ii."invoiceId" = i.id AND ii.description ILIKE ${pattern}
        )
      ORDER BY i."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
  } else {
    rows = await sql`
      SELECT ${sql.unsafe(INVOICE_CLIENT_SELECT)}
      ${sql.unsafe(INVOICE_LIST_FROM)}
      ORDER BY i."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
  }

  const invoiceRows = rows.map(r => mapInvoiceRow(r as Record<string, unknown>))
  const withItems = await attachItems(invoiceRows)
  const total = await countInvoicesForTable(filters)
  return toPaginatedResult(withItems, total, page, pageSize)
}

export async function getInvoiceById(id: string): Promise<InvoiceWithRelations | null> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM "Invoice" WHERE id = ${id} LIMIT 1`
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return null
  const [invoice] = await attachItems([mapInvoiceRow(row)])
  return invoice
}

export async function getInvoiceForPdf(id: string): Promise<InvoiceWithRelations | null> {
  return getInvoiceById(id)
}

export async function countInvoices(): Promise<number> {
  const sql = getSql()
  const rows = await sql`SELECT COUNT(*)::int AS count FROM "Invoice"`
  return Number((rows[0] as { count: number }).count)
}

export async function listInvoiceNumbers(): Promise<string[]> {
  const sql = getSql()
  const rows = await sql`SELECT "invoiceNo" FROM "Invoice"`
  return rows.map(r => String((r as { invoiceNo: string }).invoiceNo))
}

export async function listUnpaidInvoicesByClient(clientId: string): Promise<InvoiceWithRelations[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM "Invoice"
    WHERE "clientId" = ${clientId} AND status IN ('UNPAID', 'OVERDUE')
    ORDER BY "createdAt" ASC
  `
  const invoices = rows.map(r => mapInvoiceRow(r as Record<string, unknown>))
  return attachItems(invoices)
}

export async function countUnpaidInvoices(): Promise<number> {
  const sql = getSql()
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM "Invoice" WHERE status IN ('UNPAID', 'OVERDUE')
  `
  return Number((rows[0] as { count: number }).count)
}

/** True when client already has an open renewal invoice for this service (matched by period start = current expiry). */
export async function hasOpenRenewalInvoice(
  clientId: string,
  itemDescription: string,
  renewalPeriodStart: Date,
): Promise<boolean> {
  const sql = getSql()
  const day = renewalPeriodStart.toISOString().slice(0, 10)
  const rows = await sql`
    SELECT 1
    FROM "InvoiceItem" ii
    INNER JOIN "Invoice" i ON i.id = ii."invoiceId"
    WHERE i."clientId" = ${clientId}
      AND i.status IN ('UNPAID', 'OVERDUE')
      AND ii.description = ${itemDescription}
      AND ii."periodStart"::date = ${day}::date
    LIMIT 1
  `
  return rows.length > 0
}

export async function getPaidInvoices(): Promise<InvoiceRow[]> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM "Invoice" WHERE status = 'PAID'`
  return rows.map(r => mapInvoiceRow(r as Record<string, unknown>))
}

export async function listTransactions(): Promise<InvoiceWithRelations[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM "Invoice"
    WHERE status = 'PAID'
    ORDER BY COALESCE("paidAt", "updatedAt") DESC
  `
  const invoices = rows.map(r => mapInvoiceRow(r as Record<string, unknown>))
  return attachItems(invoices)
}

export async function getTransactionSummary(timezone: string): Promise<{
  summary: RevenuePeriodSummary
  allTime: { revenue: number; count: number }
}> {
  const sql = getSql()
  const rows = await sql`
    SELECT total, "paidAt", "updatedAt", "createdAt"
    FROM "Invoice"
    WHERE status = 'PAID'
  `
  const transactions = rows.map(r => {
    const row = r as Record<string, unknown>
    return {
      total: Number(row.total),
      paidAt: row.paidAt != null ? new Date(row.paidAt as string) : null,
      updatedAt: new Date(row.updatedAt as string),
      createdAt: new Date(row.createdAt as string),
    }
  })
  const summary = summarizeRevenueByPeriod(transactions, timezone)
  const allTime = transactions.reduce(
    (acc, tx) => {
      acc.revenue += Number(tx.total) || 0
      acc.count++
      return acc
    },
    { revenue: 0, count: 0 },
  )
  return { summary, allTime }
}

export async function listTransactionsPaginated(
  page = 1,
  pageSize = 25,
  period: RevenuePeriod = 'all',
  timezone = 'Asia/Phnom_Penh',
): Promise<PaginatedResult<InvoiceWithRelations>> {
  const sql = getSql()
  const offset = (page - 1) * pageSize
  const { start, end } = getPeriodUtcBounds(period, timezone)

  let rows
  let countRows
  if (start && end) {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT ${sql.unsafe(INVOICE_CLIENT_SELECT)}
        FROM "Invoice" i
        INNER JOIN "Client" c ON c.id = i."clientId"
        WHERE i.status = 'PAID'
          AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
          AND COALESCE(i."paidAt", i."updatedAt") < ${end}
        ORDER BY COALESCE(i."paidAt", i."updatedAt") DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM "Invoice" i
        WHERE i.status = 'PAID'
          AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
          AND COALESCE(i."paidAt", i."updatedAt") < ${end}
      `,
    ])
  } else {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT ${sql.unsafe(INVOICE_CLIENT_SELECT)}
        FROM "Invoice" i
        INNER JOIN "Client" c ON c.id = i."clientId"
        WHERE i.status = 'PAID'
        ORDER BY COALESCE(i."paidAt", i."updatedAt") DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count
        FROM "Invoice" i
        WHERE i.status = 'PAID'
      `,
    ])
  }

  const total = Number((countRows[0] as { count: number }).count)
  const items = rows.map(r => mapInvoiceWithClientRow(r as Record<string, unknown>))
  return toPaginatedResult(items, total, page, pageSize)
}

export async function findInvoiceByInvoiceNo(invoiceNo: string, excludeId?: string): Promise<InvoiceRow | null> {
  const sql = getSql()
  const rows = excludeId
    ? await sql`
        SELECT * FROM "Invoice" WHERE "invoiceNo" = ${invoiceNo} AND id != ${excludeId} LIMIT 1
      `
    : await sql`SELECT * FROM "Invoice" WHERE "invoiceNo" = ${invoiceNo} LIMIT 1`
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapInvoiceRow(row) : null
}

export async function createInvoice(
  data: Omit<InvoiceInput, 'items'> & { items: InvoiceItemInput[] },
): Promise<InvoiceWithRelations> {
  const sql = getSql()
  const id = newId()
  const now = new Date()
  const createdAt = data.invoiceDate ?? now
  await sql`
    INSERT INTO "Invoice" (
      id, "clientId", "invoiceNo", subtotal, tax, total, status, "dueDate", "paidAt", notes, "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${data.clientId}, ${data.invoiceNo}, ${data.subtotal}, ${data.tax}, ${data.total},
      ${data.status}, ${data.dueDate}, ${null}, ${data.notes || null}, ${createdAt}, ${now}
    )
  `
  for (const item of data.items) {
    await sql`
      INSERT INTO "InvoiceItem" (
        id, "invoiceId", description, quantity, "unitPrice", total, "periodStart", "periodEnd"
      ) VALUES (
        ${newId()}, ${id}, ${item.description}, ${item.quantity}, ${item.unitPrice}, ${item.total},
        ${item.periodStart ?? null}, ${item.periodEnd ?? null}
      )
    `
  }
  const invoice = await getInvoiceById(id)
  if (!invoice) throw new Error('Failed to create invoice')
  return invoice
}

export async function updateInvoiceRecord(
  id: string,
  data: InvoiceInput,
  paidAt: Date | null,
): Promise<InvoiceWithRelations> {
  const sql = getSql()
  const now = new Date()
  if (data.invoiceDate) {
    await sql`
      UPDATE "Invoice" SET
        "invoiceNo" = ${data.invoiceNo},
        "clientId" = ${data.clientId},
        "dueDate" = ${data.dueDate},
        notes = ${data.notes || null},
        tax = ${data.tax},
        status = ${data.status},
        subtotal = ${data.subtotal},
        total = ${data.total},
        "paidAt" = ${paidAt},
        "createdAt" = ${data.invoiceDate},
        "updatedAt" = ${now}
      WHERE id = ${id}
    `
  } else {
    await sql`
      UPDATE "Invoice" SET
        "invoiceNo" = ${data.invoiceNo},
        "clientId" = ${data.clientId},
        "dueDate" = ${data.dueDate},
        notes = ${data.notes || null},
        tax = ${data.tax},
        status = ${data.status},
        subtotal = ${data.subtotal},
        total = ${data.total},
        "paidAt" = ${paidAt},
        "updatedAt" = ${now}
      WHERE id = ${id}
    `
  }
  await sql`DELETE FROM "InvoiceItem" WHERE "invoiceId" = ${id}`
  for (const item of data.items) {
    await sql`
      INSERT INTO "InvoiceItem" (
        id, "invoiceId", description, quantity, "unitPrice", total, "periodStart", "periodEnd"
      ) VALUES (
        ${newId()}, ${id}, ${item.description}, ${item.quantity}, ${item.unitPrice}, ${item.total},
        ${item.periodStart ?? null}, ${item.periodEnd ?? null}
      )
    `
  }
  const invoice = await getInvoiceById(id)
  if (!invoice) throw new Error('Invoice not found')
  return invoice
}

export async function patchInvoice(
  id: string,
  data: Partial<InvoiceRow>,
): Promise<InvoiceWithRelations> {
  const sql = getSql()
  const existing = await getInvoiceById(id)
  if (!existing) throw new Error('Invoice not found')
  const now = new Date()
  await sql`
    UPDATE "Invoice" SET
      "invoiceNo" = ${data.invoiceNo ?? existing.invoiceNo},
      "clientId" = ${data.clientId ?? existing.clientId},
      subtotal = ${data.subtotal ?? existing.subtotal},
      tax = ${data.tax ?? existing.tax},
      total = ${data.total ?? existing.total},
      status = ${data.status ?? existing.status},
      "dueDate" = ${data.dueDate ?? existing.dueDate},
      "paidAt" = ${data.paidAt !== undefined ? data.paidAt : existing.paidAt},
      notes = ${data.notes !== undefined ? data.notes : existing.notes},
      "updatedAt" = ${now}
    WHERE id = ${id}
  `
  const invoice = await getInvoiceById(id)
  if (!invoice) throw new Error('Invoice not found')
  return invoice
}

export async function deleteInvoice(id: string) {
  const sql = getSql()
  await sql`UPDATE "Order" SET "invoiceId" = NULL WHERE "invoiceId" = ${id}`
  await sql`DELETE FROM "InvoiceItem" WHERE "invoiceId" = ${id}`
  await sql`DELETE FROM "Invoice" WHERE id = ${id}`
}
