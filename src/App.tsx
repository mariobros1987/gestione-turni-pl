import React, { useState, useEffect, useRef } from 'react';
import { ProfileData } from './types/types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { MainApp } from './MainApp';
import { Login } from './components/auth/Login';
import { Registration } from './components/auth/Registration';
import { authService } from './services/authService';
import { authService as apiAuthService, UserData as ApiUserData } from './services/apiAuthService';
import { DebugPanel } from './components/DebugPanel';
import { profileApiService } from './services/profileApiService';

export const App = () => {
  // Stato per l'autenticazione (ora gestito dal servizio)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authMessage, setAuthMessage] = useState<string>('');

  const [currentUser, setCurrentUser] = useState<ApiUserData | null>(null);
  // Cache locale del profilo utente (sincronizzata con l'API)
  const [profileData, setProfileData] = useLocalStorage<ProfileData | null>('turni_pl_profile_data', null as ProfileData | null);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastLocalChangeRef = useRef<number>(0);
  const lastServerSnapshotRef = useRef<string>('');

  const deriveProfileKey = (user: ApiUserData | null): string | null => {
    if (!user) {
      return null;
    }
    if (user.email) {
      return user.email.trim().toLowerCase();
    }
    if (user.id) {
      return `user-${user.id}`;
    }
    return null;
  };

  const ensureProfileForUser = (data: ProfileData, profileKey: string): ProfileData => {
    return data.onCallFilterName === profileKey ? data : { ...data, onCallFilterName: profileKey };
  };

  const applyProfileSnapshot = (
    snapshot: ProfileData | null | undefined,
    user: ApiUserData | null = currentUser
  ) => {
    const profileKey = deriveProfileKey(user);
    if (!profileKey) {
      return null;
    }

    const source = snapshot ?? profileData ?? getInitialProfileData(profileKey);
    const normalized = ensureProfileForUser(source, profileKey);

    setProfileData(normalized);

    return {
      profileKey,
      profileData: normalized,
      existed: Boolean(snapshot),
      snapshotString: JSON.stringify(normalized)
    };
  };

  // Autenticazione iniziale
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await apiAuthService.getCurrentUser();
        if (user) {
          setIsAuthenticated(true);
          setCurrentUser(user);
          // Esegui una volta il repair dopo login/refresh (per utente) con throttling
          try {
            const repairKey = `turni_pl_repair_done_${user.id}`;
            const last = localStorage.getItem(repairKey);
            const now = Date.now();
            const THROTTLE_MS = 1000 * 60 * 60 * 24; // 24h
            if (!last || now - parseInt(last, 10) > THROTTLE_MS) {
              const res = await profileApiService.repairProfile();
              if (res.success) {
                localStorage.setItem(repairKey, now.toString());
              }
            }
          } catch {}
          // Sincronizza contro il server privilegiando i dati più recenti lato backend
          try {
            const prefer = profileApiService.hasPendingSync() ? 'local' : 'server';
            const synced = await profileApiService.syncProfile({ prefer });
            const applied = applyProfileSnapshot(synced?.profile ?? null, user);
            if (applied) {
              lastServerSnapshotRef.current = applied.snapshotString;
              if (!applied.existed) {
                try { await profileApiService.saveProfile(applied.profileData); } catch {}
              }
            }
          } catch {}
          return;
        }
      } catch (e) {
        // ignora, fallback a locale
      }
      const isLoggedIn = authService.isLoggedIn();
      setIsAuthenticated(isLoggedIn);
      if (isLoggedIn) {
        try {
          const localUser = authService.getCurrentUser() as unknown as ApiUserData | null;
          if (localUser) {
            setCurrentUser(localUser);
            const applied = applyProfileSnapshot(profileData, localUser);
            if (applied) {
              lastServerSnapshotRef.current = applied.snapshotString;
            }
          }
        } catch {}
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (success: boolean, message?: string) => {
    if (success) {
      setIsAuthenticated(true);
      setAuthMessage('');
      let user: ApiUserData | null = null;
      // Dopo login, invoca anche il repair (throttled)
      try {
        user = await apiAuthService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          const repairKey = `turni_pl_repair_done_${user.id}`;
          const last = localStorage.getItem(repairKey);
          const now = Date.now();
          const THROTTLE_MS = 1000 * 60 * 60 * 24;
          if (!last || now - parseInt(last, 10) > THROTTLE_MS) {
            const res = await profileApiService.repairProfile();
            if (res.success) {
              localStorage.setItem(repairKey, now.toString());
            }
          }
        }
      } catch {}
      // Dopo login sincronizza contro il server scegliendo la fonte più aggiornata
      try {
        const prefer = profileApiService.hasPendingSync() ? 'local' : 'server';
        const synced = await profileApiService.syncProfile({ prefer });
        const applied = applyProfileSnapshot(synced?.profile ?? null, user ?? currentUser);
        if (applied) {
          lastServerSnapshotRef.current = applied.snapshotString;
          if (!applied.existed) {
            try { await profileApiService.saveProfile(applied.profileData); } catch {}
          }
        }
      } catch {}
    } else {
      setAuthMessage(message || 'Errore durante il login');
    }
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setProfileData(null);
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    lastServerSnapshotRef.current = '';
  };

  const handleRegister = (success: boolean, message?: string) => {
    if (success) {
      setIsAuthenticated(true);
      setAuthMessage('');
    } else {
      setAuthMessage(message || 'Errore durante la registrazione');
    }
  };

  function getInitialProfileData(profileName: string): ProfileData {
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
    onCallFilterName: profileName,
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
    };
  }

  const handleUpdateProfileData = (newData: ProfileData) => {
    const profileKey = deriveProfileKey(currentUser);
    if (!profileKey) return;

    const normalized = ensureProfileForUser(newData, profileKey);

    setProfileData(normalized);
    lastLocalChangeRef.current = Date.now();

    try {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(async () => {
        try {
          const saved = await profileApiService.saveProfile(normalized);
          if (saved) {
            lastServerSnapshotRef.current = JSON.stringify(normalized);
          }
        } finally {
          saveTimeoutRef.current = null;
        }
      }, 800);
    } catch {}
  };

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      return;
    }

    let cancelled = false;
    const SYNC_INTERVAL = 15000;

    const pullServerProfiles = async (force = false) => {
      if (cancelled) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastLocalChangeRef.current < 4000) {
        return;
      }

      try {
        const profileKey = deriveProfileKey(currentUser);
        if (!profileKey) {
          return;
        }

        const serverProfile = await profileApiService.getProfile();
        if (!serverProfile) {
          return;
        }

        const normalized = ensureProfileForUser(serverProfile, profileKey);
        const previewSnapshot = JSON.stringify(normalized);
        if (!force && previewSnapshot === lastServerSnapshotRef.current) {
          return;
        }

        setProfileData(normalized);
        lastServerSnapshotRef.current = previewSnapshot;
        lastLocalChangeRef.current = Date.now();
      } catch (error) {
        console.error('❌ Errore sincronizzazione server → client:', error);
      }
    };

    // Solo la prima sync all'avvio
    pullServerProfiles(true);

    const intervalId = window.setInterval(() => {
      pullServerProfiles(false);
    }, SYNC_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pullServerProfiles(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser?.id]);

  if (!isAuthenticated) {
    return (
      <div>
        {authView === 'login' ? (
          <Login onLogin={handleLogin} onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <Registration onRegister={handleRegister} onSwitchToLogin={() => setAuthView('login')} />
        )}
      </div>
    );
  }

  const profileKey = deriveProfileKey(currentUser);
  const resolvedProfile = profileData;

  if (!profileKey || !resolvedProfile) {
    return (
      <div className="profile-loading">
        <p>Caricamento dati profilo…</p>
      </div>
    );
  }

  return (
    <MainApp
      profileName={profileKey}
      profileData={resolvedProfile}
      onUpdateProfileData={handleUpdateProfileData}
      onLogout={handleLogout}
    />
  );
};

export const AppWithDebug = () => (
  <>
    <App />
    {process.env.NODE_ENV === 'development' && <DebugPanel />}
  </>
);