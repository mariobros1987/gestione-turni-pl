import { describe, expect, it, beforeEach } from 'vitest';
import { server, http, HttpResponse } from '../../../tests/msw-server';

const sampleProfile = {
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
  calendarFilters: {} as any,
  collapsedCards: {} as any,
  operativeCardOrder: [],
  economicCardOrder: [],
  dashboardLayout: [],
};

beforeEach(() => {
  window.localStorage.setItem('turni_pl_auth_token', 'jwt-token');
});

import { profileApiService } from '../profileApiService';

describe('profileApiService integration', () => {
  it('getProfile recupera i dati dal server e li salva in cache locale', async () => {
    server.use(
      http.get('http://localhost:3000/api/profile', () =>
        HttpResponse.json({ success: true, profile: sampleProfile })
      )
    );

    const profile = await profileApiService.getProfile();

    expect(profile).toEqual(sampleProfile);
    expect(window.localStorage.getItem('turni_pl_profile_data')).toContain('agent@example.com');
  });

  it('saveProfile invia i dati al server e gestisce la pending sync flag', async () => {
    let pendingDuringRequest: string | null = null;

    server.use(
      http.post('http://localhost:3000/api/profile', async ({ request }) => {
        pendingDuringRequest = window.localStorage.getItem('turni_pl_pending_sync');
        const body = await request.json();
        expect(body).toEqual({ profile: sampleProfile });
        return HttpResponse.json({ success: true });
      })
    );

    const success = await profileApiService.saveProfile(sampleProfile as any);

    expect(success).toBe(true);
    expect(pendingDuringRequest).toBe('1');
    expect(window.localStorage.getItem('turni_pl_pending_sync')).toBeNull();
  });

  it('syncProfile usa i dati locali quando il server non risponde', async () => {
    const localProfile = sampleProfile;
    window.localStorage.setItem('turni_pl_profile_data', JSON.stringify(localProfile));

    server.use(
      http.get('http://localhost:3000/api/profile', () =>
        HttpResponse.json({ success: false }, { status: 500 })
      ),
      http.post('http://localhost:3000/api/profile', () =>
        HttpResponse.json({ success: true })
      )
    );

    const result = await profileApiService.syncProfile({ prefer: 'server' });

    expect(result).toEqual({ profile: localProfile, source: 'local' });
    expect(window.localStorage.getItem('turni_pl_pending_sync')).toBeNull();
  });
});
