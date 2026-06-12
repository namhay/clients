import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getBrandingAssetsInfo,
  parseBrandingAssetKey,
  saveBrandingAsset,
} from '@/lib/branding-assets'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const assets = await getBrandingAssetsInfo()
    return NextResponse.json({ assets })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load branding assets'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const assetRaw = String(formData.get('asset') || '')
    const file = formData.get('file')

    const key = parseBrandingAssetKey(assetRaw)
    if (!key) return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 })
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Choose an image file to upload' }, { status: 400 })
    }

    const allowed = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Use PNG, JPEG, or WebP images only' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    await saveBrandingAsset(key, buffer, file.type)

    const assets = await getBrandingAssetsInfo()
    return NextResponse.json({ assets })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
