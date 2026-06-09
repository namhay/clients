import { getSql, newId } from '@/lib/db'
import { createHash, randomBytes } from 'crypto'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createPasswordResetToken(): string {
  return randomBytes(32).toString('hex')
}

export async function savePasswordResetToken(userId: string, token: string): Promise<void> {
  const sql = getSql()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS)
  const tokenHash = hashToken(token)

  await sql`DELETE FROM "PasswordResetToken" WHERE "userId" = ${userId}`
  await sql`
    INSERT INTO "PasswordResetToken" (id, "userId", "tokenHash", "expiresAt", "usedAt", "createdAt")
    VALUES (${newId()}, ${userId}, ${tokenHash}, ${expiresAt}, ${null}, ${now})
  `
}

export async function findValidPasswordResetUserId(token: string): Promise<string | null> {
  const sql = getSql()
  const tokenHash = hashToken(token)
  const rows = await sql`
    SELECT "userId", "expiresAt", "usedAt"
    FROM "PasswordResetToken"
    WHERE "tokenHash" = ${tokenHash}
    LIMIT 1
  `
  const row = rows[0] as { userId: string; expiresAt: string; usedAt: string | null } | undefined
  if (!row || row.usedAt) return null
  if (new Date(row.expiresAt).getTime() < Date.now()) return null
  return row.userId
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  const sql = getSql()
  const tokenHash = hashToken(token)
  const now = new Date()
  await sql`
    UPDATE "PasswordResetToken"
    SET "usedAt" = ${now}
    WHERE "tokenHash" = ${tokenHash}
  `
}
