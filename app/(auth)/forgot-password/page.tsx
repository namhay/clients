'use client'
import { useState } from 'react'
import AuthShell, { AuthFooterLink } from '@/components/auth/AuthShell'
import { toast } from '@/lib/toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Failed to send reset email')
        return
      }
      setMessage(data.message || 'If that email is registered, we sent a password reset link.')
      toast.success('Check your email for the reset link')
    } catch {
      toast.error('Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter your account email and we will send a reset link"
      footer={<AuthFooterLink href="/login">← Back to sign in</AuthFooterLink>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
            {message}
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
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-base">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </AuthShell>
  )
}
