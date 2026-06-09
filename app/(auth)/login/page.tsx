'use client'
import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/auth/AuthShell'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password')
      return
    }
    router.push('/')
  }

  return (
    <AuthShell title="Sign in" subtitle="Sign in to your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label">Email address</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="admin@yourdomain.com"
            autoComplete="email"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="label mb-0">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            className="input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-base">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </AuthShell>
  )
}
