import { getSql, newId } from '@/lib/db'

export type ReminderLogRow = {
  id: string
  clientId: string
  type: string
  channel: string
  message: string | null
  status: string
  createdAt: Date
}

export type ReminderLogInput = {
  clientId: string
  type: string
  channel: string
  message?: string | null
  status?: string
}

function mapReminderLog(row: Record<string, unknown>): ReminderLogRow {
  return {
    id: String(row.id),
    clientId: String(row.clientId),
    type: String(row.type),
    channel: String(row.channel),
    message: row.message != null ? String(row.message) : null,
    status: String(row.status ?? 'sent'),
    createdAt: new Date(row.createdAt as string),
  }
}

export async function createReminderLog(data: ReminderLogInput): Promise<ReminderLogRow> {
  const sql = getSql()
  const id = newId()
  const now = new Date()
  const rows = await sql`
    INSERT INTO "ReminderLog" (id, "clientId", type, channel, message, status, "createdAt")
    VALUES (
      ${id}, ${data.clientId}, ${data.type}, ${data.channel},
      ${data.message ?? null}, ${data.status ?? 'sent'}, ${now}
    )
    RETURNING *
  `
  return mapReminderLog(rows[0] as Record<string, unknown>)
}

export async function listReminderLogsByClient(clientId: string, limit = 20): Promise<ReminderLogRow[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM "ReminderLog"
    WHERE "clientId" = ${clientId}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `
  return rows.map(r => mapReminderLog(r as Record<string, unknown>))
}

export type ReminderLogWithClient = ReminderLogRow & {
  clientName: string
}

export const REMINDER_LOGS_PAGE_SIZE = 20
export const REMINDER_LOGS_MAX_TOTAL = 100

export type PaginatedReminderLogs = {
  logs: ReminderLogWithClient[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function mapReminderLogWithClient(row: Record<string, unknown>): ReminderLogWithClient {
  return {
    ...mapReminderLog(row),
    clientName: String(row.client_name),
  }
}

export async function listRecentReminderLogsPaginated(
  page = 1,
  pageSize = REMINDER_LOGS_PAGE_SIZE,
  maxTotal = REMINDER_LOGS_MAX_TOTAL,
): Promise<PaginatedReminderLogs> {
  const sql = getSql()
  const countRows = await sql`SELECT COUNT(*)::int AS count FROM "ReminderLog"`
  const rawTotal = Number((countRows[0] as { count: number }).count)
  const total = Math.min(rawTotal, maxTotal)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const offset = (safePage - 1) * pageSize

  if (total === 0) {
    return { logs: [], total: 0, page: 1, pageSize, totalPages: 1 }
  }

  const rows = await sql`
    SELECT rl.*, c.name AS client_name
    FROM "ReminderLog" rl
    INNER JOIN "Client" c ON c.id = rl."clientId"
    ORDER BY rl."createdAt" DESC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `

  return {
    logs: rows.map(r => mapReminderLogWithClient(r as Record<string, unknown>)),
    total,
    page: safePage,
    pageSize,
    totalPages,
  }
}
