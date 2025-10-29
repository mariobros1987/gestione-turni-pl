import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient, Prisma } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024'

// Funzione per verificare il JWT token
function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

async function ensureProfilesTable() {
  try {
    const columns: Array<{ column_name: string; data_type: string }> = await prisma.$queryRawUnsafe(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles'`
    )

    if (!columns.length) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "profiles" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "data" JSONB NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT profiles_userId_name_key UNIQUE ("userId", "name")
        )
      `)
      return
    }

    const hasColumn = (name: string) => columns.some(col => col.column_name === name)

    const renameMap: Array<{ from: string; to: string }> = [
  { from: 'user_id', to: 'userId' },
      { from: 'is_active', to: 'isActive' },
      { from: 'created_at', to: 'createdAt' },
      { from: 'updated_at', to: 'updatedAt' }
    ]

    for (const { from, to } of renameMap) {
      if (hasColumn(from) && !hasColumn(to)) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "profiles" RENAME COLUMN "${from}" TO "${to}"`)
      }
    }

    const refreshedColumns: Array<{ column_name: string; data_type: string }> = await prisma.$queryRawUnsafe(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles'`
    )

    const findColumn = (name: string) => refreshedColumns.find(col => col.column_name === name)
    const idColumn = findColumn('id')
    if (idColumn && idColumn.data_type !== 'text') {
      await prisma.$executeRawUnsafe(`ALTER TABLE "profiles" ALTER COLUMN "id" TYPE TEXT USING "id"::text`)
    }

    const ensureDefault = async (column: string, defaultValue: string) => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "profiles" ALTER COLUMN "${column}" SET DEFAULT ${defaultValue}`)
    }

    if (findColumn('isActive')) {
      await ensureDefault('isActive', 'TRUE')
    }
    if (findColumn('createdAt')) {
      await ensureDefault('createdAt', 'NOW()')
    }
    if (findColumn('updatedAt')) {
      await ensureDefault('updatedAt', 'NOW()')
    }

    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS profiles_userid_name_key ON "profiles"("userId", "name")`)
  } catch (error) {
    console.error('❌ Errore creazione/verifica tabella profiles:', error)
    throw error
  }
}

// Helpers per sanitizzazione ProfileData
function isObject(v: any) { return v && typeof v === 'object' && !Array.isArray(v) }

function getDefaultProfileData(profileName?: string) {
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
    onCallFilterName: profileName || '',
    shiftPattern: '',
    shiftDefinitions: {
      Mattina: { start: '08:00', end: '14:00' },
      Pomeriggio: { start: '16:00', end: '22:00' },
      Notte: { start: '22:00', end: '06:00' },
      Riposo: { start: '', end: '' },
      Vuoto: { start: '', end: '' },
    },
    cycleStartDate: new Date().toISOString().split('T')[0],
    cycleEndDate: null,
    salarySettings: {
      baseRate: 20,
      overtimeDiurnoRate: 15,
      overtimeNotturnoRate: 30,
      overtimeFestivoRate: 50,
      onCallFerialeRate: 2.5,
      onCallFestivaRate: 5,
      projectRate: 25,
    },
    netSalary: {
      ral: 28000,
      addRegionale: 1.73,
      addComunale: 0.9,
      detrazioniFamiliari: 0,
      bonusIrpef: 0,
    },
    reminderDays: 7,
    sentNotifications: [],
    view: 'dashboard',
    calendarFilters: {
      ferie: true,
      permessi: true,
      straordinario: true,
      reperibilita: true,
      progetto: true,
      appuntamento: true,
      shifts: true,
    },
    collapsedCards: {
      holidays: false,
      permits: false,
      overtime: false,
      onCall: false,
      projects: false,
      shifts: true,
      salarySettings: true,
      payroll: false,
      netSalary: true,
      reminders: false,
      dataManagement: true,
      workLocation: true,
      checkIn: true,
    },
    operativeCardOrder: ['holidays', 'permits', 'overtime', 'onCall', 'projects', 'shifts', 'workLocation', 'checkIn'],
    economicCardOrder: ['payroll', 'reminders', 'netSalary', 'salarySettings', 'dataManagement'],
    dashboardLayout: [
      { id: 'w_ai_insights', type: 'aiInsights' },
      { id: 'w_holidays', type: 'remainingHolidays' },
      { id: 'w_overtime', type: 'overtimeHoursThisMonth' },
      { id: 'w_permits', type: 'permitHoursThisMonth' },
      { id: 'w_projects', type: 'projectHoursThisMonth' },
      { id: 'w_reminders', type: 'reminders' },
    ],
  }
}

