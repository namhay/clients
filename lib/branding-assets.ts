import fs from 'fs'
import path from 'path'
import { getAppOrigin } from '@/lib/app-origin'
import {
  getBrandingAssetFromDb,
  listBrandingAssetsFromDb,
  saveBrandingAssetToDb,
  saveBrandingPdfRaster,
} from '@/lib/db/branding'
import { rasterizeSvgToPng } from '@/lib/svg-rasterize'

export const BRANDING_ASSETS = {
  logo: { key: 'logo', label: 'Company Logo', publicDefault: 'invoice-logo.png' },
  stamp: { key: 'stamp', label: 'Company Stamp', publicDefault: 'invoice-stamp.png' },
  qr: { key: 'qr', label: 'Payment QR Code', publicDefault: 'aba-qr.png' },
} as const

export type BrandingAssetKey = keyof typeof BRANDING_ASSETS

const BRANDING_DIR = path.join(process.cwd(), 'data', 'branding')
const META_FILE = path.join(BRANDING_DIR, 'meta.json')

export const BRANDING_ALLOWED_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export function resolveBrandingMimeType(fileName: string, fileType: string): string | null {
  if (fileType in BRANDING_ALLOWED_MIME) return fileType
  const ext = path.extname(fileName).toLowerCase()
  return MIME_BY_EXT[ext] ?? null
}

function mimeFromPath(filePath: string, fallbackMime?: string): string {
  if (fallbackMime) return fallbackMime
  const ext = path.extname(filePath).toLowerCase()
  return MIME_BY_EXT[ext] || 'image/jpeg'
}

function isSvgMime(mimeType: string): boolean {
  return mimeType === 'image/svg+xml' || mimeType === 'image/svg'
}

/** Target pixel sizes for PDF embed (~2x display size on A4). */
const PDF_EMBED_SIZES: Record<BrandingAssetKey, { maxWidth: number; maxHeight: number; preferJpeg?: boolean }> = {
  logo: { maxWidth: 400, maxHeight: 112 },
  stamp: { maxWidth: 360, maxHeight: 180, preferJpeg: true },
  qr: { maxWidth: 140, maxHeight: 140 },
}

async function optimizeBrandingForPdf(
  key: BrandingAssetKey,
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { optimizeImageForPdf } = await import('@/lib/pdf-image-optimize')
  const size = PDF_EMBED_SIZES[key]
  return optimizeImageForPdf(buffer, mimeType, size)
}

async function preparePdfImageBuffer(
  key: BrandingAssetKey,
  buffer: Buffer,
  mimeType: string,
  cachedPdf?: Buffer | null,
  cachedPdfMime?: string | null,
): Promise<{ buffer: Buffer; mimeType: string }> {
  let prepared: { buffer: Buffer; mimeType: string }

  if (cachedPdf) {
    prepared = { buffer: cachedPdf, mimeType: cachedPdfMime || 'image/png' }
  } else if (isSvgMime(mimeType)) {
    const png = await rasterizeSvgToPng(buffer, PDF_EMBED_SIZES[key].maxWidth)
    prepared = { buffer: png, mimeType: 'image/png' }
  } else {
    prepared = { buffer, mimeType }
  }

  return optimizeBrandingForPdf(key, prepared.buffer, prepared.mimeType)
}

async function fetchPublicBrandingBuffer(
  key: BrandingAssetKey,
): Promise<{ buffer: Buffer; mimeType: string; source: 'public' } | null> {
  try {
    const fileName = BRANDING_ASSETS[key].publicDefault
    const res = await fetch(`${getAppOrigin()}/${fileName}`)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim()
      || mimeFromPath(fileName)
    return { buffer, mimeType, source: 'public' }
  } catch {
    return null
  }
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

type BrandingAssetBuffer = {
  buffer: Buffer
  mimeType: string
  pdfData: Buffer | null
  pdfMimeType: string | null
  source: 'db' | 'local' | 'public'
}

export async function getBrandingAssetBuffer(
  key: BrandingAssetKey,
): Promise<BrandingAssetBuffer | null> {
  const dbRow = await getBrandingAssetFromDb(key)
  if (dbRow) {
    return {
      buffer: dbRow.data,
      mimeType: dbRow.mimeType,
      pdfData: dbRow.pdfData,
      pdfMimeType: dbRow.pdfMimeType,
      source: 'db',
    }
  }

  const localPath = getLocalCustomPath(key)
  if (localPath) {
    const meta = readMetaSafe()
    const mimeType = mimeFromPath(localPath, meta[key]?.mimeType)
    return {
      buffer: fs.readFileSync(localPath),
      mimeType,
      pdfData: null,
      pdfMimeType: null,
      source: 'local',
    }
  }

  const publicPath = getPublicAssetPath(key)
  if (publicPath) {
    const mimeType = mimeFromPath(publicPath)
    return {
      buffer: fs.readFileSync(publicPath),
      mimeType,
      pdfData: null,
      pdfMimeType: null,
      source: 'public',
    }
  }

  const fetched = await fetchPublicBrandingBuffer(key)
  if (!fetched) return null
  return { ...fetched, pdfData: null, pdfMimeType: null }
}

/** Data URL for @react-pdf/renderer (works on Vercel serverless). */
export async function getBrandingAssetSrc(key: BrandingAssetKey): Promise<string | undefined> {
  try {
    const asset = await getBrandingAssetBuffer(key)
    if (!asset) return undefined

    const { buffer, mimeType } = await preparePdfImageBuffer(
      key,
      asset.buffer,
      asset.mimeType,
      asset.pdfData,
      asset.pdfMimeType,
    )

    if (
      asset.source === 'db'
      && isSvgMime(asset.mimeType)
      && !asset.pdfData
    ) {
      void saveBrandingPdfRaster(key, buffer).catch(() => {})
    }

    return `data:${mimeType};base64,${buffer.toString('base64')}`
  } catch (e) {
    console.error(`Branding PDF raster failed for ${key}:`, e)
    return undefined
  }
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
  const ext = BRANDING_ALLOWED_MIME[mimeType]
  if (!ext) throw new Error('Unsupported image type. Use PNG, JPEG, WebP, or SVG.')

  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error('Image must be 2 MB or smaller.')
  }

  let pdfData: Buffer | null = null
  let pdfMimeType: string | null = null
  if (isSvgMime(mimeType)) {
    const rasterized = await rasterizeSvgToPng(buffer, PDF_EMBED_SIZES[key].maxWidth)
    const optimized = await optimizeBrandingForPdf(key, rasterized, 'image/png')
    pdfData = optimized.buffer
    pdfMimeType = optimized.mimeType
  }

  const saved = await saveBrandingAssetToDb(key, buffer, mimeType, pdfData, pdfMimeType)

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
