import { getSql, newId } from '@/lib/db'
import type { InvoiceItemRow, InvoiceRow } from '@/lib/db/invoices'
import type { ServiceWithRelations } from '@/lib/db/services'
import type { ReminderLogRow } from '@/lib/db/reminder-logs'

export type ClientRow = {
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

export type ClientWithCounts = ClientRow & {
  _count: { services: number; invoices: number }
}

export type ClientDetail = ClientRow & {
  services: ServiceWithRelations[]
  invoices: (InvoiceRow & { items: InvoiceItemRow[] })[]
  reminderLogs: ReminderLogRow[]
}

export type ClientInput = {
  name: string
  email: string
  phone?: string | null
  company?: string | null
  companyKhmer?: string | null
  address?: string | null
  vatTin?: string | null
  telegramId?: string | null
  notes?: string | null
}

function mapClient(row: Record<string, unknown>): ClientRow {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: row.phone != null ? String(row.phone) : null,
    company: row.company != null ? String(row.company) : null,
    companyKhmer: row.companyKhmer != null ? String(row.companyKhmer) : null,
    address: row.address != null ? String(row.address) : null,
    vatTin: row.vatTin != null ? String(row.vatTin) : null,
    telegramId: row.telegramId != null ? String(row.telegramId) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  }
}

function mapWithCounts(row: Record<string, unknown>): ClientWithCounts {
  return {
    ...mapClient(row),
    _count: {
      services: Number(row.service_count ?? 0),
      invoices: Number(row.invoice_count ?? 0),
    },
  }
}

export async function countClients(): Promise<number> {
  const sql = getSql()
  const rows = await sql`SELECT COUNT(*)::int AS count FROM "Client"`
  return Number((rows[0] as { count: number }).count)
}

export async function listClients(search = ''): Promise<ClientWithCounts[]> {
  const sql = getSql()
  const pattern = `%${search}%`
  const rows = search
    ? await sql`
        SELECT c.*,
          (SELECT COUNT(*)::int FROM "Service" s WHERE s."clientId" = c.id) AS service_count,
          (SELECT COUNT(*)::int FROM "Invoice" i WHERE i."clientId" = c.id) AS invoice_count
        FROM "Client" c
        WHERE c.name ILIKE ${pattern} OR c.email ILIKE ${pattern}
          OR COALESCE(c.company, '') ILIKE ${pattern} OR COALESCE(c."companyKhmer", '') ILIKE ${pattern}
        ORDER BY c."createdAt" DESC
      `
    : await sql`
        SELECT c.*,
          (SELECT COUNT(*)::int FROM "Service" s WHERE s."clientId" = c.id) AS service_count,
          (SELECT COUNT(*)::int FROM "Invoice" i WHERE i."clientId" = c.id) AS invoice_count
        FROM "Client" c
        ORDER BY c."createdAt" DESC
      `
  return rows.map(r => mapWithCounts(r as Record<string, unknown>))
}

export async function getClientById(id: string): Promise<ClientRow | null> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM "Client" WHERE id = ${id} LIMIT 1`
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapClient(row) : null
}

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  const client = await getClientById(id)
  if (!client) return null

  const { listServices } = await import('@/lib/db/services')
  const { listInvoices } = await import('@/lib/db/invoices')
  const { listReminderLogsByClient } = await import('@/lib/db/reminder-logs')

  const [services, invoices, reminderLogs] = await Promise.all([
    listServices({ clientId: id }),
    listInvoices({ clientId: id }),
    listReminderLogsByClient(id, 20),
  ])

  return { ...client, services, invoices, reminderLogs }
}

export async function createClient(data: ClientInput): Promise<ClientRow> {
  const sql = getSql()
  const id = newId()
  const now = new Date()
  const rows = await sql`
    INSERT INTO "Client" (
      id, name, email, phone, company, "companyKhmer", address, "vatTin", "telegramId", notes, "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${data.name}, ${data.email}, ${data.phone ?? null}, ${data.company ?? null},
      ${data.companyKhmer ?? null}, ${data.address ?? null}, ${data.vatTin ?? null}, ${data.telegramId ?? null}, ${data.notes ?? null},
      ${now}, ${now}
    )
    RETURNING *
  `
  return mapClient(rows[0] as Record<string, unknown>)
}

export async function updateClient(id: string, data: Partial<ClientInput>): Promise<ClientRow> {
  const sql = getSql()
  const existing = await getClientById(id)
  if (!existing) throw new Error('Client not found')
  const now = new Date()
  const rows = await sql`
    UPDATE "Client" SET
      name = ${data.name ?? existing.name},
      email = ${data.email ?? existing.email},
      phone = ${data.phone !== undefined ? data.phone : existing.phone},
      company = ${data.company !== undefined ? data.company : existing.company},
      "companyKhmer" = ${data.companyKhmer !== undefined ? data.companyKhmer : existing.companyKhmer},
      address = ${data.address !== undefined ? data.address : existing.address},
      "vatTin" = ${data.vatTin !== undefined ? data.vatTin : existing.vatTin},
      "telegramId" = ${data.telegramId !== undefined ? data.telegramId : existing.telegramId},
      notes = ${data.notes !== undefined ? data.notes : existing.notes},
      "updatedAt" = ${now}
    WHERE id = ${id}
    RETURNING *
  `
  return mapClient(rows[0] as Record<string, unknown>)
}

export async function deleteClient(id: string) {
  const sql = getSql()
  await sql`DELETE FROM "Client" WHERE id = ${id}`
}

export async function clearTelegramIdForOtherClients(chatId: string, excludeClientId: string) {
  const sql = getSql()
  await sql`
    UPDATE "Client" SET "telegramId" = NULL, "updatedAt" = ${new Date()}
    WHERE "telegramId" = ${chatId} AND id != ${excludeClientId}
  `
}

export async function linkClientTelegram(clientId: string, chatId: string): Promise<ClientRow> {
  await clearTelegramIdForOtherClients(chatId, clientId)
  return updateClient(clientId, { telegramId: chatId })
}
