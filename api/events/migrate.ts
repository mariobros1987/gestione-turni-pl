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

// Helper: pack extra fields in description JSON
function packDescription(payload: any): string | null {
  if (!payload) return null;
  try { return JSON.stringify(payload); } catch { return null; }
}

// Map local event types to payload
function mapEventToPayload(entry: any, userId: string) {
  const base = {
    userId,
    date: new Date(`${entry.date}T00:00:00.000Z`),
    status: 'active',
  };

  switch (entry.type) {
    case 'ferie':
      return {
        ...base,
        title: 'Ferie',
        type: 'ferie',
        description: packDescription({ value: entry.value, notes: entry.notes }),
      };
    case 'permessi':
      return {
        ...base,
        title: 'Permesso',
        type: 'permessi',
        description: packDescription({
          value: entry.value,
          startTime: entry.startTime,
          endTime: entry.endTime,
          category: entry.category,
          notes: entry.notes,
        }),
      };
    case 'straordinario':
      return {
        ...base,
        title: 'Straordinario',
        type: 'straordinario',
        description: packDescription({
          value: entry.value,
          startTime: entry.startTime,
          endTime: entry.endTime,
          timeSlot: entry.timeSlot,
          destination: entry.destination,
          notes: entry.notes,
        }),
      };
    case 'reperibilita':
      return {
        ...base,
        title: 'Reperibilità',
        type: 'reperibilita',
        description: packDescription({
          value: entry.value,
          startTime: entry.startTime,
          endTime: entry.endTime,
          onCallType: entry.onCallType,
          notes: entry.notes,
        }),
      };
    case 'progetto':
      return {
        ...base,
        title: 'Progetto',
        type: 'progetto',
        description: packDescription({
          value: entry.value,
          startTime: entry.startTime,
          endTime: entry.endTime,
          notes: entry.notes,
        }),
      };
    case 'appuntamento':
      // Skip "Presenza" appointments (derived from check-ins)
      if (entry.title === 'Presenza') return null;
      return {
        ...base,
        title: entry.title,
        type: 'appuntamento',
        description: packDescription({
          startTime: entry.startTime,
          endTime: entry.endTime,
          value: entry.value,
          notes: entry.notes,
        }),
      };
    default:
      return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensurePrismaConnection();
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Errore connessione database' });
  }

  // CORS minimal
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let userId: string;
  try {
    ({ userId } = requireUser(req));
  } catch (e: any) {
    return res.status(e.status || 401).json({ success: false, message: e.message || 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo non supportato' });
  }

  try {
    const body = req.body || {};
    const { dryRun = false, profileName } = body;

    if (!profileName) {
      return res.status(400).json({ success: false, message: 'profileName obbligatorio' });
    }

    // 1. Recupera il profilo dal database
    const profile = await prisma.profile.findUnique({
      where: {
        userId_name: {
          userId,
          name: profileName,
        },
      },
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profilo non trovato' });
    }

    const profileData = profile.data as any;

    // 2. Estrai tutti gli eventi dal blob
    const eventsInBlob = [
      ...(profileData.holidays || []),
      ...(profileData.permits || []),
      ...(profileData.overtime || []),
      ...(profileData.onCall || []),
      ...(profileData.projects || []),
      ...(profileData.appointments || []),
    ].filter((e: any) => e && e.type);

    console.log(`📊 Trovati ${eventsInBlob.length} eventi nel profilo blob`);

    // 3. Controlla se ci sono già eventi in /api/events per questo utente
    const existingEvents = await prisma.event.findMany({
      where: { userId },
    });

    if (existingEvents.length > 0 && !body.force) {
      return res.status(409).json({
        success: false,
        message: `Trovati ${existingEvents.length} eventi già presenti. Usa force=true per sovrascrivere.`,
        existingCount: existingEvents.length,
        blobCount: eventsInBlob.length,
      });
    }

    // 4. Mappa gli eventi
    const mappedEvents = eventsInBlob
      .map((entry: any) => mapEventToPayload(entry, userId))
      .filter((e: any) => e !== null) as any[];

    console.log(`✅ Mappati ${mappedEvents.length} eventi (escluse presenze)`);

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        message: 'Simulazione completata (nessuna modifica effettuata)',
        stats: {
          totalInBlob: eventsInBlob.length,
          toMigrate: mappedEvents.length,
          skipped: eventsInBlob.length - mappedEvents.length,
          existingInDb: existingEvents.length,
        },
        sample: mappedEvents.slice(0, 5), // Mostra primi 5 per preview
      });
    }

    // 5. Migrazione transazionale
    const result = await prisma.$transaction(async (tx) => {
      // 5a. Backup: salva eventi esistenti (se presenti)
      let deletedCount = 0;
      if (existingEvents.length > 0) {
        const deleted = await tx.event.deleteMany({
          where: { userId },
        });
        deletedCount = deleted.count;
        console.log(`🗑️ Eliminati ${deletedCount} eventi esistenti`);
      }

      // 5b. Inserisci nuovi eventi
      const created = await tx.event.createMany({
        data: mappedEvents,
        skipDuplicates: true,
      });

      console.log(`✅ Creati ${created.count} nuovi eventi`);

      // 5c. Aggiorna il profilo rimuovendo gli eventi dal blob
      const { holidays, permits, overtime, onCall, projects, appointments, ...profileMetadata } = profileData;
      
      await tx.profile.update({
        where: {
          userId_name: {
            userId,
            name: profileName,
          },
        },
        data: {
          data: {
            ...profileMetadata,
            // Mantieni array vuoti per compatibilità UI
            holidays: [],
            permits: [],
            overtime: [],
            onCall: [],
            projects: [],
            appointments: [],
          },
        },
      });

      return {
        deletedCount,
        createdCount: created.count,
        blobEvents: eventsInBlob.length,
        migratedEvents: mappedEvents.length,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Migrazione completata con successo',
      stats: result,
    });
  } catch (error) {
    console.error('❌ Errore migrazione:', error);
    return res.status(500).json({
      success: false,
      message: 'Errore durante la migrazione',
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    });
  }
}
