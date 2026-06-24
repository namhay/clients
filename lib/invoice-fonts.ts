import fs from 'fs'
import path from 'path'
import { Font } from '@react-pdf/renderer'
import { getAppOrigin } from '@/lib/app-origin'

let registered = false

const FONT_FILES = {
  regular: 'NotoSansKhmer-Regular.ttf',
  bold: 'NotoSansKhmer-Bold.ttf',
} as const

function fontDataUrl(buffer: Buffer): string {
  return `data:font/ttf;base64,${buffer.toString('base64')}`
}

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

function readFontBuffers(dir: string): { regular: Buffer; bold: Buffer } | null {
  try {
    const regularPath = path.join(dir, FONT_FILES.regular)
    const boldPath = path.join(dir, FONT_FILES.bold)
    if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) return null
    return {
      regular: fs.readFileSync(regularPath),
      bold: fs.readFileSync(boldPath),
    }
  } catch {
    return null
  }
}

async function fetchFontBuffers(origin: string): Promise<{ regular: Buffer; bold: Buffer } | null> {
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch(`${origin}/fonts/${FONT_FILES.regular}`),
      fetch(`${origin}/fonts/${FONT_FILES.bold}`),
    ])
    if (!regularRes.ok || !boldRes.ok) return null
    return {
      regular: Buffer.from(await regularRes.arrayBuffer()),
      bold: Buffer.from(await boldRes.arrayBuffer()),
    }
  } catch {
    return null
  }
}

function registerFromBuffers(regular: Buffer, bold: Buffer) {
  Font.register({
    family: 'InvoiceFont',
    fonts: [
      { src: fontDataUrl(regular), fontWeight: 400 },
      { src: fontDataUrl(bold), fontWeight: 700 },
    ],
  })
}

/** Register Khmer fonts for PDF generation (base64 buffers work on Vercel serverless). */
export async function registerInvoiceFontsForPdf() {
  if (registered) return

  const dir = findFontDir()
  const localFonts = dir ? readFontBuffers(dir) : null
  if (localFonts) {
    registerFromBuffers(localFonts.regular, localFonts.bold)
  } else {
    const remoteFonts = await fetchFontBuffers(getAppOrigin())
    if (!remoteFonts) {
      throw new Error('Invoice PDF fonts could not be loaded')
    }
    registerFromBuffers(remoteFonts.regular, remoteFonts.bold)
  }

  Font.registerHyphenationCallback(word => [word])
  registered = true
}

/** @deprecated Use registerInvoiceFontsForPdf */
export function registerInvoiceFonts(fontDir?: string) {
  if (registered) return
  const dir = fontDir || findFontDir() || path.join(process.cwd(), 'public', 'fonts')
  const fonts = readFontBuffers(dir)
  if (!fonts) throw new Error('Invoice PDF fonts could not be loaded')
  registerFromBuffers(fonts.regular, fonts.bold)
  Font.registerHyphenationCallback(word => [word])
  registered = true
}

/** @deprecated Use registerInvoiceFontsForPdf */
export async function registerInvoiceFontsFromUrl(origin: string) {
  if (registered) return
  const fonts = await fetchFontBuffers(origin)
  if (!fonts) throw new Error('Invoice PDF fonts could not be loaded')
  registerFromBuffers(fonts.regular, fonts.bold)
  Font.registerHyphenationCallback(word => [word])
  registered = true
}
