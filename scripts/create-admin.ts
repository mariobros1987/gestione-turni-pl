import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = 'admin123';
  const passwordHash = await hash(password, 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@localhost',
      name: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      badgeNumber: 'ADMIN001',
      department: 'Comando',
      rank: 'Comandante',
      phoneNumber: '0000000000',
      passwordHash,
      isActive: true,
      isVerified: true
    }
  });
  console.log('Utente admin creato:', admin.email, 'password:', password);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
