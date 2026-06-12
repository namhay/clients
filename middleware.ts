import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  matcher: ['/((?!login|forgot-password|reset-password|api/auth|api/branding|api/cron|api/telegram/webhook|api/invoices/[^/]+/pdf|_next/static|_next/image|favicon.ico|invoice-logo.png).*)'],
}
