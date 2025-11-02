import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Metodo non supportato'
    });
  }

  // Autenticazione tramite Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token mancante o non valido'
    });
  }
  const token = authHeader.replace('Bearer ', '');
  let decoded;
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024';
    decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (!decoded || !decoded.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Permesso negato'
      });
    }
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      message: 'Token non valido'
    });
  }

  try {
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
    return res.status(200).json({
      success: true,
      users,
      count: users.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Errore nel recupero utenti:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore interno',
      error: error?.message || String(error)
    });
  }
}
