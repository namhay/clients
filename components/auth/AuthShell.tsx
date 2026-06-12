import Link from 'next/link'
import ThemeToggle from '@/components/layout/ThemeToggle'

type AuthShellProps = {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 p-4">
      <div className="absolute right-4 top-4 w-auto">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 sm:p-8">
        <div className="mb-8 text-center">
          <img
            src="/api/branding/logo"
            alt="IT SMART"
            className="mx-auto mb-4 h-14 w-auto max-w-[220px] object-contain"
          />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {children}
        {footer}
      </div>
    </div>
  )
}

export function AuthFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
      <Link href={href} className="font-medium text-blue-700 hover:underline dark:text-blue-300">
        {children}
      </Link>
    </p>
  )
}
