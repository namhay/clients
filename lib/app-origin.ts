/** Public app URL for server-side fetches (fonts, static assets on Vercel). */
export function getAppOrigin(): string {
  const raw = process.env.NEXTAUTH_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    || 'http://localhost:3000'
  return raw.replace(/\/$/, '')
}
