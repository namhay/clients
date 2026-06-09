import { NextRequest, NextResponse } from 'next/server'
import { resetPasswordWithToken } from '@/lib/password-reset'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await resetPasswordWithToken(
      String(body.token || ''),
      String(body.newPassword || ''),
      String(body.confirmPassword || ''),
    )
    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to reset password'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
