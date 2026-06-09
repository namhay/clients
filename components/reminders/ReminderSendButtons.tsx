'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '@/lib/toast'

type ReminderSendButtonsProps = {
  clientId: string
  invoiceId?: string
  serviceId?: string
  variant: 'invoice' | 'service'
  hasTelegram: boolean
  clientEmail?: string
  clientName?: string
}

export default function ReminderSendButtons({
  clientId,
  invoiceId,
  serviceId,
  variant,
  hasTelegram,
  clientEmail,
  clientName,
}: ReminderSendButtonsProps) {
  const router = useRouter()
  const [sending, setSending] = useState<string | null>(null)

  const send = async (channel: 'email' | 'telegram', mode: 'invoice' | 'reminder') => {
    const key = `${channel}-${mode}`
    setSending(key)
    try {
      const endpoint = channel === 'email' ? '/api/reminders/email' : '/api/reminders/telegram'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          type: mode === 'invoice' ? 'invoice' : 'reminder',
          invoiceId,
          serviceId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Send failed')

      if (mode === 'invoice') {
        toast.success(
          channel === 'email'
            ? `Invoice email sent to ${clientEmail || clientName || 'client'}`
            : `Invoice sent via Telegram to ${clientName || 'client'}`,
        )
      } else {
        toast.success(`${channel === 'email' ? 'Email' : 'Telegram'} reminder sent`)
      }
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(null)
    }
  }

  const busy = (channel: 'email' | 'telegram', mode: 'invoice' | 'reminder') =>
    sending === `${channel}-${mode}`

  if (variant === 'invoice') {
    return (
      <div className="flex flex-wrap justify-end gap-1">
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          disabled={Boolean(sending)}
          onClick={() => send('email', 'invoice')}
        >
          {busy('email', 'invoice') ? '…' : 'Email invoice'}
        </button>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          disabled={Boolean(sending) || !hasTelegram}
          title={hasTelegram ? 'Send invoice PDF via Telegram' : 'Client has no Telegram connected'}
          onClick={() => send('telegram', 'invoice')}
        >
          {busy('telegram', 'invoice') ? '…' : 'TG invoice'}
        </button>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          disabled={Boolean(sending)}
          onClick={() => send('email', 'reminder')}
        >
          {busy('email', 'reminder') ? '…' : 'Remind'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <button
        type="button"
        className="btn-secondary px-2 py-1 text-xs"
        disabled={Boolean(sending)}
        onClick={() => send('email', 'reminder')}
      >
        {busy('email', 'reminder') ? '…' : 'Email'}
      </button>
      <button
        type="button"
        className="btn-secondary px-2 py-1 text-xs"
        disabled={Boolean(sending) || !hasTelegram}
        title={hasTelegram ? 'Send via Telegram' : 'Client has no Telegram connected'}
        onClick={() => send('telegram', 'reminder')}
      >
        {busy('telegram', 'reminder') ? '…' : 'Telegram'}
      </button>
    </div>
  )
}
