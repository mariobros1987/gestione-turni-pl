import dotenv from 'dotenv'
dotenv.config({ override: true })

// Temporary bootstrap shim: reuse the Express app preserved under src/server.backup.
import { app } from './src/server.backup/app'
import { prisma } from './src/lib/prisma'

const PORT = process.env.API_PORT || 3001
const server = app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`)
})

const shutdown = async () => {
  await prisma.$disconnect()
  server.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
