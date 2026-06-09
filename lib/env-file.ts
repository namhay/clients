import fs from 'fs'
import path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env')

/** Local dev can write .env; Vercel/serverless filesystems are read-only. */
export function canWriteEnvFile(): boolean {
  if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) return false
  try {
    const dir = path.dirname(ENV_PATH)
    fs.accessSync(dir, fs.constants.W_OK)
    if (fs.existsSync(ENV_PATH)) {
      fs.accessSync(ENV_PATH, fs.constants.W_OK)
    }
    return true
  } catch {
    return false
  }
}

export function applyEnvUpdates(updates: Record<string, string>) {
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value
  }
}

export function readEnvDefaults(): Record<string, string> {
  return {
    COMPANY_NAME: process.env.COMPANY_NAME || '',
    COMPANY_ADDRESS: process.env.COMPANY_ADDRESS || '',
    COMPANY_EMAIL: process.env.COMPANY_EMAIL || '',
    COMPANY_PHONE: process.env.COMPANY_PHONE || '',
    INVOICE_PREFIX: process.env.INVOICE_PREFIX || 'INV-',
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: process.env.SMTP_PORT || '465',
    SMTP_SECURE: process.env.SMTP_SECURE || 'true',
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM: process.env.SMTP_FROM || '',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || '',
    TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL || '',
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    TELEGRAM_DEFAULT_CHAT_ID: process.env.TELEGRAM_DEFAULT_CHAT_ID || '',
    COMPANY_NAME_KHMER: process.env.COMPANY_NAME_KHMER || '',
    COMPANY_TAGLINE: process.env.COMPANY_TAGLINE || '',
    COMPANY_TIN: process.env.COMPANY_TIN || '',
    COMPANY_ADDRESS_KHMER: process.env.COMPANY_ADDRESS_KHMER || '',
    COMPANY_WEBSITE: process.env.COMPANY_WEBSITE || '',
    BANK_NAME: process.env.BANK_NAME || '',
    BANK_ACCOUNT_NO: process.env.BANK_ACCOUNT_NO || '',
    BANK_ACCOUNT_NAME: process.env.BANK_ACCOUNT_NAME || '',
  }
}

/** Apply updates to process.env and, when allowed, persist them to .env. */
export function updateEnvFile(updates: Record<string, string>): boolean {
  applyEnvUpdates(updates)
  if (!canWriteEnvFile()) return false

  if (!fs.existsSync(ENV_PATH)) {
    const lines = Object.entries(updates).map(([k, v]) => `${k}="${escapeEnvValue(v)}"`)
    fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8')
    return true
  }

  let content = fs.readFileSync(ENV_PATH, 'utf8')
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}="${escapeEnvValue(value)}"`
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(content)) {
      content = content.replace(regex, line)
    } else {
      content = content.trimEnd() + `\n${line}\n`
    }
  }
  fs.writeFileSync(ENV_PATH, content, 'utf8')
  return true
}

function escapeEnvValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
