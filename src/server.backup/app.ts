// ...existing code...
// --- ROUTE CHECK-IN NFC/TAG ---
// Registra una presenza (entrata/uscita) tramite tag/NFC
// ...existing code...
// --- ROUTE PROFILO COMPATIBILI FRONTEND ---
// Tutto il blocco funzioni e route DOPO la dichiarazione di app, i middleware e tutte le altre route, subito prima di app.listen


import cors from 'cors';
import express, { Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, validateEmail, validatePassword } from '../lib/auth-utils';
import { createClient } from '@supabase/supabase-js';


const app = express();
app.use(express.json());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  if (req.body && typeof req.body === 'object' && 'token' in req.body) return req.body.token;
  if (req.query && typeof req.query === 'object' && 'token' in req.query) return req.query.token as string;
  return undefined;
}

function verifyJWT(req: Request): { decoded?: JwtPayload, error?: string } {
  const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024';
  const token = extractToken(req);
  if (!token) return { error: 'Token mancante' };
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return { decoded };
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err) {
      const name = (err as any).name;
      return { error: name === 'TokenExpiredError' ? 'Token scaduto' : 'Token non valido' };
    }
    return { error: 'Token non valido' };
  }
}

// ...existing code...
// Route per verifica JWT (come su Vercel)
app.post('/api/auth/verify', async (req, res) => {
  try {
    console.log('Ricevuta richiesta /api/auth/verify');
    console.log('req.body:', req.body);
    const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024';
    if (!JWT_SECRET) {
      console.error('JWT_SECRET non configurato');
      return res.status(500).json({ success: false, message: 'JWT_SECRET non configurato' });
    }
    let token;
    if (req.body && typeof req.body === 'object') {
      token = req.body.token;
    } else {
      token = undefined;
    }
    const cookieToken = req.cookies?.auth_token;
    const tokenToVerify = token || cookieToken;
    if (!tokenToVerify) {
      console.warn('Token mancante. req.body:', req.body, 'req.cookies:', req.cookies);
      return res.status(401).json({
        success: false,
        message: 'Token di autenticazione mancante'
      });
    }
    let decoded: any;
    try {
      decoded = jwt.verify(tokenToVerify, JWT_SECRET);
    } catch (err) {
      const error = err as any;
      console.warn('Errore verifica JWT:', error);
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Token non valido' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token scaduto' });
      }
      return res.status(500).json({ success: false, message: 'Errore interno del server', error: error.message });
    }
    // Supporta sia id che userId nel payload
    let userId: string | undefined;
    if (typeof decoded === 'object' && decoded !== null) {
      userId = (decoded as any).id || (decoded as any).userId;
    }
    if (!userId) {
      console.warn('userId mancante nel payload JWT:', decoded);
      return res.status(401).json({ success: false, message: 'Token non valido (manca userId)' });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        lastLogin: true
      }
    });
    if (!user) {
      console.warn('Utente non trovato per userId:', userId);
      return res.status(401).json({ success: false, message: 'Utente non trovato' });
    }
    if (!user.isActive) {
      console.warn('Account disattivato per userId:', userId);
      return res.status(403).json({ success: false, message: 'Account disattivato' });
    }
    return res.status(200).json({ success: true, user, message: 'Token valido' });
  } catch (error) {
    console.error('Errore durante la verifica del token:', error);
    return res.status(500).json({ success: false, message: 'Errore interno del server', error: (error instanceof Error ? error.message : String(error)) });
  }
});



// Nuova route compatibile con frontend
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})


app.get('/api/users', async (req, res) => {
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
        lastLogin: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, users, count: users.length, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Errore interno del server', timestamp: new Date().toISOString() });
  }
});


