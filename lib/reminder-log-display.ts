export function formatReminderLogMessage(log: { type: string; message?: string | null }) {
  if (log.type === 'Telegram connected') {
    const telegramId = log.message?.match(/Chat ID (\S+)/)?.[1]
    return telegramId ? `Telegram ID: ${telegramId} is connected.` : log.type
  }
  return log.type
}
