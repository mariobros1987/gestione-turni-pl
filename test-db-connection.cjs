// Test connessione database
const { PrismaClient } = require('@prisma/client')


require('dotenv').config();
const DATABASE_URL = process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  },
  log: ['query', 'info', 'warn', 'error']
})

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...')
    console.log('📍 URL:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'))
    
    // Test connessione
    await prisma.$connect()
    console.log('✅ Prisma connected successfully!')
    
    // Test query
    const userCount = await prisma.user.count()
    console.log(`✅ User count: ${userCount}`)
    
    // Lista primi 5 utenti
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    })
    console.log('✅ Sample users:', users)
    
    console.log('\n🎉 Database connection test PASSED!')
    
  } catch (error) {
    console.error('❌ Database connection test FAILED!')
    console.error('Error:', error.message)
    console.error('Code:', error.code)
    console.error('Full error:', error)
  } finally {
    await prisma.$disconnect()
    console.log('🔌 Disconnected from database')
  }
}

testConnection()