// --- CHECK-IN (locale) ---
// Replica dell'endpoint serverless /api/checkin per lo sviluppo locale
app.post('/api/checkin', async (req: Request, res: Response) => {
  try {
    console.log('[local] POST /api/checkin received');
    // Verifica JWT ed estrae userId
    const { decoded, error } = verifyJWT(req);
    if (error) return res.status(401).json({ success: false, message: error });
    const userId = (decoded && (decoded as any).userId) || (decoded && (decoded as any).id);
    if (!userId) return res.status(401).json({ success: false, message: 'Token non valido (manca userId)' });

    const { type, timestamp, serialNumber } = (req.body || {}) as {
      type?: string;
      timestamp?: string;
      serialNumber?: string | null;
    };
    if (!type || !['entrata', 'uscita'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipo di check-in non valido' });
    }

    // Inserimento via Prisma (affidabile in locale, evita dipendenza da chiave service role)
    console.log('[checkin] Creating with userId:', userId, 'type:', type);
    const created = await prisma.checkin.create({
      data: ({
        userId: String(userId),
        type: type,
        timestamp: new Date(timestamp || new Date().toISOString()),
        serialNumber: serialNumber || null,
        rawPayload: null
      } as any)
    });

    return res.status(200).json({ success: true, checkIn: created });
  } catch (err) {
    const msg = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
    return res.status(500).json({ success: false, message: 'Local checkin error', error: msg });
  }
});


// Lista check-in dell'utente corrente (locale)
app.get('/api/checkin', async (req: Request, res: Response) => {
  try {
    const { decoded, error } = verifyJWT(req);
    if (error) return res.status(401).json({ success: false, message: error });
    const userId = (decoded && (decoded as any).userId) || (decoded && (decoded as any).id);
    if (!userId) return res.status(401).json({ success: false, message: 'Token non valido (manca userId)' });

    const checkIns = await prisma.checkin.findMany({
      where: ({ userId: String(userId) } as any),
      orderBy: { timestamp: 'asc' }
    });

    return res.status(200).json({ success: true, checkIns });
  } catch (err) {
    const msg = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
    return res.status(500).json({ success: false, message: 'Errore recupero check-in', error: msg });
  }
});

// Cancella i check-in della giornata (locale)
console.log('[routes] registering DELETE /api/checkin');
app.delete('/api/checkin', async (req: Request, res: Response) => {
  try {
    const { decoded, error } = verifyJWT(req);
    if (error) return res.status(401).json({ success: false, message: error });
    const userId = (decoded && (decoded as any).userId) || (decoded && (decoded as any).id);
    if (!userId) return res.status(401).json({ success: false, message: 'Token non valido (manca userId)' });

    let body: any = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const date = (req.query?.date as string) || body?.date;
    if (!date) return res.status(400).json({ success: false, message: 'Parametro date mancante (YYYY-MM-DD)' });

    const from = new Date(`${date}T00:00:00.000Z`);
    const to = new Date(`${date}T23:59:59.999Z`);

    const result = await prisma.checkin.deleteMany({
      where: ({ userId: String(userId), timestamp: { gte: from, lte: to } } as any)
    });
    return res.status(200).json({ success: true, deleted: result.count });
  } catch (err) {
    const msg = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
    return res.status(500).json({ success: false, message: 'Errore cancellazione check-in', error: msg });
  }
});


// ...existing code...

// Nuova route compatibile con frontend
app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      badgeNumber,
      department,
      rank,
      phoneNumber
    } = req.body

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email non valida'
      })
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password non valida:\n' + passwordValidation.errors.join('\n')
      })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Le password non coincidono'
      })
    }

    if (!firstName?.trim() || !lastName?.trim() || !badgeNumber?.trim() || !department?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tutti i campi obbligatori devono essere compilati'
      })
    }

    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUserByEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email già registrata'
      })
    }


    const existingUserByBadge = await prisma.user.findUnique({
      where: { badgeNumber: badgeNumber.trim() }
    })
    if (existingUserByBadge) {
      return res.status(409).json({
        success: false,
        message: 'Numero di matricola già registrato'
      })
    }

    const passwordHash = await hashPassword(password)

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        badgeNumber: badgeNumber.trim(),
        department: department.trim(),
        rank: rank?.trim() || null,
        phoneNumber: phoneNumber?.trim() || null,
        passwordHash,
        isActive: true,
        isVerified: false
      },
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
        createdAt: true
      }
    })

    res.json({
      success: true,
      message: 'Registrazione completata con successo!',
      user: newUser
    })
  } catch (error) {
    console.error('Errore durante la registrazione:', error)
    if (error instanceof Error) {
      console.error('Stack:', error.stack)
    }
    res.status(500).json({
      success: false,
      message: 'Errore interno del server',
  error: (error instanceof Error ? error.message : String(error))
    })
  }
})


