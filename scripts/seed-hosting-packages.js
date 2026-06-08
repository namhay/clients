const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const PACKAGES = [
  {
    name: 'Basic Plan',
    description: 'Starter hosting for small websites',
    diskSpaceGb: 5,
    bandwidthGb: 50,
    emailAccounts: 5,
    databases: 1,
    addonDomains: 0,
    priceMonthly: 8,
    priceQuarterly: 22,
    priceSemiAnnual: 42,
    priceYearly: 60,
    setupFee: 25,
    sortOrder: 1,
  },
  {
    name: 'Medium Plan',
    description: 'Growing businesses with more traffic',
    diskSpaceGb: 15,
    bandwidthGb: 150,
    emailAccounts: 25,
    databases: 5,
    addonDomains: 3,
    priceMonthly: 18,
    priceQuarterly: 50,
    priceSemiAnnual: 95,
    priceYearly: 150,
    setupFee: 25,
    sortOrder: 2,
  },
  {
    name: 'Premium Plan',
    description: 'High-performance hosting for demanding sites',
    diskSpaceGb: 40,
    bandwidthGb: 500,
    emailAccounts: 100,
    databases: 15,
    addonDomains: 10,
    priceMonthly: 35,
    priceQuarterly: 95,
    priceSemiAnnual: 180,
    priceYearly: 300,
    setupFee: 0,
    sortOrder: 3,
  },
]

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

  console.log('Seeding hosting packages...')
  for (const pkg of PACKAGES) {
    await prisma.hostingPackage.upsert({
      where: { name: pkg.name },
      update: pkg,
      create: pkg,
    })
    console.log(`  ✓ ${pkg.name}`)
  }

  const basic = await prisma.hostingPackage.findUnique({ where: { name: 'Basic Plan' } })
  if (basic) {
    const updated = await prisma.service.updateMany({
      where: { type: 'HOSTING', hostingPackageId: null },
      data: { hostingPackageId: basic.id },
    })
    if (updated.count > 0) {
      console.log(`  ✓ Linked ${updated.count} existing hosting service(s) to Basic Plan`)
    }
  }

  console.log('✅ Hosting packages ready')
}

main().catch(console.error).finally(() => prisma.$disconnect())
