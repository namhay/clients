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

export async function listRecentReminderLogs(limit = 15): Promise<ReminderLogWithClient[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT rl.*, c.name AS client_name
    FROM "ReminderLog" rl
    INNER JOIN "Client" c ON c.id = rl."clientId"
    ORDER BY rl."createdAt" DESC
    LIMIT ${limit}
  `
  return rows.map(r => {
    const row = r as Record<string, unknown>
    return {
      ...mapReminderLog(row),
      clientName: String(row.client_name),
    }
  })
}
