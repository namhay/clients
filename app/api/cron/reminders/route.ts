import { NextRequest, NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron-auth'

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    skipped: true,
    reason: 'Automatic reminders are disabled. Send reminders manually from the Reminders page.',
  })
}
