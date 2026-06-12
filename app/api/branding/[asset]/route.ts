import { NextRequest, NextResponse } from 'next/server'
import {
  getBrandingAssetBuffer,
  getBrandingDefaultUrl,
  parseBrandingAssetKey,
} from '@/lib/branding-assets'

export async function GET(
  req: NextRequest,
  { params }: { params: { asset: string } },
) {
  const key = parseBrandingAssetKey(params.asset)
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data = await getBrandingAssetBuffer(key)
  if (!data || data.source === 'public') {
    return NextResponse.redirect(new URL(getBrandingDefaultUrl(key), req.url))
  }

  return new NextResponse(new Uint8Array(data.buffer), {
    headers: {
      'Content-Type': data.mimeType,
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
