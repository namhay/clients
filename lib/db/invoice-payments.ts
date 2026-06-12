import { getSql, newId } from '@/lib/db'
import type { PaymentMethod } from '@/lib/payment-methods'
import type { PaginatedResult } from '@/lib/pagination'
import { toPaginatedResult } from '@/lib/pagination'
import {
  getPeriodUtcBounds,
  summarizeRevenueByPeriod,
  type RevenuePeriod,
  type RevenuePeriodSummary,
} from '@/lib/revenue-periods'

export type InvoicePaymentRow = {
  id: string
  invoiceId: string
  amount: number
  paymentMethod: PaymentMethod
  paidAt: Date
  createdAt: Date
}

export type PaymentTransactionRow = {
  id: string
  invoiceId: string
  invoiceNo: string
  clientId: string
  amount: number
  paymentMethod: PaymentMethod | null
  paidAt: Date
  invoiceCreatedAt: Date
  isLegacy: boolean
  client: {
    name: string
    email: string | null
  }
}

function isMissingPaymentTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('InvoicePayment') && message.includes('does not exist')
}

function mapPayment(row: Record<string, unknown>): InvoicePaymentRow {
  return {
    id: String(row.id),
    invoiceId: String(row.invoiceId),
    amount: Number(row.amount),
    paymentMethod: String(row.paymentMethod) as PaymentMethod,
    paidAt: new Date(row.paidAt as string),
    createdAt: new Date(row.createdAt as string),
  }
}

function mapPaymentTransaction(row: Record<string, unknown>): PaymentTransactionRow {
  return {
    id: String(row.id),
    invoiceId: String(row.invoiceId),
    invoiceNo: String(row.invoiceNo),
    clientId: String(row.clientId),
    amount: Number(row.amount),
    paymentMethod: row.paymentMethod != null ? String(row.paymentMethod) as PaymentMethod : null,
    paidAt: new Date(row.paidAt as string),
    invoiceCreatedAt: new Date(row.invoiceCreatedAt as string),
    isLegacy: Boolean(row.isLegacy),
    client: {
      name: String(row.clientName),
      email: row.clientEmail != null ? String(row.clientEmail) : null,
    },
  }
}

const PAYMENT_TX_BASE = `
  SELECT
    p.id,
    p."invoiceId" AS "invoiceId",
    i."invoiceNo" AS "invoiceNo",
    i."clientId" AS "clientId",
    p.amount,
    p."paymentMethod" AS "paymentMethod",
    p."paidAt" AS "paidAt",
    i."createdAt" AS "invoiceCreatedAt",
    false AS "isLegacy",
    c.name AS "clientName",
    c.email AS "clientEmail"
  FROM "InvoicePayment" p
  INNER JOIN "Invoice" i ON i.id = p."invoiceId"
  INNER JOIN "Client" c ON c.id = i."clientId"
`

const LEGACY_TX_BASE = `
  SELECT
    i.id,
    i.id AS "invoiceId",
    i."invoiceNo" AS "invoiceNo",
    i."clientId" AS "clientId",
    i.total AS amount,
    NULL::text AS "paymentMethod",
    COALESCE(i."paidAt", i."updatedAt") AS "paidAt",
    i."createdAt" AS "invoiceCreatedAt",
    true AS "isLegacy",
    c.name AS "clientName",
    c.email AS "clientEmail"
  FROM "Invoice" i
  INNER JOIN "Client" c ON c.id = i."clientId"
  WHERE i.status = 'PAID'
    AND NOT EXISTS (
      SELECT 1 FROM "InvoicePayment" p WHERE p."invoiceId" = i.id
    )
`

export async function listPaymentsForInvoice(invoiceId: string): Promise<InvoicePaymentRow[]> {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT * FROM "InvoicePayment"
      WHERE "invoiceId" = ${invoiceId}
      ORDER BY "paidAt" ASC, "createdAt" ASC
    `
    return rows.map(r => mapPayment(r as Record<string, unknown>))
  } catch (error) {
    if (isMissingPaymentTable(error)) return []
    throw error
  }
}

export async function sumPaymentsForInvoice(invoiceId: string): Promise<number> {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT COALESCE(SUM(amount), 0)::float AS total
      FROM "InvoicePayment"
      WHERE "invoiceId" = ${invoiceId}
    `
    return Number((rows[0] as { total: number }).total)
  } catch (error) {
    if (isMissingPaymentTable(error)) return 0
    throw error
  }
}

