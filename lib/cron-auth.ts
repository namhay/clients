import { NextRequest } from 'next/server'

export function authorizeCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const header = req.headers.get('x-cron-secret')
  return bearer === secret || header === secret
}
