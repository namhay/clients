import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

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

function ensureDir() {
  if (!fs.existsSync(BRANDING_DIR)) {
    fs.mkdirSync(BRANDING_DIR, { recursive: true })
  }
}

function readMeta(): BrandingMeta {
  ensureDir()
  if (!fs.existsSync(META_FILE)) return {}
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8')) as BrandingMeta
  } catch {
    return {}
  }
}

function writeMeta(meta: BrandingMeta) {
  ensureDir()
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2))
}

function isBrandingAssetKey(value: string): value is BrandingAssetKey {
  return value in BRANDING_ASSETS
}

export function getBrandingAssetFilePath(key: BrandingAssetKey): string | undefined {
  const meta = readMeta()
  const entry = meta[key]
  if (entry?.filename) {
    const customPath = path.join(BRANDING_DIR, entry.filename)
    if (fs.existsSync(customPath)) return customPath
  }

  const publicPath = path.join(process.cwd(), 'public', BRANDING_ASSETS[key].publicDefault)
  if (fs.existsSync(publicPath)) return publicPath
  return undefined
}

/** Absolute file:// URL for @react-pdf/renderer on Node. */
export function getBrandingAssetSrc(key: BrandingAssetKey): string | undefined {
  const filePath = getBrandingAssetFilePath(key)
  if (!filePath) return undefined
  return pathToFileURL(filePath).href
}

export function getBrandingAssetPublicUrl(key: BrandingAssetKey): string {
  const meta = readMeta()
  const updatedAt = meta[key]?.updatedAt
  const v = updatedAt ? String(new Date(updatedAt).getTime()) : 'default'
  return `/api/branding/${key}?v=${v}`
}

export function readBrandingAssetBuffer(key: BrandingAssetKey): { buffer: Buffer; mimeType: string } | null {
  const filePath = getBrandingAssetFilePath(key)
  if (!filePath) return null

  const meta = readMeta()
  const ext = path.extname(filePath).toLowerCase()
  const mimeType = meta[key]?.mimeType
    || (ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg')

  return { buffer: fs.readFileSync(filePath), mimeType }
}

export function saveBrandingAsset(key: BrandingAssetKey, buffer: Buffer, mimeType: string) {
  const ext = ALLOWED_MIME[mimeType]
  if (!ext) throw new Error('Unsupported image type. Use PNG, JPEG, or WebP.')

  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error('Image must be 2 MB or smaller.')
  }

  ensureDir()
  const filename = `${key}${ext}`
  fs.writeFileSync(path.join(BRANDING_DIR, filename), buffer)

  const meta = readMeta()
  meta[key] = {
    filename,
    updatedAt: new Date().toISOString(),
    mimeType,
  }
  writeMeta(meta)
  return meta[key]!
}

export function getBrandingAssetsInfo() {
  const meta = readMeta()
  return (Object.keys(BRANDING_ASSETS) as BrandingAssetKey[]).map(key => {
    const entry = meta[key]
    const hasCustom = Boolean(
      entry?.filename && fs.existsSync(path.join(BRANDING_DIR, entry.filename)),
    )
    return {
      key,
      label: BRANDING_ASSETS[key].label,
      url: getBrandingAssetPublicUrl(key),
      hasCustom,
      updatedAt: entry?.updatedAt || null,
    }
  })
}

export function parseBrandingAssetKey(value: string): BrandingAssetKey | null {
  return isBrandingAssetKey(value) ? value : null
}
