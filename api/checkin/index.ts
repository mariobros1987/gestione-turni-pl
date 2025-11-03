import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Singleton Prisma per evitare connessioni multiple
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token mancante' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Token non valido' });
  }

  const userId = (decoded as any).userId;

  // GET: Recupera check-in dell'utente
  if (req.method === 'GET') {
    try {
      const checkIns = await prisma.checkin.findMany({
        where: { user_id: userId },
        orderBy: { timestamp: 'desc' }
      });
      return res.status(200).json({ success: true, checkIns });
    } catch (error) {
      console.error('❌ Errore recupero check-in:', error);
      return res.status(500).json({ success: false, message: 'Errore interno' });
    }
  }

  // POST: Crea check-in
  if (req.method === 'POST') {
    const { type, serialNumber, rawPayload, timestamp } = req.body;
    if (!type || !timestamp) {
      return res.status(400).json({ success: false, message: 'Type e timestamp sono obbligatori' });
    }

    try {
      const checkIn = await prisma.checkin.create({
        data: {
          user_id: userId,
          type,
          serialNumber,
          rawPayload,
          timestamp: new Date(timestamp),
        } as any,
      });
      return res.status(200).json({ success: true, checkIn });
    } catch (error) {
      console.error('❌ Errore salvataggio check-in NFC:', error);
      return res.status(500).json({ success: false, message: 'Errore interno' });
    }
  }

  // DELETE: Cancella check-in di una specifica data
  if (req.method === 'DELETE') {
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Parametro date mancante (YYYY-MM-DD)' });
    }

    try {
      const from = new Date(`${date}T00:00:00.000Z`);
      const to = new Date(`${date}T23:59:59.999Z`);

      const result = await prisma.checkin.deleteMany({
        where: {
          user_id: userId,
          timestamp: {
            gte: from,
            lte: to
          }
        }
      });

      return res.status(200).json({ success: true, deleted: result.count });
    } catch (error) {
      console.error('❌ Errore cancellazione check-in:', error);
      return res.status(500).json({ success: false, message: 'Errore interno' });
    }
  }

  return res.status(405).json({ success: false, message: 'Metodo non supportato' });
}
