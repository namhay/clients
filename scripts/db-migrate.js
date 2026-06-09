/**
 * Apply incremental SQL migrations to Neon PostgreSQL.
 * Run: npm run db:migrate
 */
const { neon } = require('@neondatabase/serverless')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const sql = neon(url)

  await sql`
    ALTER TABLE "AppSettings"
    ADD COLUMN IF NOT EXISTS "reminderTime" TEXT NOT NULL DEFAULT '09:00'
  `
  await sql`
    ALTER TABLE "AppSettings"
    ADD COLUMN IF NOT EXISTS "reminderTimezone" TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh'
  `
  await sql`
    ALTER TABLE "AppSettings"
    ADD COLUMN IF NOT EXISTS "lastReminderRunDate" TEXT
  `

  await sql`
    ALTER TABLE "ProductType"
    ADD COLUMN IF NOT EXISTS "reminderTiming" TEXT NOT NULL DEFAULT 'BEFORE'
  `
  await sql`
    ALTER TABLE "AppSettings"
    ADD COLUMN IF NOT EXISTS "invoiceStartNumber" INTEGER NOT NULL DEFAULT 1
  `

  console.log('✓ AppSettings reminder schedule columns ready')
  console.log('✓ ProductType reminderTiming column ready')
  console.log('✓ AppSettings invoiceStartNumber column ready')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
