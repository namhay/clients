import fs from 'fs'
import path from 'path'
import { Font } from '@react-pdf/renderer'
import { getAppOrigin } from '@/lib/app-origin'

let registered = false

const FONT_FILES = {
  regular: 'NotoSansKhmer-Regular.ttf',
  bold: 'NotoSansKhmer-Bold.ttf',
} as const

function findFontDir(): string | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts'),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'fonts'),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, FONT_FILES.regular))) return dir
  }
  return null
}

function registerFromDir(dir: string) {
  Font.register({
    family: 'InvoiceFont',
    fonts: [
      { src: path.join(dir, FONT_FILES.regular), fontWeight: 400 },
      { src: path.join(dir, FONT_FILES.bold), fontWeight: 700 },
    ],
  })
}

function registerFromUrl(origin: string) {
  Font.register({
    family: 'InvoiceFont',
    fonts: [
      { src: `${origin}/fonts/${FONT_FILES.regular}`, fontWeight: 400 },
      { src: `${origin}/fonts/${FONT_FILES.bold}`, fontWeight: 700 },
    ],
  })
}

/** Register Khmer fonts for PDF generation (local files, then deployed URL fallback). */
export function registerInvoiceFontsForPdf() {
  if (registered) return

  const dir = findFontDir()
  if (dir) {
    registerFromDir(dir)
  } else {
    registerFromUrl(getAppOrigin())
  }

  Font.registerHyphenationCallback(word => [word])
  registered = true
}

/** @deprecated Use registerInvoiceFontsForPdf */
export function registerInvoiceFonts(fontDir?: string) {
  if (registered) return
  const dir = fontDir || findFontDir() || path.join(process.cwd(), 'public', 'fonts')
  registerFromDir(dir)
  Font.registerHyphenationCallback(word => [word])
  registered = true
}

/** @deprecated Use registerInvoiceFontsForPdf */
export function registerInvoiceFontsFromUrl(origin: string) {
  if (registered) return
  registerFromUrl(origin)
  Font.registerHyphenationCallback(word => [word])
  registered = true
}
