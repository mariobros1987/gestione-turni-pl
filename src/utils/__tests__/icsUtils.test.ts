import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateIcsContent } from '../icsUtils';
import { AppointmentEntry, HolidayEntry, ProfileData } from '../../types/types';

const createBaseProfile = (): ProfileData => ({
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
  onCallFilterName: 'utente@test.it',
  shiftPattern: 'Day1,Mattina,08:00,16:00\nDay2,Riposo,,',
  shiftDefinitions: {
    Mattina: { start: '08:00', end: '16:00' },
  },
  cycleStartDate: '2025-01-01',
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
    shifts: false,
    salarySettings: false,
    payroll: false,
    netSalary: false,
    reminders: false,
    dataManagement: false,
    workLocation: false,
    checkIn: false,
    nfcReport: false,
  },
  operativeCardOrder: [],
  economicCardOrder: [],
  dashboardLayout: [],
});

describe('generateIcsContent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('genera vCalendar con eventi ferie e appuntamenti', () => {
    const profile = createBaseProfile();
    const holiday: HolidayEntry = {
      id: 'holiday-1',
      type: 'ferie',
      date: '2025-01-10',
      notes: 'Vacanza',
      value: 2,
    };
    const appointment: AppointmentEntry = {
      id: 'appt-1',
      type: 'appuntamento',
      date: '2025-01-03',
      title: 'Briefing',
      startTime: '09:00',
      endTime: '10:00',
      value: 1,
      notes: 'Cliente',
    };

    profile.holidays = [holiday];
    profile.appointments = [appointment];
    profile.shiftOverrides['2025-01-02'] = { name: 'Speciale', start: '12:00', end: '18:00' };

    const ics = generateIcsContent('Mario Rossi', profile, [holiday, appointment]);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('PRODID:-//GestioneTurniPL//App//IT');
    expect(ics).toContain('SUMMARY:Ferie - Vacanza');
    expect(ics).toContain('UID:holiday-1@gestioneturni.app-day-0');
    expect(ics).toContain('SUMMARY:Appuntamento: Briefing (09:00-10:00) - Cliente');
    expect(ics).toContain('SUMMARY:Turno Mattina');
    expect(ics).toContain('SUMMARY:Turno Speciale');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });
});