export async function sumPaymentsForInvoices(
  invoiceIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (!invoiceIds.length) return result

  try {
    const sql = getSql()
    const rows = await sql`
      SELECT "invoiceId", COALESCE(SUM(amount), 0)::float AS total
      FROM "InvoicePayment"
      WHERE "invoiceId" = ANY(${invoiceIds})
      GROUP BY "invoiceId"
    `
    for (const row of rows) {
      const r = row as { invoiceId: string; total: number }
      result.set(r.invoiceId, Number(r.total))
    }
    return result
  } catch (error) {
    if (isMissingPaymentTable(error)) return result
    throw error
  }
}

export async function createInvoicePayment(input: {
  invoiceId: string
  amount: number
  paymentMethod: PaymentMethod
  paidAt: Date
}): Promise<InvoicePaymentRow> {
  const sql = getSql()
  const id = newId()
  const now = new Date()
  const rows = await sql`
    INSERT INTO "InvoicePayment" (
      id, "invoiceId", amount, "paymentMethod", "paidAt", "createdAt"
    ) VALUES (
      ${id}, ${input.invoiceId}, ${input.amount}, ${input.paymentMethod}, ${input.paidAt}, ${now}
    )
    RETURNING *
  `
  return mapPayment(rows[0] as Record<string, unknown>)
}

export async function deletePaymentsForInvoice(invoiceId: string) {
  try {
    const sql = getSql()
    await sql`DELETE FROM "InvoicePayment" WHERE "invoiceId" = ${invoiceId}`
  } catch (error) {
    if (isMissingPaymentTable(error)) return
    throw error
  }
}

