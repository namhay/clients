import { getSql, newId } from '@/lib/db'

export type UserRow = {
  id: string
  name: string
  email: string
  password: string
  role: string
  createdAt: Date
  updatedAt: Date
}

function mapUser(row: Record<string, unknown>): UserRow {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    password: String(row.password),
    role: String(row.role),
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  }
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM "User" WHERE email = ${email} LIMIT 1`
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapUser(row) : null
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM "User" WHERE id = ${id} LIMIT 1`
  const row = rows[0] as Record<string, unknown> | undefined
  return row ? mapUser(row) : null
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  const sql = getSql()
  const now = new Date()
  const rows = await sql`
    UPDATE "User"
    SET password = ${passwordHash}, "updatedAt" = ${now}
    WHERE id = ${id}
    RETURNING id
  `
  if (!rows[0]) throw new Error('User not found')
}

export async function upsertUser(data: {
  name: string
  email: string
  password: string
  role: string
}): Promise<UserRow> {
  const existing = await getUserByEmail(data.email)
  if (existing) return existing

  const sql = getSql()
  const id = newId()
  const now = new Date()
  const rows = await sql`
    INSERT INTO "User" (id, name, email, password, role, "createdAt", "updatedAt")
    VALUES (${id}, ${data.name}, ${data.email}, ${data.password}, ${data.role}, ${now}, ${now})
    RETURNING *
  `
  return mapUser(rows[0] as Record<string, unknown>)
}
