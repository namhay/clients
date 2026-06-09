import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '@/lib/password-reset'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await requestPasswordReset(String(body.email || ''))
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send reset email'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
