import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import {
  getBrandingAssetFilePath,
  parseBrandingAssetKey,
  readBrandingAssetBuffer,
} from '@/lib/branding-assets'

export async function GET(
  _req: NextRequest,
  { params }: { params: { asset: string } },
) {
  const key = parseBrandingAssetKey(params.asset)
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = getBrandingAssetFilePath(key)
  const data = readBrandingAssetBuffer(key)
  if (!data || !filePath) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  const etag = `"${fs.statSync(filePath).mtimeMs}"`

  return new NextResponse(new Uint8Array(data.buffer), {
    headers: {
      'Content-Type': data.mimeType,
      'ETag': etag,
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
