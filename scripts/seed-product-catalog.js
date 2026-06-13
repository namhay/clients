const { neon } = require('@neondatabase/serverless')
const { randomUUID } = require('crypto')

const sql = neon(process.env.DATABASE_URL)

const PRODUCT_TYPES = [
  { name: 'Domain', slug: 'DOMAIN', color: 'blue', hasHostingSpecs: false, sortOrder: 1, reminderDaysBeforeExpiry: 14, reminderTiming: 'BEFORE', autoInvoiceDaysBeforeExpiry: 14 },
  { name: 'Hosting', slug: 'HOSTING', color: 'green', hasHostingSpecs: true, sortOrder: 2, reminderDaysBeforeExpiry: 14, reminderTiming: 'BEFORE', autoInvoiceDaysBeforeExpiry: 14 },
  { name: 'SSL', slug: 'SSL', color: 'orange', hasHostingSpecs: false, sortOrder: 3, reminderDaysBeforeExpiry: 14, reminderTiming: 'BEFORE', autoInvoiceDaysBeforeExpiry: 14 },
  { name: 'Design', slug: 'DESIGN', color: 'pink', hasHostingSpecs: false, sortOrder: 4, reminderDaysBeforeExpiry: 14, reminderTiming: 'BEFORE', autoInvoiceDaysBeforeExpiry: 14 },
]

const PACKAGES_BY_SLUG = {
  DOMAIN: [
    { name: 'Registration', priceYearly: 12, sortOrder: 1 },
    { name: 'Renew', priceYearly: 12, sortOrder: 2 },
    { name: 'Transfer', priceYearly: 12, sortOrder: 3 },
  ],
  HOSTING: [
    {
      name: 'Basic Plan',
      diskSpaceGb: 5, bandwidthGb: 50, emailAccounts: 5, databases: 1, addonDomains: 0,
      priceMonthly: 8, priceQuarterly: 22, priceSemiAnnual: 42, priceYearly: 60, sortOrder: 1,
    },
    {
      name: 'Medium Plan',
      diskSpaceGb: 15, bandwidthGb: 150, emailAccounts: 25, databases: 5, addonDomains: 3,
      priceMonthly: 18, priceQuarterly: 50, priceSemiAnnual: 95, priceYearly: 150, sortOrder: 2,
    },
    {
      name: 'Premium Plan',
      diskSpaceGb: 40, bandwidthGb: 500, emailAccounts: 100, databases: 15, addonDomains: 10,
      priceMonthly: 35, priceQuarterly: 95, priceSemiAnnual: 180, priceYearly: 300, sortOrder: 3,
    },
  ],
  SSL: [
    { name: 'Simple SSL', priceYearly: 15, sortOrder: 1 },
    { name: 'Wildcard SSL', priceYearly: 75, sortOrder: 2 },
  ],
  DESIGN: [
    { name: 'Basic Website', billingType: 'ONE_TIME', priceYearly: 299, sortOrder: 1 },
    { name: 'eCommerce Website', billingType: 'ONE_TIME', priceYearly: 799, sortOrder: 2 },
  ],
}

async function upsertAppSettings() {
  const now = new Date()
  await sql`
    INSERT INTO "AppSettings" (
      id, "companyName", "companyAddress", "companyEmail", "companyPhone",
      "invoicePrefix", "reminderDays", "smtpHost", "smtpPort", "smtpSecure",
      "smtpUser", "smtpPass", "smtpFrom", "telegramBotToken", "telegramDefaultChatId",
      "updatedAt"
    ) VALUES (
      'default',
      ${process.env.COMPANY_NAME || 'Your Company Ltd.'},
      ${process.env.COMPANY_ADDRESS || 'Phnom Penh, Cambodia'},
      ${process.env.COMPANY_EMAIL || 'info@yourdomain.com'},
      ${process.env.COMPANY_PHONE || '+855 12 345 678'},
      ${process.env.INVOICE_PREFIX || 'INV-'},
      7, '', 465, true, '', '', '', '', '',
      ${now}
    )
    ON CONFLICT (id) DO NOTHING
  `
  console.log('✓ App settings')
}

