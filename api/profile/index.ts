import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

// Singleton Prisma per evitare connessioni multiple
const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Funzione helper per assicurare la connessione
async function ensurePrismaConnection() {
  try {
    await prisma.$connect()
  } catch (error) {
    console.error('❌ Errore connessione Prisma:', error)
    throw error
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024'
const DEFAULT_PROFILE_NAME = 'primary'

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

function isObject(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

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

function sanitizeProfileData(data: any, profileKey: string) {
  const defaults = getDefaultProfileData(profileKey)
  const out: any = { ...defaults, ...(isObject(data) ? data : {}) }

  out.holidays = Array.isArray(data?.holidays) ? data.holidays : []
  out.permits = Array.isArray(data?.permits) ? data.permits : []
  out.overtime = Array.isArray(data?.overtime) ? data.overtime : []
  out.onCall = Array.isArray(data?.onCall) ? data.onCall : []
  out.projects = Array.isArray(data?.projects) ? data.projects : []
  out.appointments = Array.isArray(data?.appointments) ? data.appointments : []
  out.checkIns = Array.isArray(data?.checkIns) ? data.checkIns : []
  out.sentNotifications = Array.isArray(data?.sentNotifications) ? data.sentNotifications : []
  out.operativeCardOrder = Array.isArray(data?.operativeCardOrder) ? data.operativeCardOrder : defaults.operativeCardOrder
  out.economicCardOrder = Array.isArray(data?.economicCardOrder) ? data.economicCardOrder : defaults.economicCardOrder
  out.dashboardLayout = Array.isArray(data?.dashboardLayout) ? data.dashboardLayout : defaults.dashboardLayout

  out.shiftOverrides = isObject(data?.shiftOverrides) ? data.shiftOverrides : {}
  out.shiftDefinitions = isObject(data?.shiftDefinitions) ? { ...defaults.shiftDefinitions, ...data.shiftDefinitions } : defaults.shiftDefinitions
  out.calendarFilters = isObject(data?.calendarFilters) ? { ...defaults.calendarFilters, ...data.calendarFilters } : defaults.calendarFilters
  out.collapsedCards = isObject(data?.collapsedCards) ? { ...defaults.collapsedCards, ...data.collapsedCards } : defaults.collapsedCards
  out.salarySettings = isObject(data?.salarySettings) ? { ...defaults.salarySettings, ...data.salarySettings } : defaults.salarySettings
  out.netSalary = isObject(data?.netSalary) ? { ...defaults.netSalary, ...data.netSalary } : defaults.netSalary

  out.workLocation = (data?.workLocation && isObject(data.workLocation)) ? data.workLocation : null
  out.totalCurrentYearHolidays = Number.isFinite(data?.totalCurrentYearHolidays) ? data.totalCurrentYearHolidays : 0
  out.totalPreviousYearsHolidays = Number.isFinite(data?.totalPreviousYearsHolidays) ? data.totalPreviousYearsHolidays : 0
  out.onCallFilterName = profileKey
  out.shiftPattern = typeof data?.shiftPattern === 'string' ? data.shiftPattern : ''
  out.cycleStartDate = typeof data?.cycleStartDate === 'string' ? data.cycleStartDate : defaults.cycleStartDate
  out.cycleEndDate = (typeof data?.cycleEndDate === 'string' || data?.cycleEndDate === null || data?.cycleEndDate === undefined) ? data.cycleEndDate ?? null : null
  out.reminderDays = Number.isFinite(data?.reminderDays) ? data.reminderDays : 7

  const allowedViews = ['dashboard', 'grid', 'calendar', 'report']
  out.view = allowedViews.includes(data?.view) ? data.view : 'dashboard'

  return out
}

async function ensureProfilesTable() {
  try {
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
  } catch (error) {
    console.error('❌ Errore creazione/verifica tabella profiles:', error)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || req.headers.referer || '*'
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // Assicura connessione Prisma prima di qualsiasi query
    await ensurePrismaConnection()
    
    const authHeader = req.headers.authorization
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const cookieToken = (req as any).cookies?.auth_token || (req as any).cookies?.token
    const token = bearerToken || cookieToken

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token di autenticazione mancante' })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Token non valido' })
    }

    const userId = (decoded as any).userId
    const profileKey = (decoded as any).email?.toLowerCase() || `user-${userId}`

    await ensureProfilesTable()

    if (req.method === 'GET') {
      try {
        const existing = await prisma.profile.findFirst({
          where: { userId, isActive: true },
          orderBy: { updatedAt: 'desc' },
        })

        const sanitized = sanitizeProfileData(existing?.data ?? null, profileKey)

        if (!existing || existing.name !== DEFAULT_PROFILE_NAME) {
          await prisma.profile.upsert({
            where: { userId_name: { userId, name: DEFAULT_PROFILE_NAME } },
            update: { data: sanitized, isActive: true, updatedAt: new Date() },
            create: {
              userId,
              name: DEFAULT_PROFILE_NAME,
              data: sanitized,
              isActive: true,
            },
          })

          if (existing && existing.name !== DEFAULT_PROFILE_NAME) {
            await prisma.profile.updateMany({
              where: {
                userId,
                name: { not: DEFAULT_PROFILE_NAME },
              },
              data: { isActive: false, updatedAt: new Date() },
            })
          }
        }

        return res.status(200).json({ success: true, profile: sanitized })
      } catch (error) {
        console.error('❌ Errore lettura profilo:', error)
        return res.status(500).json({ success: false, message: 'Errore lettura profilo' })
      }
    }

    if (req.method === 'POST') {
      let body: any = req.body
      if (typeof body === 'string') {
        try { body = JSON.parse(body) } catch { body = {} }
      }

      const { profile } = body
      if (!profile || typeof profile !== 'object') {
  console.warn('⚠️ Profilo mancante o non valido, ma accettato per compatibilità.');
  return res.status(200).json({ success: true, profile: {} });
      }

      try {
        const sanitized = sanitizeProfileData(profile, profileKey)

        await prisma.profile.upsert({
          where: { userId_name: { userId, name: DEFAULT_PROFILE_NAME } },
          update: { data: sanitized, isActive: true, updatedAt: new Date() },
          create: {
            userId,
            name: DEFAULT_PROFILE_NAME,
            data: sanitized,
            isActive: true,
          },
        })

        await prisma.profile.updateMany({
          where: {
            userId,
            name: { not: DEFAULT_PROFILE_NAME },
          },
          data: { isActive: false, updatedAt: new Date() },
        })

        return res.status(200).json({ success: true, profile: sanitized })
      } catch (error) {
        console.error('❌ Errore salvataggio profilo:', error)
        const message = error instanceof Error ? error.message : 'Errore salvataggio profilo'
        return res.status(500).json({ success: false, message })
      }
    }

    return res.status(405).json({ success: false, message: 'Metodo non supportato' })
  } catch (error) {
    console.error('❌ Errore API profilo:', error)
    return res.status(500).json({ success: false, message: 'Errore interno del server' })
  } finally {
    if (process.env.NODE_ENV !== 'development') {
      await prisma.$disconnect()
    }
  }
}
