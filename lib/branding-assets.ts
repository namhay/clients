import fs from 'fs'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import {
  getBrandingAssetFromDb,
  listBrandingAssetsFromDb,
  saveBrandingAssetToDb,
} from '@/lib/db/branding'

export const BRANDING_ASSETS = {
  logo: { key: 'logo', label: 'Company Logo', publicDefault: 'invoice-logo.png' },
  stamp: { key: 'stamp', label: 'Company Stamp', publicDefault: 'invoice-stamp.png' },
  qr: { key: 'qr', label: 'Payment QR Code', publicDefault: 'aba-qr.png' },
} as const

export type BrandingAssetKey = keyof typeof BRANDING_ASSETS

const BRANDING_DIR = path.join(process.cwd(), 'data', 'branding')
const META_FILE = path.join(BRANDING_DIR, 'meta.json')

const ALLOWED_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
}

type BrandingMetaEntry = {
  filename: string
  updatedAt: string
  mimeType: string
}

type BrandingMeta = Partial<Record<BrandingAssetKey, BrandingMetaEntry>>

function isBrandingAssetKey(value: string): value is BrandingAssetKey {
  return value in BRANDING_ASSETS
}

function canUseLocalFilesystem() {
  return process.env.VERCEL !== '1'
}

function readMetaSafe(): BrandingMeta {
  if (!canUseLocalFilesystem()) return {}
  try {
    if (!fs.existsSync(META_FILE)) return {}
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8')) as BrandingMeta
  } catch {
    return {}
  }
}

function writeMetaSafe(meta: BrandingMeta) {
  if (!canUseLocalFilesystem()) return
  try {
    if (!fs.existsSync(BRANDING_DIR)) {
      fs.mkdirSync(BRANDING_DIR, { recursive: true })
    }
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2))
  } catch {
    // Ignore read-only filesystem (e.g. Vercel)
  }
}

function getPublicAssetPath(key: BrandingAssetKey): string | undefined {
  const publicPath = path.join(process.cwd(), 'public', BRANDING_ASSETS[key].publicDefault)
  if (fs.existsSync(publicPath)) return publicPath
  return undefined
}

function getLocalCustomPath(key: BrandingAssetKey): string | undefined {
  if (!canUseLocalFilesystem()) return undefined
  const meta = readMetaSafe()
  const entry = meta[key]
  if (!entry?.filename) return undefined
  const customPath = path.join(BRANDING_DIR, entry.filename)
  if (fs.existsSync(customPath)) return customPath
  return undefined
}

export function getBrandingDefaultUrl(key: BrandingAssetKey): string {
  return `/${BRANDING_ASSETS[key].publicDefault}`
}

export function parseBrandingAssetKey(value: string): BrandingAssetKey | null {
  return isBrandingAssetKey(value) ? value : null
}

export async function getBrandingAssetBuffer(
  key: BrandingAssetKey,
): Promise<{ buffer: Buffer; mimeType: string; source: 'db' | 'local' | 'public' } | null> {
  const dbRow = await getBrandingAssetFromDb(key)
  if (dbRow) {
    return { buffer: dbRow.data, mimeType: dbRow.mimeType, source: 'db' }
  }

  const localPath = getLocalCustomPath(key)
  if (localPath) {
    const meta = readMetaSafe()
    const ext = path.extname(localPath).toLowerCase()
    const mimeType = meta[key]?.mimeType
      || (ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg')
    return { buffer: fs.readFileSync(localPath), mimeType, source: 'local' }
  }

  const publicPath = getPublicAssetPath(key)
  if (publicPath) {
    const ext = path.extname(publicPath).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    return { buffer: fs.readFileSync(publicPath), mimeType, source: 'public' }
  }

  return null
}

/** Absolute file:// URL for @react-pdf/renderer on Node. */
export async function getBrandingAssetSrc(key: BrandingAssetKey): Promise<string | undefined> {
  const asset = await getBrandingAssetBuffer(key)
  if (!asset) return undefined

  if (asset.source === 'public') {
    const publicPath = getPublicAssetPath(key)
    if (publicPath) return pathToFileURL(publicPath).href
  }

  const tmpDir = canUseLocalFilesystem() ? BRANDING_DIR : os.tmpdir()
  try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
  } catch {
    // /tmp always exists on Vercel
  }

  const ext = ALLOWED_MIME[asset.mimeType] || '.png'
  const tmpPath = path.join(tmpDir, `branding-${key}${ext}`)
  fs.writeFileSync(tmpPath, asset.buffer)
  return pathToFileURL(tmpPath).href
}

export async function getBrandingAssetPublicUrl(key: BrandingAssetKey): Promise<string> {
  const dbRow = await getBrandingAssetFromDb(key)
  if (dbRow) {
    return `/api/branding/${key}?v=${dbRow.updatedAt.getTime()}`
  }

  if (getLocalCustomPath(key)) {
    const meta = readMetaSafe()
    const updatedAt = meta[key]?.updatedAt
    const v = updatedAt ? String(new Date(updatedAt).getTime()) : 'local'
    return `/api/branding/${key}?v=${v}`
  }

  return getBrandingDefaultUrl(key)
}

export async function saveBrandingAsset(key: BrandingAssetKey, buffer: Buffer, mimeType: string) {
  const ext = ALLOWED_MIME[mimeType]
  if (!ext) throw new Error('Unsupported image type. Use PNG, JPEG, or WebP.')

  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error('Image must be 2 MB or smaller.')
  }

  const saved = await saveBrandingAssetToDb(key, buffer, mimeType)

  if (canUseLocalFilesystem()) {
    try {
      if (!fs.existsSync(BRANDING_DIR)) {
        fs.mkdirSync(BRANDING_DIR, { recursive: true })
      }
      const filename = `${key}${ext}`
      fs.writeFileSync(path.join(BRANDING_DIR, filename), buffer)
      const meta = readMetaSafe()
      meta[key] = {
        filename,
        updatedAt: saved.updatedAt.toISOString(),
        mimeType,
      }
      writeMetaSafe(meta)
    } catch {
      // DB save is enough on read-only hosts
    }
  }

  return saved
}

function getDefaultBrandingAssetsInfo() {
  return (Object.keys(BRANDING_ASSETS) as BrandingAssetKey[]).map(key => ({
    key,
    label: BRANDING_ASSETS[key].label,
    url: getBrandingDefaultUrl(key),
    hasCustom: false,
    updatedAt: null,
  }))
}

export async function getBrandingAssetsInfo() {
  try {
    const dbRows = await listBrandingAssetsFromDb()
    const dbByKey = new Map(dbRows.map(row => [row.key, row]))
    const meta = readMetaSafe()

    return (Object.keys(BRANDING_ASSETS) as BrandingAssetKey[]).map(key => {
      const dbRow = dbByKey.get(key)
      const hasLocalCustom = Boolean(getLocalCustomPath(key))
      const hasCustom = Boolean(dbRow || hasLocalCustom)
      const updatedAt = dbRow?.updatedAt.toISOString() || meta[key]?.updatedAt || null

      return {
        key,
        label: BRANDING_ASSETS[key].label,
        url: hasCustom
          ? `/api/branding/${key}?v=${updatedAt ? String(new Date(updatedAt).getTime()) : 'custom'}`
          : getBrandingDefaultUrl(key),
        hasCustom,
        updatedAt,
      }
    })
  } catch {
    return getDefaultBrandingAssetsInfo()
  }
}
