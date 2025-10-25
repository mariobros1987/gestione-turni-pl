import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

// Configurazione Prisma per serverless con connection pooling
const prisma = global.prisma || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['error']
})

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Metodo non supportato' 
    })
  }

  try {
    // Debug info
    const dbUrl = process.env.DATABASE_URL
    console.log('DATABASE_URL exists:', !!dbUrl)
    console.log('DATABASE_URL starts with:', dbUrl?.substring(0, 20))

    // Test solo connessione
    await prisma.$connect()
    console.log('Prisma connected successfully')

    return res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        url_configured: !!process.env.DATABASE_URL
      },
      api: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    })

  } catch (error: any) {
    console.error('Health check failed:', error)

    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      details: {
        message: error.message,
        code: error.code,
        url_configured: !!process.env.DATABASE_URL
      }
    })
  } finally {
    // Disconnetti in ambiente serverless
    if (process.env.NODE_ENV !== 'development') {
      await prisma.$disconnect()
    }
  }
}