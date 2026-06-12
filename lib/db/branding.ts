import { getSql } from '@/lib/db'
import type { BrandingAssetKey } from '@/lib/branding-assets'

export type BrandingAssetRow = {
  key: BrandingAssetKey
  data: Buffer
  mimeType: string
  updatedAt: Date
}

function mapRow(row: Record<string, unknown>): BrandingAssetRow {
  const raw = row.data
  const data = Buffer.isBuffer(raw)
    ? raw
    : Buffer.from(String(raw), 'base64')
  return {
    key: row.key as BrandingAssetKey,
    data,
    mimeType: String(row.mimeType),
    updatedAt: new Date(row.updatedAt as string),
  }
}

function isMissingBrandingTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('BrandingAsset') && message.includes('does not exist')
}

export async function getBrandingAssetFromDb(key: BrandingAssetKey): Promise<BrandingAssetRow | null> {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT key, data, "mimeType", "updatedAt"
      FROM "BrandingAsset"
      WHERE key = ${key}
      LIMIT 1
    `
    const row = rows[0] as Record<string, unknown> | undefined
    return row ? mapRow(row) : null
  } catch (error) {
    if (isMissingBrandingTable(error)) return null
    throw error
  }
}

export async function listBrandingAssetsFromDb(): Promise<BrandingAssetRow[]> {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT key, data, "mimeType", "updatedAt"
      FROM "BrandingAsset"
      ORDER BY key
    `
    return (rows as Record<string, unknown>[]).map(mapRow)
  } catch (error) {
    if (isMissingBrandingTable(error)) return []
    throw error
  }
}

export async function saveBrandingAssetToDb(
  key: BrandingAssetKey,
  buffer: Buffer,
  mimeType: string,
): Promise<BrandingAssetRow> {
  try {
    const sql = getSql()
    const now = new Date()
    const data = buffer.toString('base64')
    const rows = await sql`
      INSERT INTO "BrandingAsset" (key, data, "mimeType", "updatedAt")
      VALUES (${key}, ${data}, ${mimeType}, ${now})
      ON CONFLICT (key) DO UPDATE SET
        data = EXCLUDED.data,
        "mimeType" = EXCLUDED."mimeType",
        "updatedAt" = EXCLUDED."updatedAt"
      RETURNING key, data, "mimeType", "updatedAt"
    `
    return mapRow(rows[0] as Record<string, unknown>)
  } catch (error) {
    if (isMissingBrandingTable(error)) {
      throw new Error('Branding storage is not ready. Run npm run db:migrate on your database.')
    }
    throw error
  }
}
