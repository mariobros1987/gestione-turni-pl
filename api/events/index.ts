import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Prisma singleton + robust connection with retry
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
  datasources: { db: { url: process.env.DATABASE_URL } },
});
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

async function ensurePrismaConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return false;
}

const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024';

function requireUser(req: VercelRequest): { userId: string } {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  return { userId: decoded.userId };
}

// Helper: pack/unpack extra fields in description JSON
function packDescription(payload: any): string | null {
  if (!payload) return null;
  try { return JSON.stringify(payload); } catch { return null; }
}
function unpackDescription(desc?: string | null): any {
  if (!desc) return {};
  try { return JSON.parse(desc); } catch { return {}; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensurePrismaConnection();
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Errore connessione database' });
  }

  // CORS minimal
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let userId: string;
  try {
    ({ userId } = requireUser(req));
  } catch (e: any) {
    return res.status(e.status || 401).json({ success: false, message: e.message || 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const since = req.query.since as string | undefined;
      const where: any = { userId };
      if (since) {
        const sinceDate = new Date(since);
        if (!isNaN(sinceDate.getTime())) where.updatedAt = { gte: sinceDate };
      }
      const rows = await prisma.event.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
      });
      const data = rows.map((e) => ({
        id: e.id,
        userId: e.userId,
        title: e.title,
        date: e.date.toISOString().split('T')[0],
        type: e.type,
        status: e.status,
        description: e.description,
        extra: unpackDescription(e.description || undefined),
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
      return res.status(200).json({ success: true, events: data });
    } catch (error) {
      console.error('GET /events error', error);
      return res.status(500).json({ success: false, message: 'Errore interno' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { id, title, date, type, status, extra } = body;
      if (!date || !type) return res.status(400).json({ success: false, message: 'Campi obbligatori mancanti (date, type)' });
      const payload = await prisma.event.upsert({
        where: { id: id || '' },
        create: {
          id: id || undefined,
          userId,
          title: title || type,
          date: new Date(`${date}T00:00:00.000Z`),
          type,
          status: status || 'active',
          description: packDescription(extra),
        } as any,
        update: {
          title: title || type,
          date: new Date(`${date}T00:00:00.000Z`),
          type,
          status: status || 'active',
          description: packDescription(extra),
          updatedAt: new Date(),
        },
      });
      return res.status(200).json({ success: true, event: payload });
    } catch (error) {
      console.error('POST /events error', error);
      return res.status(500).json({ success: false, message: 'Errore interno' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      const { id, title, date, type, status, extra } = body;
      if (!id) return res.status(400).json({ success: false, message: 'ID mancante' });
      const payload = await prisma.event.update({
        where: { id },
        data: {
          title: title || undefined,
          date: date ? new Date(`${date}T00:00:00.000Z`) : undefined,
          type: type || undefined,
          status: status || undefined,
          description: extra !== undefined ? packDescription(extra) : undefined,
          updatedAt: new Date(),
        },
      });
      return res.status(200).json({ success: true, event: payload });
    } catch (error) {
      console.error('PUT /events error', error);
      return res.status(500).json({ success: false, message: 'Errore interno' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const id = (req.query.id as string) || (req.body && req.body.id);
      if (!id) return res.status(400).json({ success: false, message: 'ID mancante' });
      await prisma.event.delete({ where: { id } });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('DELETE /events error', error);
      return res.status(500).json({ success: false, message: 'Errore interno' });
    }
  }

  return res.status(405).json({ success: false, message: 'Metodo non supportato' });
}