async function upsertProductType(t) {
  const now = new Date()
  const existing = await sql`SELECT id FROM "ProductType" WHERE slug = ${t.slug} LIMIT 1`
  if (existing[0]) {
    await sql`
      UPDATE "ProductType" SET
        name = ${t.name},
        color = ${t.color},
        "hasHostingSpecs" = ${t.hasHostingSpecs},
        "sortOrder" = ${t.sortOrder},
        "reminderDaysBeforeExpiry" = ${t.reminderDaysBeforeExpiry},
        "reminderTiming" = ${t.reminderTiming || 'BEFORE'},
        "autoInvoiceDaysBeforeExpiry" = ${t.autoInvoiceDaysBeforeExpiry},
        "updatedAt" = ${now}
      WHERE slug = ${t.slug}
    `
    return { id: existing[0].id, name: t.name }
  }
  const id = randomUUID()
  await sql`
    INSERT INTO "ProductType" (
      id, name, slug, color, "hasHostingSpecs", active, "sortOrder",
      "reminderDaysBeforeExpiry", "reminderTiming", "autoInvoiceDaysBeforeExpiry", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${t.name}, ${t.slug}, ${t.color}, ${t.hasHostingSpecs}, true,
      ${t.sortOrder}, ${t.reminderDaysBeforeExpiry}, ${t.reminderTiming || 'BEFORE'}, ${t.autoInvoiceDaysBeforeExpiry},
      ${now}, ${now}
    )
  `
  return { id, name: t.name }
}

async function upsertProductPackage(productTypeId, pkg) {
  const now = new Date()
  const existing = await sql`
    SELECT id FROM "ProductPackage"
    WHERE "productTypeId" = ${productTypeId} AND name = ${pkg.name}
    LIMIT 1
  `
  const billingType = String(pkg.billingType || 'RECURRING').toUpperCase() === 'ONE_TIME' ? 'ONE_TIME' : 'RECURRING'
  const values = {
    diskSpaceGb: pkg.diskSpaceGb ?? null,
    bandwidthGb: pkg.bandwidthGb ?? null,
    emailAccounts: pkg.emailAccounts ?? null,
    databases: pkg.databases ?? null,
    addonDomains: pkg.addonDomains ?? null,
    billingType,
    priceMonthly: billingType === 'ONE_TIME' ? 0 : (pkg.priceMonthly ?? 0),
    priceQuarterly: billingType === 'ONE_TIME' ? 0 : (pkg.priceQuarterly ?? 0),
    priceSemiAnnual: billingType === 'ONE_TIME' ? 0 : (pkg.priceSemiAnnual ?? 0),
    priceYearly: pkg.priceYearly ?? 0,
    sortOrder: pkg.sortOrder ?? 0,
  }
  if (existing[0]) {
    await sql`
      UPDATE "ProductPackage" SET
        "diskSpaceGb" = ${values.diskSpaceGb},
        "bandwidthGb" = ${values.bandwidthGb},
        "emailAccounts" = ${values.emailAccounts},
        databases = ${values.databases},
        "addonDomains" = ${values.addonDomains},
        "billingType" = ${values.billingType},
        "priceMonthly" = ${values.priceMonthly},
        "priceQuarterly" = ${values.priceQuarterly},
        "priceSemiAnnual" = ${values.priceSemiAnnual},
        "priceYearly" = ${values.priceYearly},
        "sortOrder" = ${values.sortOrder},
        "updatedAt" = ${now}
      WHERE id = ${existing[0].id}
    `
    return
  }
  await sql`
    INSERT INTO "ProductPackage" (
      id, "productTypeId", name,
      "diskSpaceGb", "bandwidthGb", "emailAccounts", databases, "addonDomains",
      "billingType", "priceMonthly", "priceQuarterly", "priceSemiAnnual", "priceYearly",
      active, "sortOrder", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${productTypeId}, ${pkg.name},
      ${values.diskSpaceGb}, ${values.bandwidthGb}, ${values.emailAccounts}, ${values.databases}, ${values.addonDomains},
      ${values.billingType}, ${values.priceMonthly}, ${values.priceQuarterly}, ${values.priceSemiAnnual}, ${values.priceYearly},
      true, ${values.sortOrder}, ${now}, ${now}
    )
  `
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

  await upsertAppSettings()

  console.log('Seeding product types...')
  const typeBySlug = {}
  for (const t of PRODUCT_TYPES) {
    const row = await upsertProductType(t)
    typeBySlug[t.slug] = row
    console.log(`  ✓ ${row.name}`)
  }

  console.log('Seeding product packages...')
  for (const [slug, packages] of Object.entries(PACKAGES_BY_SLUG)) {
    const productType = typeBySlug[slug]
    for (const pkg of packages) {
      await upsertProductPackage(productType.id, pkg)
      console.log(`  ✓ ${slug} — ${pkg.name}`)
    }
  }

  console.log('✅ Product catalog ready')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