export async function getInvoicePaymentById(id: string): Promise<InvoicePaymentRow | null> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM "InvoicePayment" WHERE id = ${id} LIMIT 1`
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapPayment(row) : null
}

export async function updateInvoicePayment(
  id: string,
  data: { paidAt?: Date; paymentMethod?: PaymentMethod },
): Promise<InvoicePaymentRow> {
  const sql = getSql()
  const existing = await getInvoicePaymentById(id)
  if (!existing) throw new Error('Payment not found')

  const rows = await sql`
    UPDATE "InvoicePayment" SET
      "paidAt" = ${data.paidAt ?? existing.paidAt},
      "paymentMethod" = ${data.paymentMethod ?? existing.paymentMethod}
    WHERE id = ${id}
    RETURNING *
  `
  return mapPayment(rows[0] as Record<string, unknown>)
}

async function listLegacyPaymentTransactions(clientId?: string): Promise<PaymentTransactionRow[]> {
  const sql = getSql()
  const rows = clientId
    ? await sql`
      SELECT i.id, i.id AS "invoiceId", i."invoiceNo", i."clientId", i.total AS amount,
        NULL::text AS "paymentMethod", COALESCE(i."paidAt", i."updatedAt") AS "paidAt",
        i."createdAt" AS "invoiceCreatedAt", true AS "isLegacy",
        c.name AS "clientName", c.email AS "clientEmail"
      FROM "Invoice" i
      INNER JOIN "Client" c ON c.id = i."clientId"
      WHERE i.status = 'PAID' AND i."clientId" = ${clientId}
      ORDER BY COALESCE(i."paidAt", i."updatedAt") DESC
    `
    : await sql`
      SELECT i.id, i.id AS "invoiceId", i."invoiceNo", i."clientId", i.total AS amount,
        NULL::text AS "paymentMethod", COALESCE(i."paidAt", i."updatedAt") AS "paidAt",
        i."createdAt" AS "invoiceCreatedAt", true AS "isLegacy",
        c.name AS "clientName", c.email AS "clientEmail"
      FROM "Invoice" i
      INNER JOIN "Client" c ON c.id = i."clientId"
      WHERE i.status = 'PAID'
      ORDER BY COALESCE(i."paidAt", i."updatedAt") DESC
    `
  return rows.map(r => mapPaymentTransaction(r as Record<string, unknown>))
}

async function listLegacyPaymentTransactionsPaginated(
  page = 1,
  pageSize = 25,
  period: RevenuePeriod = 'all',
  timezone = 'Asia/Phnom_Penh',
  clientId?: string,
): Promise<PaginatedResult<PaymentTransactionRow>> {
  const sql = getSql()
  const offset = (page - 1) * pageSize
  const { start, end } = getPeriodUtcBounds(period, timezone)

  let rows
  let countRows

  if (clientId && start && end) {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT i.id, i.id AS "invoiceId", i."invoiceNo", i."clientId", i.total AS amount,
          NULL::text AS "paymentMethod", COALESCE(i."paidAt", i."updatedAt") AS "paidAt",
          i."createdAt" AS "invoiceCreatedAt", true AS "isLegacy",
          c.name AS "clientName", c.email AS "clientEmail"
        FROM "Invoice" i
        INNER JOIN "Client" c ON c.id = i."clientId"
        WHERE i.status = 'PAID' AND i."clientId" = ${clientId}
          AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
          AND COALESCE(i."paidAt", i."updatedAt") < ${end}
        ORDER BY COALESCE(i."paidAt", i."updatedAt") DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count FROM "Invoice" i
        WHERE i.status = 'PAID' AND i."clientId" = ${clientId}
          AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
          AND COALESCE(i."paidAt", i."updatedAt") < ${end}
      `,
    ])
  } else if (clientId) {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT i.id, i.id AS "invoiceId", i."invoiceNo", i."clientId", i.total AS amount,
          NULL::text AS "paymentMethod", COALESCE(i."paidAt", i."updatedAt") AS "paidAt",
          i."createdAt" AS "invoiceCreatedAt", true AS "isLegacy",
          c.name AS "clientName", c.email AS "clientEmail"
        FROM "Invoice" i
        INNER JOIN "Client" c ON c.id = i."clientId"
        WHERE i.status = 'PAID' AND i."clientId" = ${clientId}
        ORDER BY COALESCE(i."paidAt", i."updatedAt") DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count FROM "Invoice" i
        WHERE i.status = 'PAID' AND i."clientId" = ${clientId}
      `,
    ])
  } else if (start && end) {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT i.id, i.id AS "invoiceId", i."invoiceNo", i."clientId", i.total AS amount,
          NULL::text AS "paymentMethod", COALESCE(i."paidAt", i."updatedAt") AS "paidAt",
          i."createdAt" AS "invoiceCreatedAt", true AS "isLegacy",
          c.name AS "clientName", c.email AS "clientEmail"
        FROM "Invoice" i
        INNER JOIN "Client" c ON c.id = i."clientId"
        WHERE i.status = 'PAID'
          AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
          AND COALESCE(i."paidAt", i."updatedAt") < ${end}
        ORDER BY COALESCE(i."paidAt", i."updatedAt") DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count FROM "Invoice" i
        WHERE i.status = 'PAID'
          AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
          AND COALESCE(i."paidAt", i."updatedAt") < ${end}
      `,
    ])
  } else {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT i.id, i.id AS "invoiceId", i."invoiceNo", i."clientId", i.total AS amount,
          NULL::text AS "paymentMethod", COALESCE(i."paidAt", i."updatedAt") AS "paidAt",
          i."createdAt" AS "invoiceCreatedAt", true AS "isLegacy",
          c.name AS "clientName", c.email AS "clientEmail"
        FROM "Invoice" i
        INNER JOIN "Client" c ON c.id = i."clientId"
        WHERE i.status = 'PAID'
        ORDER BY COALESCE(i."paidAt", i."updatedAt") DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count FROM "Invoice" i
        WHERE i.status = 'PAID'
      `,
    ])
  }

  const total = Number((countRows[0] as { count: number }).count)
  const items = rows.map(r => mapPaymentTransaction(r as Record<string, unknown>))
  return toPaginatedResult(items, total, page, pageSize)
}

export async function listPaymentTransactions(): Promise<PaymentTransactionRow[]> {
  try {
    const sql = getSql()
    const rows = await sql`
      ${sql.unsafe(PAYMENT_TX_BASE)}
      UNION ALL
      ${sql.unsafe(LEGACY_TX_BASE)}
      ORDER BY "paidAt" DESC
    `
    return rows.map(r => mapPaymentTransaction(r as Record<string, unknown>))
  } catch (error) {
    if (isMissingPaymentTable(error)) return listLegacyPaymentTransactions()
    throw error
  }
}

export async function listPaymentTransactionsForClient(
  clientId: string,
): Promise<PaymentTransactionRow[]> {
  try {
    const sql = getSql()
    const rows = await sql`
      ${sql.unsafe(PAYMENT_TX_BASE)}
      WHERE i."clientId" = ${clientId}
      UNION ALL
      ${sql.unsafe(LEGACY_TX_BASE)}
        AND i."clientId" = ${clientId}
      ORDER BY "paidAt" DESC
    `
    return rows.map(r => mapPaymentTransaction(r as Record<string, unknown>))
  } catch (error) {
    if (isMissingPaymentTable(error)) return listLegacyPaymentTransactions(clientId)
    throw error
  }
}

export async function listPaymentTransactionsPaginated(
  page = 1,
  pageSize = 25,
  period: RevenuePeriod = 'all',
  timezone = 'Asia/Phnom_Penh',
  clientId?: string,
): Promise<PaginatedResult<PaymentTransactionRow>> {
  try {
    return await listPaymentTransactionsPaginatedWithTable(page, pageSize, period, timezone, clientId)
  } catch (error) {
    if (isMissingPaymentTable(error)) {
      return listLegacyPaymentTransactionsPaginated(page, pageSize, period, timezone, clientId)
    }
    throw error
  }
}

async function listPaymentTransactionsPaginatedWithTable(
  page = 1,
  pageSize = 25,
  period: RevenuePeriod = 'all',
  timezone = 'Asia/Phnom_Penh',
  clientId?: string,
): Promise<PaginatedResult<PaymentTransactionRow>> {
  const sql = getSql()
  const offset = (page - 1) * pageSize
  const { start, end } = getPeriodUtcBounds(period, timezone)
  let rows
  let countRows

  if (clientId && start && end) {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT * FROM (
          SELECT p.id, p."invoiceId", i."invoiceNo", i."clientId", p.amount, p."paymentMethod",
            p."paidAt", i."createdAt" AS "invoiceCreatedAt", false AS "isLegacy",
            c.name AS "clientName", c.email AS "clientEmail"
          FROM "InvoicePayment" p
          INNER JOIN "Invoice" i ON i.id = p."invoiceId"
          INNER JOIN "Client" c ON c.id = i."clientId"
          WHERE i."clientId" = ${clientId}
            AND p."paidAt" >= ${start} AND p."paidAt" < ${end}
          UNION ALL
          SELECT i.id, i.id, i."invoiceNo", i."clientId", i.total, NULL::text,
            COALESCE(i."paidAt", i."updatedAt"), i."createdAt", true,
            c.name, c.email
          FROM "Invoice" i
          INNER JOIN "Client" c ON c.id = i."clientId"
          WHERE i.status = 'PAID' AND i."clientId" = ${clientId}
            AND NOT EXISTS (SELECT 1 FROM "InvoicePayment" p WHERE p."invoiceId" = i.id)
            AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
            AND COALESCE(i."paidAt", i."updatedAt") < ${end}
        ) tx
        ORDER BY "paidAt" DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT p.id FROM "InvoicePayment" p
          INNER JOIN "Invoice" i ON i.id = p."invoiceId"
          WHERE i."clientId" = ${clientId}
            AND p."paidAt" >= ${start} AND p."paidAt" < ${end}
          UNION ALL
          SELECT i.id FROM "Invoice" i
          WHERE i.status = 'PAID' AND i."clientId" = ${clientId}
            AND NOT EXISTS (SELECT 1 FROM "InvoicePayment" p WHERE p."invoiceId" = i.id)
            AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
            AND COALESCE(i."paidAt", i."updatedAt") < ${end}
        ) tx
      `,
    ])
  } else if (clientId) {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT * FROM (
          SELECT p.id, p."invoiceId", i."invoiceNo", i."clientId", p.amount, p."paymentMethod",
            p."paidAt", i."createdAt" AS "invoiceCreatedAt", false AS "isLegacy",
            c.name AS "clientName", c.email AS "clientEmail"
          FROM "InvoicePayment" p
          INNER JOIN "Invoice" i ON i.id = p."invoiceId"
          INNER JOIN "Client" c ON c.id = i."clientId"
          WHERE i."clientId" = ${clientId}
          UNION ALL
          SELECT i.id, i.id, i."invoiceNo", i."clientId", i.total, NULL::text,
            COALESCE(i."paidAt", i."updatedAt"), i."createdAt", true,
            c.name, c.email
          FROM "Invoice" i
          INNER JOIN "Client" c ON c.id = i."clientId"
          WHERE i.status = 'PAID' AND i."clientId" = ${clientId}
            AND NOT EXISTS (SELECT 1 FROM "InvoicePayment" p WHERE p."invoiceId" = i.id)
        ) tx
        ORDER BY "paidAt" DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT p.id FROM "InvoicePayment" p
          INNER JOIN "Invoice" i ON i.id = p."invoiceId"
          WHERE i."clientId" = ${clientId}
          UNION ALL
          SELECT i.id FROM "Invoice" i
          WHERE i.status = 'PAID' AND i."clientId" = ${clientId}
            AND NOT EXISTS (SELECT 1 FROM "InvoicePayment" p WHERE p."invoiceId" = i.id)
        ) tx
      `,
    ])
  } else if (start && end) {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT * FROM (
          SELECT p.id, p."invoiceId", i."invoiceNo", i."clientId", p.amount, p."paymentMethod",
            p."paidAt", i."createdAt" AS "invoiceCreatedAt", false AS "isLegacy",
            c.name AS "clientName", c.email AS "clientEmail"
          FROM "InvoicePayment" p
          INNER JOIN "Invoice" i ON i.id = p."invoiceId"
          INNER JOIN "Client" c ON c.id = i."clientId"
          WHERE p."paidAt" >= ${start} AND p."paidAt" < ${end}
          UNION ALL
          SELECT i.id, i.id, i."invoiceNo", i."clientId", i.total, NULL::text,
            COALESCE(i."paidAt", i."updatedAt"), i."createdAt", true,
            c.name, c.email
          FROM "Invoice" i
          INNER JOIN "Client" c ON c.id = i."clientId"
          WHERE i.status = 'PAID'
            AND NOT EXISTS (SELECT 1 FROM "InvoicePayment" p WHERE p."invoiceId" = i.id)
            AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
            AND COALESCE(i."paidAt", i."updatedAt") < ${end}
        ) tx
        ORDER BY "paidAt" DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT p.id FROM "InvoicePayment" p
          WHERE p."paidAt" >= ${start} AND p."paidAt" < ${end}
          UNION ALL
          SELECT i.id FROM "Invoice" i
          WHERE i.status = 'PAID'
            AND NOT EXISTS (SELECT 1 FROM "InvoicePayment" p WHERE p."invoiceId" = i.id)
            AND COALESCE(i."paidAt", i."updatedAt") >= ${start}
            AND COALESCE(i."paidAt", i."updatedAt") < ${end}
        ) tx
      `,
    ])
  } else {
    ;[rows, countRows] = await Promise.all([
      sql`
        SELECT * FROM (
          SELECT p.id, p."invoiceId", i."invoiceNo", i."clientId", p.amount, p."paymentMethod",
            p."paidAt", i."createdAt" AS "invoiceCreatedAt", false AS "isLegacy",
            c.name AS "clientName", c.email AS "clientEmail"
          FROM "InvoicePayment" p
          INNER JOIN "Invoice" i ON i.id = p."invoiceId"
          INNER JOIN "Client" c ON c.id = i."clientId"
          UNION ALL
          SELECT i.id, i.id, i."invoiceNo", i."clientId", i.total, NULL::text,
            COALESCE(i."paidAt", i."updatedAt"), i."createdAt", true,
            c.name, c.email
          FROM "Invoice" i
          INNER JOIN "Client" c ON c.id = i."clientId"
          WHERE i.status = 'PAID'
            AND NOT EXISTS (SELECT 1 FROM "InvoicePayment" p WHERE p."invoiceId" = i.id)
        ) tx
        ORDER BY "paidAt" DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT p.id FROM "InvoicePayment" p
          UNION ALL
          SELECT i.id FROM "Invoice" i
          WHERE i.status = 'PAID'
            AND NOT EXISTS (SELECT 1 FROM "InvoicePayment" p WHERE p."invoiceId" = i.id)
        ) tx
      `,
    ])
  }

  const total = Number((countRows[0] as { count: number }).count)
  const items = rows.map(r => mapPaymentTransaction(r as Record<string, unknown>))
  return toPaginatedResult(items, total, page, pageSize)
}

export async function getPaymentTransactionSummary(timezone: string): Promise<{
  summary: RevenuePeriodSummary
  allTime: { revenue: number; count: number }
}> {
  const transactions = await listPaymentTransactions()
  const mapped = transactions.map(tx => ({
    total: tx.amount,
    paidAt: tx.paidAt,
    updatedAt: tx.paidAt,
    createdAt: tx.invoiceCreatedAt,
  }))
  const summary = summarizeRevenueByPeriod(mapped, timezone)
  const allTime = mapped.reduce(
    (acc, tx) => {
      acc.revenue += Number(tx.total) || 0
      acc.count++
      return acc
    },
    { revenue: 0, count: 0 },
  )
  return { summary, allTime }
}
