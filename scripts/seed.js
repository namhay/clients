const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')
  const hash = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({ where:{email:'admin@clientdesk.com'}, update:{}, create:{name:'Admin',email:'admin@clientdesk.com',password:hash,role:'ADMIN'} })
  const staffHash = await bcrypt.hash('staff123', 10)
  await prisma.user.upsert({ where:{email:'staff@clientdesk.com'}, update:{}, create:{name:'Staff User',email:'staff@clientdesk.com',password:staffHash,role:'STAFF'} })
  console.log('✓ Users: admin@clientdesk.com / admin123')
  const c1 = await prisma.client.create({ data:{name:'Sokha Chea',email:'sokha@example.com',phone:'+855 12 345 678',company:'Sokha Trading',address:'Phnom Penh'} })
  const c2 = await prisma.client.create({ data:{name:'Dara Keo',email:'dara@startup.io',phone:'+855 17 654 321',company:'StartupIO',address:'Siem Reap'} })
  await prisma.service.createMany({ data:[
    {clientId:c1.id,type:'DOMAIN',name:'sokhacorp.com',price:15,setupFee:0,startDate:new Date('2025-01-01'),expiryDate:new Date('2026-07-01'),nextDueDate:new Date('2026-07-01'),recurring:true,period:'YEARLY',status:'ACTIVE'},
    {clientId:c1.id,type:'HOSTING',name:'cPanel Basic',price:60,setupFee:25,startDate:new Date('2025-01-01'),expiryDate:new Date('2026-06-20'),nextDueDate:new Date('2026-06-20'),recurring:true,period:'YEARLY',status:'ACTIVE'},
    {clientId:c2.id,type:'SSL',name:'startup.io SSL',price:25,setupFee:0,startDate:new Date('2025-05-01'),expiryDate:new Date('2026-07-10'),nextDueDate:new Date('2026-07-10'),recurring:true,period:'QUARTERLY',status:'ACTIVE'},
  ]})
  await prisma.invoice.create({ data:{clientId:c1.id,invoiceNo:'INV-0001',subtotal:75,tax:0,total:75,status:'UNPAID',dueDate:new Date('2026-07-15'),notes:'Bank transfer',items:{create:[{description:'Domain sokhacorp.com',quantity:1,unitPrice:15,total:15},{description:'Hosting cPanel Basic',quantity:1,unitPrice:60,total:60}]}} })
  console.log('✓ Sample data created\n✅ Done! Login: admin@clientdesk.com / admin123')
}
main().catch(console.error).finally(()=>prisma.$disconnect())
