import {
  createPasswordResetToken,
  findValidPasswordResetUserId,
  markPasswordResetTokenUsed,
  savePasswordResetToken,
} from '@/lib/db/password-reset'
import { getUserByEmail, updateUserPassword } from '@/lib/db/users'
import { passwordResetEmailTemplate, sendEmail } from '@/lib/email'
import { getAppSettings } from '@/lib/settings'
import bcrypt from 'bcryptjs'

function getAppBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
  if (!url) return 'http://localhost:3000'
  if (url.startsWith('http')) return url.replace(/\/$/, '')
  return `https://${url}`
}

export async function requestPasswordReset(email: string): Promise<{ sent: boolean; message: string }> {
  const normalized = email.trim()
  if (!normalized) throw new Error('Email is required')

  const settings = await getAppSettings()
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    throw new Error('Email is not configured. Add SMTP settings in Settings first.')
  }

  const user = await getUserByEmail(normalized)
  if (!user) {
    return {
      sent: true,
      message: 'If that email is registered, we sent a password reset link.',
    }
  }

  const token = createPasswordResetToken()
  await savePasswordResetToken(user.id, token)

  const resetUrl = `${getAppBaseUrl()}/reset-password?token=${token}`
  await sendEmail({
    to: user.email,
    subject: `Reset your ${settings.companyName} password`,
    html: passwordResetEmailTemplate({
      name: user.name,
      resetUrl,
      companyName: settings.companyName,
    }),
  })

  return {
    sent: true,
    message: 'If that email is registered, we sent a password reset link.',
  }
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  const trimmedToken = token.trim()
  if (!trimmedToken) throw new Error('Reset link is invalid or expired')
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters')
  if (newPassword !== confirmPassword) throw new Error('Passwords do not match')

  const userId = await findValidPasswordResetUserId(trimmedToken)
  if (!userId) throw new Error('Reset link is invalid or expired')

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await updateUserPassword(userId, passwordHash)
  await markPasswordResetTokenUsed(trimmedToken)
}
