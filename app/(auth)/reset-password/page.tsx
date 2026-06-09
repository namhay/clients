'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthShell, { AuthFooterLink } from '@/components/auth/AuthShell'
import { toast } from '@/lib/toast'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error('Reset link is invalid or expired')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Failed to reset password')
        return
      }
      toast.success('Password updated. You can sign in now.')
      router.push('/login')
    } catch {
      toast.error('Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Invalid link"
        subtitle="This password reset link is missing or expired"
        footer={<AuthFooterLink href="/forgot-password">Request a new reset link</AuthFooterLink>}
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Open the reset link from your email, or request a new one.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Set new password"
      subtitle="Choose a new password for your account"
      footer={<AuthFooterLink href="/login">← Back to sign in</AuthFooterLink>}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">New password</label>
          <input
            type="password"
            className="input"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input
            type="password"
            className="input"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Repeat new password"
            autoComplete="new-password"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-base">
          {loading ? 'Saving...' : 'Update Password'}
        </button>
      </form>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthShell title="Set new password" subtitle="Loading...">
        <p className="text-sm text-gray-500 dark:text-gray-400">Please wait...</p>
      </AuthShell>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
