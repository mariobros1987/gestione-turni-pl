import { VercelRequest, VercelResponse } from '@vercel/node'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024'

function verifyToken(token: string): any {
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

function isObject(v: any) { return v && typeof v === 'object' && !Array.isArray(v) }

function getDefaultProfileData(profileName?: string) {
  return {
    holidays: [], permits: [], overtime: [], onCall: [], projects: [], appointments: [],
    shiftOverrides: {}, workLocation: null, checkIns: [],
    totalCurrentYearHolidays: 0, totalPreviousYearsHolidays: 0, onCallFilterName: profileName || '',
    shiftPattern: '',
    shiftDefinitions: { Mattina: { start: '08:00', end: '14:00' }, Pomeriggio: { start: '16:00', end: '22:00' }, Notte: { start: '22:00', end: '06:00' }, Riposo: { start: '', end: '' }, Vuoto: { start: '', end: '' } },
    cycleStartDate: new Date().toISOString().split('T')[0], cycleEndDate: null,
    salarySettings: { baseRate: 20, overtimeDiurnoRate: 15, overtimeNotturnoRate: 30, overtimeFestivoRate: 50, onCallFerialeRate: 2.5, onCallFestivaRate: 5, projectRate: 25 },
    netSalary: { ral: 28000, addRegionale: 1.73, addComunale: 0.9, detrazioniFamiliari: 0, bonusIrpef: 0 },
    reminderDays: 7, sentNotifications: [], view: 'dashboard',
    calendarFilters: { ferie: true, permessi: true, straordinario: true, reperibilita: true, progetto: true, appuntamento: true, shifts: true },
    collapsedCards: { holidays: false, permits: false, overtime: false, onCall: false, projects: false, shifts: true, salarySettings: true, payroll: false, netSalary: true, reminders: false, dataManagement: true, workLocation: true, checkIn: true },
    operativeCardOrder: ['holidays', 'permits', 'overtime', 'onCall', 'projects', 'shifts', 'workLocation', 'checkIn'],
    economicCardOrder: ['payroll', 'reminders', 'netSalary', 'salarySettings', 'dataManagement'],
    dashboardLayout: [
      { id: 'w_ai_insights', type: 'aiInsights' }, { id: 'w_holidays', type: 'remainingHolidays' },
      { id: 'w_overtime', type: 'overtimeHoursThisMonth' }, { id: 'w_permits', type: 'permitHoursThisMonth' },
      { id: 'w_projects', type: 'projectHoursThisMonth' }, { id: 'w_reminders', type: 'reminders' },
    ],
  }
}

function sanitizeProfileData(data: any): any {
  const def = getDefaultProfileData()
  const out: any = { ...def, ...(isObject(data) ? data : {}) }
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
  out.shiftOverrides = isObject(data?.shiftOverrides) ? data.shiftOverrides : {}
  out.shiftDefinitions = isObject(data?.shiftDefinitions) ? { ...def.shiftDefinitions, ...data.shiftDefinitions } : def.shiftDefinitions
  out.calendarFilters = isObject(data?.calendarFilters) ? { ...def.calendarFilters, ...data.calendarFilters } : def.calendarFilters
  out.collapsedCards = isObject(data?.collapsedCards) ? { ...def.collapsedCards, ...data.collapsedCards } : def.collapsedCards
  out.salarySettings = isObject(data?.salarySettings) ? { ...def.salarySettings, ...data.salarySettings } : def.salarySettings
  out.netSalary = isObject(data?.netSalary) ? { ...def.netSalary, ...data.netSalary } : def.netSalary
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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Auth
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ success: false, message: 'Token mancante' })
  const decoded = verifyToken(token)
  if (!decoded) return res.status(401).json({ success: false, message: 'Token non valido' })
  const userId = (decoded as any).userId

  // Assicura tabella
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS profiles (
        id BIGSERIAL PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        data JSONB NOT NULL,
        isActive BOOLEAN NOT NULL DEFAULT TRUE,
        createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (userId, name)
      )
    `)
  } catch (e) {
    console.error('Errore creazione tabella profiles:', e)
  }

  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Metodo non supportato' })

  try {
    const rows: Array<{ id: number; name: string; data: any }> = await prisma.$queryRawUnsafe(
      `SELECT id, name, data FROM profiles WHERE userId = $1`,
      userId
    )

    let repaired = 0
    for (const row of rows) {
      const sanitized = sanitizeProfileData(row.data)
      await prisma.$executeRawUnsafe(
        `UPDATE profiles SET data = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        JSON.stringify(sanitized),
        row.id
      )
      repaired++
    }

    return res.status(200).json({ success: true, repaired })
  } catch (e) {
    console.error('Errore repair profili:', e)
    return res.status(500).json({ success: false, message: 'Errore repair profili' })
  }
}
