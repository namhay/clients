import sharp from 'sharp'

type OptimizeImageForPdfOptions = {
  maxWidth: number
  maxHeight: number
  /** QR codes and simple graphics stay PNG; photos/stamps use JPEG. */
  preferJpeg?: boolean
  jpegQuality?: number
}

export async function optimizeImageForPdf(
  buffer: Buffer,
  mimeType: string,
  options: OptimizeImageForPdfOptions,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { maxWidth, maxHeight, preferJpeg = false, jpegQuality = 82 } = options

  let pipeline = sharp(buffer, { animated: false }).rotate().resize({
    width: maxWidth,
    height: maxHeight,
    fit: 'inside',
    withoutEnlargement: true,
  })

  if (preferJpeg) {
    const out = await pipeline
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: jpegQuality, mozjpeg: true })
      .toBuffer()
    return { buffer: out, mimeType: 'image/jpeg' }
  }

  const out = await pipeline
    .png({ compressionLevel: 9, palette: buffer.length > 24_000 })
    .toBuffer()
  return { buffer: out, mimeType: 'image/png' }
}