function sanitizeProfileData(data: any): any {
  const def = getDefaultProfileData()
  const out: any = { ...def, ...(isObject(data) ? data : {}) }
  // Array
  out.holidays = Array.isArray(data?.holidays) ? data.holidays : []
  out.permits = Array.isArray(data?.permits) ? data.permits : []
  out.overtime = Array.isArray(data?.overtime) ? data.overtime : []
  out.onCall = Array.isArray(data?.onCall) ? data.onCall : []
  out.projects = Array.isArray(data?.projects) ? data.projects : []
  out.appointments = Array.isArray(data?.appointments) ? data.appointments : []
  out.checkIns = Array.isArray(data?.checkIns) ? data.checkIns : []
  out.sentNotifications = Array.isArray(data?.sentNotifications) ? data.sentNotifications : []
  out.operativeCardOrder = Array.isArray(data?.operativeCardOrder) ? data.operativeCardOrder : def.operativeCardOrder
  out.economicCardOrder = Array.isArray(data?.economicCardOrder) ? data.economicCardOrder : def.economicCardOrder
  out.dashboardLayout = Array.isArray(data?.dashboardLayout) ? data.dashboardLayout : def.dashboardLayout

  // Record/oggetti
  out.shiftOverrides = isObject(data?.shiftOverrides) ? data.shiftOverrides : {}
  out.shiftDefinitions = isObject(data?.shiftDefinitions) ? { ...def.shiftDefinitions, ...data.shiftDefinitions } : def.shiftDefinitions
  out.calendarFilters = isObject(data?.calendarFilters) ? { ...def.calendarFilters, ...data.calendarFilters } : def.calendarFilters
  out.collapsedCards = isObject(data?.collapsedCards) ? { ...def.collapsedCards, ...data.collapsedCards } : def.collapsedCards
  out.salarySettings = isObject(data?.salarySettings) ? { ...def.salarySettings, ...data.salarySettings } : def.salarySettings
  out.netSalary = isObject(data?.netSalary) ? { ...def.netSalary, ...data.netSalary } : def.netSalary

  // Tipi primitivi
  out.workLocation = (data?.workLocation && isObject(data.workLocation)) ? data.workLocation : null
  out.totalCurrentYearHolidays = Number.isFinite(data?.totalCurrentYearHolidays) ? data.totalCurrentYearHolidays : 0
  out.totalPreviousYearsHolidays = Number.isFinite(data?.totalPreviousYearsHolidays) ? data.totalPreviousYearsHolidays : 0
  out.onCallFilterName = typeof data?.onCallFilterName === 'string' ? data.onCallFilterName : ''
  out.shiftPattern = typeof data?.shiftPattern === 'string' ? data.shiftPattern : ''
  out.cycleStartDate = typeof data?.cycleStartDate === 'string' ? data.cycleStartDate : def.cycleStartDate
  out.cycleEndDate = (typeof data?.cycleEndDate === 'string' || data?.cycleEndDate === null || data?.cycleEndDate === undefined) ? data.cycleEndDate ?? null : null
  out.reminderDays = Number.isFinite(data?.reminderDays) ? data.reminderDays : 7

  const allowedViews = ['dashboard', 'grid', 'calendar', 'report']
  out.view = allowedViews.includes(data?.view) ? data.view : 'dashboard'

  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || req.headers.referer || '*'
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // Estrai il token dall'header Authorization
    const authHeader = req.headers.authorization
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const cookieToken = (req as any).cookies?.auth_token || (req as any).cookies?.token
    const token = bearerToken || cookieToken

    if (!token) {
      console.log('❌ Token mancante in Authorization header');
      return res.status(401).json({ 
        success: false, 
        message: 'Token di autenticazione mancante' 
      })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      console.log('❌ Token non valido');
      return res.status(401).json({ 
        success: false, 
        message: 'Token non valido' 
      })
    }

    console.log('✅ Token valido per utente:', decoded.email);
    const userId = (decoded as any).userId

  await ensureProfilesTable()

    if (req.method === 'GET') {
      // Carica i profili persistiti per l'utente, con sanitizzazione
      try {
        const rows = await prisma.profile.findMany({
          where: { userId, isActive: true },
          select: { name: true, data: true }
        })

        const profiles: Record<string, any> = {}
        for (const row of rows) {
          profiles[row.name] = sanitizeProfileData(row.data)
        }

        return res.status(200).json({ success: true, profiles })
      } catch (e) {
        console.error('❌ Errore lettura profili:', e)
        return res.status(500).json({ success: false, message: 'Errore lettura profili' })
      }
    }

    if (req.method === 'POST') {
      // Salva/aggiorna i profili (upsert per ciascun profilo)
      let body: any = req.body
      if (typeof body === 'string') {
        try { body = JSON.parse(body) } catch (e) { body = {} }
      }
      const { profiles, fullSync = true } = body

      if (!profiles || typeof profiles !== 'object') {
        return res.status(400).json({ success: false, message: 'Profili mancanti o non validi' })
      }

      try {
        const names = Object.keys(profiles)
        for (const name of names) {
          const incomingData = sanitizeProfileData(profiles[name]);
          const dbProfile = await prisma.profile.findUnique({ where: { userId_name: { userId, name } } });
          // Cast esplicito a Record<string, any>
          const dbData: Record<string, any> = dbProfile && dbProfile.data ? dbProfile.data as Record<string, any> : {};
          let mergedData: Record<string, any> = { ...dbData };
          const types = ['holidays', 'permits', 'overtime', 'onCall', 'projects', 'appointments', 'checkIns'];
          types.forEach(type => {
            mergedData[type] = mergeEvents(
              Array.isArray(dbData[type]) ? dbData[type] : [],
              Array.isArray(incomingData[type]) ? incomingData[type] : []
            );
          });
          // Copia anche i campi non array aggiornati
          Object.keys(incomingData).forEach(key => {
            if (!types.includes(key)) {
              mergedData[key] = incomingData[key];
            }
          });
          await prisma.profile.upsert({
            where: { userId_name: { userId, name } },
            update: {
              data: mergedData,
              isActive: true,
              updatedAt: new Date()
            },
            create: {
              userId,
              name,
              data: mergedData,
              isActive: true
            }
          });
        }

        // Funzione di merge per array di eventi tipizzata
        function mergeEvents(dbEvents: any[] = [], incomingEvents: any[] = []): any[] {
          const merged: Record<string, any> = {};
          dbEvents.forEach((ev: any) => { if(ev && ev.id) merged[ev.id] = ev; });
          incomingEvents.forEach((ev: any) => {
            if(ev && ev.id) {
              if (!merged[ev.id] || (ev.updatedAt && merged[ev.id].updatedAt && new Date(ev.updatedAt) > new Date(merged[ev.id].updatedAt))) {
                merged[ev.id] = ev;
              }
            }
          });
          return Object.values(merged).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        if (fullSync) {
          if (names.length === 0) {
            await prisma.profile.updateMany({
              where: { userId },
              data: { isActive: false, updatedAt: new Date() }
            })
          } else {
            await prisma.profile.updateMany({
              where: {
                userId,
                name: { notIn: names }
              },
              data: { isActive: false, updatedAt: new Date() }
            })
          }
        }

        return res.status(200).json({ success: true, message: 'Profili salvati' })
      } catch (e) {
        console.error('❌ Errore salvataggio profili:', e)
        const prismaCode = (e as any)?.code
        const errorMessage = e instanceof Error ? e.message : 'Errore sconosciuto'
        return res.status(500).json({ success: false, message: 'Errore salvataggio profili', error: errorMessage, prismaCode })
      }
    }

    return res.status(405).json({ 
      success: false, 
      message: 'Metodo non supportato' 
    })

  } catch (error) {
    console.error('❌ Errore API profili:', error)
    return res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    })
  }
}