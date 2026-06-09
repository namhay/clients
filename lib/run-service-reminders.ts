import { createReminderLog } from '@/lib/db/reminder-logs'
import { listServices } from '@/lib/db/services'
import { getMaxReminderWindowDays } from '@/lib/db/product-types'
import { sendEmail, reminderEmailTemplate } from '@/lib/email'
import { expiryWithinDays, filterServicesDueForReminder } from '@/lib/reminders'
import { getAppSettings } from '@/lib/settings'
import { sendTelegram, reminderTelegramMessage } from '@/lib/telegram'

export type ReminderRunResult = {
  processed: number
  emailed: number
  telegram: number
  errors: string[]
}

export async function runServiceExpiryReminders(): Promise<ReminderRunResult> {
  const settings = await getAppSettings()
  const maxDays = await getMaxReminderWindowDays()
  const candidates = await listServices({
    expiryDateLte: expiryWithinDays(maxDays),
    status: 'ACTIVE',
  })
  const services = filterServicesDueForReminder(candidates)

  const result: ReminderRunResult = {
    processed: services.length,
    emailed: 0,
    telegram: 0,
    errors: [],
  }

  for (const svc of services) {
    const details = `${svc.productType.name} — ${svc.name}`
    const dueDate = svc.expiryDate.toISOString().split('T')[0]

    try {
      await sendEmail({
        to: svc.client.email,
        subject: `Reminder: ${details} expiring soon`,
        html: reminderEmailTemplate({
          clientName: svc.client.name,
          type: 'service',
          details,
          dueDate,
          companyName: settings.companyName,
          companyEmail: settings.companyEmail,
        }),
      })
      await createReminderLog({
        clientId: svc.clientId,
        type: `Service reminder: ${details}`,
        channel: 'Email',
        status: 'sent',
      })
      result.emailed++
    } catch (e) {
      result.errors.push(`Email ${svc.client.email}: ${e instanceof Error ? e.message : 'failed'}`)
    }

    const chatId = svc.client.telegramId
      || settings.telegramDefaultChatId
      || process.env.TELEGRAM_DEFAULT_CHAT_ID
      || ''

    if (chatId) {
      try {
        const message = reminderTelegramMessage({
          clientName: svc.client.name,
          details,
          dueDate: svc.expiryDate,
          companyName: settings.companyName,
        })
        await sendTelegram(chatId, message)
        await createReminderLog({
          clientId: svc.clientId,
          type: 'Service reminder',
          channel: 'Telegram',
          message,
          status: 'sent',
        })
        result.telegram++
      } catch (e) {
        result.errors.push(`Telegram ${svc.client.name}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
  }

  return result
}
