const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const PRODUCT_TYPES = [
  { name: 'Domain', slug: 'DOMAIN', color: 'blue', hasHostingSpecs: false, sortOrder: 1 },
  { name: 'Hosting', slug: 'HOSTING', color: 'green', hasHostingSpecs: true, sortOrder: 2 },
  { name: 'SSL', slug: 'SSL', color: 'orange', hasHostingSpecs: false, sortOrder: 3 },
  { name: 'Design', slug: 'DESIGN', color: 'pink', hasHostingSpecs: false, sortOrder: 4 },
]

const PACKAGES_BY_SLUG = {
  DOMAIN: [
    { name: 'Registration', description: 'Register a new domain name', priceYearly: 12, setupFee: 0, sortOrder: 1 },
    { name: 'Renew', description: 'Renew an existing domain', priceYearly: 12, setupFee: 0, sortOrder: 2 },
    { name: 'Transfer', description: 'Transfer domain from another registrar', priceYearly: 12, setupFee: 5, sortOrder: 3 },
  ],
  HOSTING: [
    {
      name: 'Basic Plan',
      description: 'Starter hosting for small websites',
      diskSpaceGb: 5, bandwidthGb: 50, emailAccounts: 5, databases: 1, addonDomains: 0,
      priceMonthly: 8, priceQuarterly: 22, priceSemiAnnual: 42, priceYearly: 60, setupFee: 25, sortOrder: 1,
    },
    {
      name: 'Medium Plan',
      description: 'Growing businesses with more traffic',
      diskSpaceGb: 15, bandwidthGb: 150, emailAccounts: 25, databases: 5, addonDomains: 3,
      priceMonthly: 18, priceQuarterly: 50, priceSemiAnnual: 95, priceYearly: 150, setupFee: 25, sortOrder: 2,
    },
    {
      name: 'Premium Plan',
      description: 'High-performance hosting for demanding sites',
      diskSpaceGb: 40, bandwidthGb: 500, emailAccounts: 100, databases: 15, addonDomains: 10,
      priceMonthly: 35, priceQuarterly: 95, priceSemiAnnual: 180, priceYearly: 300, setupFee: 0, sortOrder: 3,
    },
  ],
  SSL: [
    { name: 'Simple SSL', description: 'Standard single-domain SSL certificate', priceYearly: 15, setupFee: 0, sortOrder: 1 },
    { name: 'Wildcard SSL', description: 'Wildcard SSL for all subdomains', priceYearly: 75, setupFee: 10, sortOrder: 2 },
  ],
  DESIGN: [
    { name: 'Basic Website', description: 'Simple brochure-style website', priceYearly: 0, setupFee: 299, sortOrder: 1 },
    { name: 'eCommerce Website', description: 'Online store with payment integration', priceYearly: 0, setupFee: 799, sortOrder: 2 },
  ],
}

async function main() {
  await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      companyName: process.env.COMPANY_NAME || 'Your Company Ltd.',
      companyAddress: process.env.COMPANY_ADDRESS || 'Phnom Penh, Cambodia',
      companyEmail: process.env.COMPANY_EMAIL || 'info@yourdomain.com',
      companyPhone: process.env.COMPANY_PHONE || '+855 12 345 678',
      invoicePrefix: process.env.INVOICE_PREFIX || 'INV-',
    },
  })
  console.log('✓ App settings')

  console.log('Seeding product types...')
  const typeBySlug = {}
  for (const t of PRODUCT_TYPES) {
    const row = await prisma.productType.upsert({
      where: { slug: t.slug },
      update: { name: t.name, color: t.color, hasHostingSpecs: t.hasHostingSpecs, sortOrder: t.sortOrder },
      create: t,
    })
    typeBySlug[t.slug] = row
    console.log(`  ✓ ${row.name}`)
  }

  console.log('Seeding product packages...')
  for (const [slug, packages] of Object.entries(PACKAGES_BY_SLUG)) {
    const productType = typeBySlug[slug]
    for (const pkg of packages) {
      await prisma.productPackage.upsert({
        where: { productTypeId_name: { productTypeId: productType.id, name: pkg.name } },
        update: pkg,
        create: { productTypeId: productType.id, ...pkg },
      })
      console.log(`  ✓ ${slug} — ${pkg.name}`)
    }
  }

  console.log('✅ Product catalog ready')
}

main().catch(console.error).finally(() => prisma.$disconnect())
