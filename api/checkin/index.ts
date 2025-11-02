import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo non supportato' });
  }

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
  const { type, serialNumber, rawPayload, timestamp } = req.body;
  if (!type || !timestamp) {
    return res.status(400).json({ success: false, message: 'Type e timestamp sono obbligatori' });
  }

  try {
    const checkIn = await prisma.checkIn.create({
      data: {
        userId,
        type,
        serialNumber,
        rawPayload,
        timestamp: new Date(timestamp),
      },
    });
    return res.status(200).json({ success: true, checkIn });
  } catch (error) {
    console.error('❌ Errore salvataggio check-in NFC:', error);
    return res.status(500).json({ success: false, message: 'Errore interno' });
  }
}
