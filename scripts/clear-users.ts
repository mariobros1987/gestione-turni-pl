import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Elimina tutte le tabelle collegate a User (cascade)
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  console.log('Tutti gli account e dati collegati sono stati eliminati.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
