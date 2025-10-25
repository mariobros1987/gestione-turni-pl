import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Permetti solo in sviluppo (NON in produzione)
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Endpoint di debug non disponibile in produzione'
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Metodo non supportato'
    });
  }

  try {
    // Recupera tutti gli utenti (senza password hash per sicurezza)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        badgeNumber: true,
        department: true,
        rank: true,
        phoneNumber: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            shifts: true,
            events: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Compatibilità con frontend: users invece di data
    return res.status(200).json({
      success: true,
      users,
      count: users.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Errore nel recupero degli utenti:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore interno del server',
      timestamp: new Date().toISOString()
    });
  }
}