// ...existing code...

// Nuova route compatibile con frontend
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e password sono obbligatori'
      })
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email non valida'
      })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
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
        passwordHash: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true
      }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email o password non corretti'
      })
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash)

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email o password non corretti'
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account disattivato. Contatta l'amministratore."
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    })

    const { passwordHash, ...userWithoutPassword } = user

    // Genera JWT
    const jwtSecret = process.env.JWT_SECRET || ''
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: 'JWT_SECRET non configurato nel server.'
      })
    }
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        badgeNumber: user.badgeNumber,
        department: user.department,
        rank: user.rank,
        phoneNumber: user.phoneNumber,
        isActive: user.isActive,
        isVerified: user.isVerified
      },
      jwtSecret,
      { expiresIn: '12h' }
    )

    res.json({
      success: true,
      message: 'Login effettuato con successo!',
      user: userWithoutPassword,
      token
    })
  } catch (error) {
    console.error('Errore durante il login:', error)
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    })
  }
})



// Endpoint di debug utenti (solo sviluppo)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/users', async (req, res) => {
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
          lastLogin: true
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ success: true, users, count: users.length, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Errore interno del server', timestamp: new Date().toISOString() });
    }
  });
}



// --- ROUTE PROFILO COMPATIBILI FRONTEND ---
// Tutto il blocco funzioni e route DOPO la dichiarazione di app, i middleware e tutte le altre route, subito prima di app.listen

// GET /api/profile - restituisce il profilo dell'utente autenticato
// Helpers minimi per default profilo e sanitizzazione
const DEFAULT_PROFILE_NAME = 'primary';
function getDefaultProfileData(profileKey: string) {
  return {
    holidays: [],
    permits: [],
    overtime: [],
    onCall: [],
    projects: [],
    appointments: [],
    shiftOverrides: {},
    workLocation: null,
    checkIns: [],
    totalCurrentYearHolidays: 0,
    totalPreviousYearsHolidays: 0,
    onCallFilterName: profileKey,
    shiftPattern: '',
    shiftDefinitions: {},
    cycleStartDate: new Date().toISOString().split('T')[0],
    cycleEndDate: null,
    salarySettings: { baseRate: 20, overtimeDiurnoRate: 15, overtimeNotturnoRate: 30, overtimeFestivoRate: 50, onCallFerialeRate: 2.5, onCallFestivaRate: 5, projectRate: 25 },
    netSalary: { ral: 28000, addRegionale: 1.73, addComunale: 0.9, detrazioniFamiliari: 0, bonusIrpef: 0 },
    reminderDays: 7,
    sentNotifications: [],
    view: 'dashboard',
    calendarFilters: { ferie: true, permessi: true, straordinario: true, reperibilita: true, progetto: true, appuntamento: true, shifts: true },
    collapsedCards: { holidays: false, permits: false, overtime: false, onCall: false, projects: false, shifts: true, salarySettings: true, payroll: false, netSalary: true, reminders: false, dataManagement: true, workLocation: true, checkIn: true },
    operativeCardOrder: ['holidays','permits','overtime','onCall','projects','shifts','workLocation','checkIn'],
    economicCardOrder: ['payroll','reminders','netSalary','salarySettings','dataManagement'],
    dashboardLayout: [
      { id: 'w_ai_insights', type: 'aiInsights' },
      { id: 'w_holidays', type: 'remainingHolidays' },
      { id: 'w_overtime', type: 'overtimeHoursThisMonth' },
      { id: 'w_permits', type: 'permitHoursThisMonth' },
      { id: 'w_projects', type: 'projectHoursThisMonth' },
      { id: 'w_reminders', type: 'reminders' }
    ]
  };
}

