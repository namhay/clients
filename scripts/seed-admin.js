const { neon } = require('@neondatabase/serverless')
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')

const sql = neon(process.env.DATABASE_URL)

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

  const email = process.env.ADMIN_EMAIL || 'admin@it-smart.biz'
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const hash = await bcrypt.hash(password, 10)

  const now = new Date()
  const existing = await sql`SELECT id FROM "User" WHERE email = ${email} LIMIT 1`
  if (existing[0]) {
    await sql`
      UPDATE "User"
      SET password = ${hash}, "updatedAt" = ${now}
      WHERE email = ${email}
    `
    console.log(`✓ Admin password reset: ${email}`)
  } else {
    await sql`
      INSERT INTO "User" (id, name, email, password, role, "createdAt", "updatedAt")
      VALUES (${randomUUID()}, 'Admin', ${email}, ${hash}, 'ADMIN', ${now}, ${now})
    `
    console.log(`✓ Admin user created: ${email}`)
  }
  if (!process.env.ADMIN_PASSWORD) {
    console.log('  Default password: admin123 (set ADMIN_PASSWORD to override)')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
