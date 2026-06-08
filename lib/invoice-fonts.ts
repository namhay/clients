import { Font } from '@react-pdf/renderer'
import path from 'path'

let registered = false

export function registerInvoiceFonts(fontDir?: string) {
  if (registered) return
  const dir = fontDir || path.join(process.cwd(), 'public', 'fonts')
  Font.register({
    family: 'InvoiceFont',
    fonts: [
      { src: path.join(dir, 'NotoSansKhmer-Regular.ttf'), fontWeight: 400 },
      { src: path.join(dir, 'NotoSansKhmer-Bold.ttf'), fontWeight: 700 },
    ],
  })
  registered = true
}

export function registerInvoiceFontsFromUrl(origin: string) {
  if (registered) return
  Font.register({
    family: 'InvoiceFont',
    fonts: [
      { src: `${origin}/fonts/NotoSansKhmer-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/NotoSansKhmer-Bold.ttf`, fontWeight: 700 },
    ],
  })
  registered = true
}
