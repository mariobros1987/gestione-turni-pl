import { describe, expect, it, beforeEach } from 'vitest';
import { server, http, HttpResponse } from '../../../tests/msw-server';

const sampleProfiles = {
  'agent@example.com': {
    holidays: [],
    permits: [],
    overtime: [],
    onCall: [],
    projects: [],
    appointments: [],
    shiftOverrides: {},
    workLocation: null,
    checkIns: [],
    totalCurrentYearHolidays: 10,
    totalPreviousYearsHolidays: 5,
    onCallFilterName: 'agent@example.com',
    shiftPattern: '',
    shiftDefinitions: {},
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
    calendarFilters: {},
    collapsedCards: {} as any,
    operativeCardOrder: [],
    economicCardOrder: [],
    dashboardLayout: [],
  },
};

beforeEach(() => {
  window.localStorage.setItem('turni_pl_auth_token', 'jwt-token');
});

import { profileApiService } from '../profileApiService';

describe('profileApiService integration', () => {
  it('getProfiles recupera i dati dal server e li salva in cache locale', async () => {
    server.use(
      http.get('http://localhost:3000/api/profiles', () =>
        HttpResponse.json({ success: true, profiles: sampleProfiles })
      )
    );

    const profiles = await profileApiService.getProfiles();

    expect(profiles).toEqual(sampleProfiles);
    expect(window.localStorage.getItem('turni_pl_profiles_data')).toContain('agent@example.com');
  });

  it('saveProfiles invia i dati al server e gestisce la pending sync flag', async () => {
    let pendingDuringRequest: string | null = null;

    server.use(
      http.post('http://localhost:3000/api/profiles', async ({ request }) => {
        pendingDuringRequest = window.localStorage.getItem('turni_pl_pending_sync');
        const body = await request.json();
        expect(body).toEqual({ profiles: sampleProfiles, fullSync: true });
        return HttpResponse.json({ success: true });
      })
    );

    const success = await profileApiService.saveProfiles(sampleProfiles, { fullSync: true });

    expect(success).toBe(true);
    expect(pendingDuringRequest).toBe('1');
    expect(window.localStorage.getItem('turni_pl_pending_sync')).toBeNull();
  });

  it('syncProfiles usa i dati locali quando il server non risponde', async () => {
    const localProfiles = sampleProfiles;
    window.localStorage.setItem('turni_pl_profiles_data', JSON.stringify(localProfiles));

    server.use(
      http.get('http://localhost:3000/api/profiles', () =>
        HttpResponse.json({ success: false }, { status: 500 })
      ),
      http.post('http://localhost:3000/api/profiles', () =>
        HttpResponse.json({ success: true })
      )
    );

    const result = await profileApiService.syncProfiles({ prefer: 'server' });

    expect(result).toEqual({ profiles: localProfiles, source: 'local' });
    expect(window.localStorage.getItem('turni_pl_pending_sync')).toBeNull();
  });
});