app.get('/api/profile', async (req: Request, res: Response) => {
  const { decoded, error } = verifyJWT(req);
  if (error) return res.status(401).json({ success: false, message: error });
  const userId = (decoded && (decoded as any).userId) || (decoded && (decoded as any).id);
  if (!userId) return res.status(401).json({ success: false, message: 'Token non valido (manca userId)' });

  try {
    const profileKey = (decoded as any).email?.toLowerCase() || `user-${userId}`;
    const existing = await prisma.profile.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
    const data = existing?.data ?? getDefaultProfileData(profileKey);

    // Se non esiste un profilo 'primary', crealo
    if (!existing || existing.name !== DEFAULT_PROFILE_NAME) {
      await prisma.profile.upsert({
        where: { userId_name: { userId, name: DEFAULT_PROFILE_NAME } },
        update: { data, isActive: true, updatedAt: new Date() },
        create: { userId, name: DEFAULT_PROFILE_NAME, data, isActive: true }
      });
      if (existing && existing.name !== DEFAULT_PROFILE_NAME) {
        await prisma.profile.updateMany({
          where: { userId, name: { not: DEFAULT_PROFILE_NAME } },
          data: { isActive: false, updatedAt: new Date() }
        });
      }
    }

    return res.json({ success: true, profile: data });
  } catch (e) {
    const msg = (e && typeof e === 'object' && 'message' in e) ? (e as any).message : String(e);
    return res.status(500).json({ success: false, message: 'Errore lettura profilo', error: msg });
  }
});

// POST /api/profile - aggiorna il profilo dell'utente autenticato
app.post('/api/profile', async (req: Request, res: Response) => {
  const { decoded, error } = verifyJWT(req);
  if (error) return res.status(401).json({ success: false, message: error });
  const userId = (decoded && (decoded as any).userId) || (decoded && (decoded as any).id);
  if (!userId) return res.status(401).json({ success: false, message: 'Token non valido (manca userId)' });

  // Supporta sia { profile: {...} } (nuovo) sia campi utente piatti (legacy)
  let body: any = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  if (body && typeof body.profile === 'object') {
    try {
      const profileKey = (decoded as any).email?.toLowerCase() || `user-${userId}`;
      const profileData = body.profile;
      await prisma.profile.upsert({
        where: { userId_name: { userId, name: DEFAULT_PROFILE_NAME } },
        update: { data: profileData, isActive: true, updatedAt: new Date() },
        create: { userId, name: DEFAULT_PROFILE_NAME, data: profileData, isActive: true }
      });
      await prisma.profile.updateMany({
        where: { userId, name: { not: DEFAULT_PROFILE_NAME } },
        data: { isActive: false, updatedAt: new Date() }
      });
      return res.json({ success: true, profile: profileData });
    } catch (err) {
      const msg = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
      return res.status(500).json({ success: false, message: 'Errore salvataggio profilo', error: msg });
    }
  }

  // Fallback legacy: aggiornamento dati utente di base
  const allowedFields = ['firstName','lastName','badgeNumber','department','rank','phoneNumber'];
  const data: Record<string,string> = {};
  for (const field of allowedFields) {
    if (typeof body?.[field] === 'string') data[field] = String(body[field]).trim();
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ success: false, message: 'Nessun campo valido da aggiornare' });
  }
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, firstName: true, lastName: true, badgeNumber: true, department: true, rank: true, phoneNumber: true, isActive: true, isVerified: true, createdAt: true, lastLogin: true }
    });
    return res.json({ success: true, user: updated });
  } catch (err) {
    const msg = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
    return res.status(500).json({ success: false, message: 'Errore aggiornamento profilo', error: msg });
  }
});

// GET /api/profiles - restituisce la lista di tutti i profili (solo admin)
app.get('/api/profiles', async (req: Request, res: Response) => {
  const { decoded, error } = verifyJWT(req);
  if (error) return res.status(401).json({ success: false, message: error });
  if (!decoded || (!('isAdmin' in decoded) && decoded.rank !== 'Admin')) {
    return res.status(403).json({ success: false, message: 'Solo admin' });
  }
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
      lastLogin: true
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, users });
});

export { app };
