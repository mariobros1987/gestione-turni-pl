require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'checkin'
      ORDER BY ordinal_position
    `;
    console.log('Colonne tabella checkin:', columns);
    process.exit(0);
  } catch (e) {
    console.error('Errore:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
