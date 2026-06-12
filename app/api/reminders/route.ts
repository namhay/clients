import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRemindersPageData } from '@/lib/reminders-page'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const logPage = Math.max(1, parseInt(searchParams.get('logPage') || '1', 10) || 1)
  const data = await getRemindersPageData(logPage)
  return NextResponse.json(data)
}
