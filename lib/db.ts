import { neon } from '@neondatabase/serverless'

export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return neon(url)
}

export function newId() {
  return crypto.randomUUID()
}

export function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; message?: string }
  return err?.code === '23505' || Boolean(err?.message?.toLowerCase().includes('unique'))
}

export function pgErrorMessage(e: unknown, fallback: string) {
  if (e instanceof Error) {
    if (isUniqueViolation(e)) return 'A record with this value already exists'
    return e.message
  }
  return fallback
}
