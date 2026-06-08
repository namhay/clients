const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@it-smart.biz'
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const hash = await bcrypt.hash(password, 10)

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Admin', email, password: hash, role: 'ADMIN' },
  })

  console.log(`✓ Admin user: ${email}`)
  if (!process.env.ADMIN_PASSWORD) {
    console.log('  Default password: admin123 (set ADMIN_PASSWORD to override)')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
