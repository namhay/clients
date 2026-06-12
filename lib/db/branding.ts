import { getSql } from '@/lib/db'
import type { BrandingAssetKey } from '@/lib/branding-assets'

export type BrandingAssetRow = {
  key: BrandingAssetKey
  data: Buffer
  mimeType: string
  pdfData: Buffer | null
  pdfMimeType: string | null
  updatedAt: Date
}

function decodeBuffer(raw: unknown): Buffer {
  return Buffer.isBuffer(raw)
    ? raw
    : Buffer.from(String(raw), 'base64')
}

function mapRow(row: Record<string, unknown>): BrandingAssetRow {
  return {
    key: row.key as BrandingAssetKey,
    data: decodeBuffer(row.data),
    mimeType: String(row.mimeType),
    pdfData: row.pdfData != null ? decodeBuffer(row.pdfData) : null,
    pdfMimeType: row.pdfMimeType != null ? String(row.pdfMimeType) : null,
    updatedAt: new Date(row.updatedAt as string),
  }
}

function isMissingBrandingTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('BrandingAsset') && message.includes('does not exist')
}

function isMissingPdfColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('pdfData') || message.includes('pdfMimeType')
}

export async function getBrandingAssetFromDb(key: BrandingAssetKey): Promise<BrandingAssetRow | null> {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT key, data, "mimeType", "pdfData", "pdfMimeType", "updatedAt"
      FROM "BrandingAsset"
      WHERE key = ${key}
      LIMIT 1
    `
    const row = rows[0] as Record<string, unknown> | undefined
    return row ? mapRow(row) : null
  } catch (error) {
    if (isMissingBrandingTable(error) || isMissingPdfColumns(error)) {
      try {
        const sql = getSql()
        const rows = await sql`
          SELECT key, data, "mimeType", "updatedAt"
          FROM "BrandingAsset"
          WHERE key = ${key}
          LIMIT 1
        `
        const row = rows[0] as Record<string, unknown> | undefined
        if (!row) return null
        return { ...mapRow({ ...row, pdfData: null, pdfMimeType: null }), pdfData: null, pdfMimeType: null }
      } catch (fallbackError) {
        if (isMissingBrandingTable(fallbackError)) return null
        throw fallbackError
      }
    }
    throw error
  }
}

export async function listBrandingAssetsFromDb(): Promise<BrandingAssetRow[]> {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT key, data, "mimeType", "pdfData", "pdfMimeType", "updatedAt"
      FROM "BrandingAsset"
      ORDER BY key
    `
    return (rows as Record<string, unknown>[]).map(mapRow)
  } catch (error) {
    if (isMissingBrandingTable(error) || isMissingPdfColumns(error)) {
      try {
        const sql = getSql()
        const rows = await sql`
          SELECT key, data, "mimeType", "updatedAt"
          FROM "BrandingAsset"
          ORDER BY key
        `
        return (rows as Record<string, unknown>[]).map(row => ({
          ...mapRow({ ...row, pdfData: null, pdfMimeType: null }),
          pdfData: null,
          pdfMimeType: null,
        }))
      } catch (fallbackError) {
        if (isMissingBrandingTable(fallbackError)) return []
        throw fallbackError
      }
    }
    throw error
  }
}

export async function saveBrandingAssetToDb(
  key: BrandingAssetKey,
  buffer: Buffer,
  mimeType: string,
  pdfData: Buffer | null = null,
  pdfMimeType: string | null = null,
): Promise<BrandingAssetRow> {
  try {
    const sql = getSql()
    const now = new Date()
    const data = buffer.toString('base64')
    const pdfDataB64 = pdfData ? pdfData.toString('base64') : null
    const rows = await sql`
      INSERT INTO "BrandingAsset" (key, data, "mimeType", "pdfData", "pdfMimeType", "updatedAt")
      VALUES (${key}, ${data}, ${mimeType}, ${pdfDataB64}, ${pdfMimeType}, ${now})
      ON CONFLICT (key) DO UPDATE SET
        data = EXCLUDED.data,
        "mimeType" = EXCLUDED."mimeType",
        "pdfData" = EXCLUDED."pdfData",
        "pdfMimeType" = EXCLUDED."pdfMimeType",
        "updatedAt" = EXCLUDED."updatedAt"
      RETURNING key, data, "mimeType", "pdfData", "pdfMimeType", "updatedAt"
    `
    return mapRow(rows[0] as Record<string, unknown>)
  } catch (error) {
    if (isMissingPdfColumns(error)) {
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
      return { ...mapRow({ ...(rows[0] as Record<string, unknown>), pdfData: null, pdfMimeType: null }), pdfData: null, pdfMimeType: null }
    }
    if (isMissingBrandingTable(error)) {
      throw new Error('Branding storage is not ready. Run npm run db:migrate on your database.')
    }
    throw error
  }
}

export async function saveBrandingPdfRaster(
  key: BrandingAssetKey,
  pdfData: Buffer,
): Promise<void> {
  try {
    const sql = getSql()
    const now = new Date()
    await sql`
      UPDATE "BrandingAsset"
      SET "pdfData" = ${pdfData.toString('base64')},
          "pdfMimeType" = 'image/png',
          "updatedAt" = ${now}
      WHERE key = ${key}
    `
  } catch (error) {
    if (isMissingPdfColumns(error) || isMissingBrandingTable(error)) return
    throw error
  }
}
