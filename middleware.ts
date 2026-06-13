import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  matcher: ['/((?!login|forgot-password|reset-password|telegram|api/auth|api/branding|api/cron|api/telegram/webhook|api/telegram/mini-app|api/invoices/[^/]+/pdf|_next/static|_next/image|favicon.ico|invoice-logo.png).*)'],
}
