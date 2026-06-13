/**
 * Apply incremental SQL migrations to Neon PostgreSQL.
 * Run: npm run db:migrate
 */
const { neon } = require('@neondatabase/serverless')
const { loadEnv } = require('./load-env')
const { hasColumn } = require('./db-utils')

loadEnv()

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
  await sql`
    ALTER TABLE "AppSettings"
    ADD COLUMN IF NOT EXISTS "dateFormat" TEXT NOT NULL DEFAULT 'DD_MMM_YYYY'
  `

  console.log('✓ AppSettings reminder schedule columns ready')
  console.log('✓ ProductType reminderTiming column ready')
  console.log('✓ AppSettings invoiceStartNumber column ready')
  console.log('✓ AppSettings dateFormat column ready')

  await sql`
    CREATE TABLE IF NOT EXISTS "Order" (
      id TEXT PRIMARY KEY,
      "clientId" TEXT NOT NULL REFERENCES "Client"(id),
      "invoiceId" TEXT REFERENCES "Invoice"(id),
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      notes TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "OrderItem" (
      id TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
      "serviceId" TEXT REFERENCES "Service"(id),
      "productTypeId" TEXT NOT NULL REFERENCES "ProductType"(id),
      "productPackageId" TEXT REFERENCES "ProductPackage"(id),
      name TEXT NOT NULL,
      price DOUBLE PRECISION NOT NULL DEFAULT 0,
      "startDate" TIMESTAMPTZ NOT NULL,
      "expiryDate" TIMESTAMPTZ NOT NULL,
      "nextDueDate" TIMESTAMPTZ,
      recurring BOOLEAN NOT NULL DEFAULT true,
      period TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  console.log('✓ Order and OrderItem tables ready')

  await sql`
    ALTER TABLE "OrderItem"
    DROP CONSTRAINT IF EXISTS "OrderItem_serviceId_fkey"
  `
  await sql`
    ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"(id) ON DELETE SET NULL
  `

  console.log('✓ OrderItem serviceId ON DELETE SET NULL ready')

  await sql`
    ALTER TABLE "ProductPackage"
    ADD COLUMN IF NOT EXISTS "billingType" TEXT NOT NULL DEFAULT 'RECURRING'
  `

  console.log('✓ ProductPackage billingType column ready')

  await sql`
    ALTER TABLE "InvoiceItem"
    ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMPTZ
  `
  await sql`
    ALTER TABLE "InvoiceItem"
    ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMPTZ
  `

  console.log('✓ InvoiceItem period columns ready')

  await sql`
    CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "tokenHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "usedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_idx"
    ON "PasswordResetToken" ("tokenHash")
  `

  console.log('✓ PasswordResetToken table ready')

  await sql`
    ALTER TABLE "Client"
    ADD COLUMN IF NOT EXISTS "companyKhmer" TEXT
  `

  console.log('✓ Client companyKhmer column ready')

  await sql`
    ALTER TABLE "Client"
    ADD COLUMN IF NOT EXISTS "renewalDaysBeforeExpiry" INTEGER NOT NULL DEFAULT 14
  `

  console.log('✓ Client renewalDaysBeforeExpiry column ready')

  await sql`
    CREATE TABLE IF NOT EXISTS "BrandingAsset" (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  console.log('✓ BrandingAsset table ready')

  await sql`
    ALTER TABLE "BrandingAsset"
    ADD COLUMN IF NOT EXISTS "pdfData" TEXT
  `
  await sql`
    ALTER TABLE "BrandingAsset"
    ADD COLUMN IF NOT EXISTS "pdfMimeType" TEXT
  `

  console.log('✓ BrandingAsset pdfData columns ready')

  await sql`
    CREATE TABLE IF NOT EXISTS "InvoicePayment" (
      id TEXT PRIMARY KEY,
      "invoiceId" TEXT NOT NULL REFERENCES "Invoice"(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL,
      "paymentMethod" TEXT NOT NULL,
      "paidAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS "InvoicePayment_invoiceId_idx"
    ON "InvoicePayment" ("invoiceId")
  `
  await sql`
    CREATE INDEX IF NOT EXISTS "InvoicePayment_paidAt_idx"
    ON "InvoicePayment" ("paidAt")
  `

  console.log('✓ InvoicePayment table ready')

  await sql`
    ALTER TABLE "ProductPackage"
    DROP COLUMN IF EXISTS description
  `
  await sql`
    ALTER TABLE "ProductPackage"
    DROP COLUMN IF EXISTS "setupFee"
  `
  await sql`
    ALTER TABLE "OrderItem"
    DROP COLUMN IF EXISTS "setupFee"
  `

  console.log('✓ ProductPackage description/setupFee columns removed')
  console.log('✓ OrderItem setupFee column removed')

  if (await hasColumn(sql, 'Service', 'nextDueDate')) {
    await sql`
      UPDATE "Service"
      SET "expiryDate" = COALESCE("nextDueDate", "expiryDate")
      WHERE "nextDueDate" IS NOT NULL
    `
    await sql`ALTER TABLE "Service" DROP COLUMN "nextDueDate"`
    console.log('✓ Service nextDueDate migrated to expiryDate and column removed')
  } else {
    console.log('✓ Service nextDueDate column already removed')
  }

  await sql`
    ALTER TABLE "OrderItem"
    DROP COLUMN IF EXISTS "nextDueDate"
  `
  await sql`
    ALTER TABLE "ProductType"
    DROP COLUMN IF EXISTS "reminderDaysBeforeExpiry"
  `
  await sql`
    ALTER TABLE "ProductType"
    DROP COLUMN IF EXISTS "reminderTiming"
  `
  await sql`
    ALTER TABLE "ProductType"
    DROP COLUMN IF EXISTS "autoInvoiceDaysBeforeExpiry"
  `
  await sql`
    ALTER TABLE "Invoice"
    DROP COLUMN IF EXISTS tax
  `
  await sql`
    ALTER TABLE "Service"
    DROP COLUMN IF EXISTS "setupFee"
  `
  await sql`
    ALTER TABLE "Service"
    DROP COLUMN IF EXISTS notes
  `

  console.log('✓ OrderItem nextDueDate column removed')
  console.log('✓ ProductType reminder columns removed')
  console.log('✓ Invoice tax column removed')
  console.log('✓ Service setupFee and notes columns removed')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
