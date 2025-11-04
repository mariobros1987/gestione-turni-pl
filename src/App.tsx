// ...existing code...
export { App };
// ...existing code...
export const AppWithDebug = () => <App />;
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
import NfcReader from './components/NfcReader';

const App: React.FC = () => {
  // Stato per l'autenticazione (ora gestito dal servizio)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authMessage, setAuthMessage] = useState<string>('');

  const [currentUser, setCurrentUser] = useState<ApiUserData | null>(null);
  // Cache locale del profilo utente (sincronizzata con l'API)
  const [profileData, setProfileData] = useLocalStorage<ProfileData | null>('turni_pl_profile_data', null as ProfileData | null);
  const [profileError, setProfileError] = useState<string | null>(null);
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
  const normalized = data.onCallFilterName === profileKey ? data : { ...data, onCallFilterName: profileKey };
  console.log('[DEBUG] ensureProfileForUser - profilo normalizzato:', normalized);
  return normalized;
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
      setProfileError(null);
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
          } catch (err) {
            console.error('Errore repairProfile:', err);
          }
          // Sincronizza contro il server privilegiando i dati più recenti lato backend
          try {
            const prefer = profileApiService.hasPendingSync() ? 'local' : 'server';
            const synced = await profileApiService.syncProfile({ prefer });
            const applied = applyProfileSnapshot(synced?.profile ?? null, user);
            if (applied) {
              lastServerSnapshotRef.current = applied.snapshotString;
              if (!applied.existed) {
                try { await profileApiService.saveProfile(applied.profileData); } catch (err) {
                  console.error('Errore saveProfile:', err);
                }
              }
            } else {
              setProfileError('Profilo non trovato o non valido dopo la sync.');
              console.error('Profilo non trovato o non valido dopo la sync.');
            }
          } catch (err) {
            setProfileError('Errore durante la sincronizzazione del profilo: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
            console.error('Errore durante la sincronizzazione del profilo:', err);
          }
          return;
        }
      } catch (e) {
        setProfileError('Errore autenticazione utente: ' + (e instanceof Error ? e.message : JSON.stringify(e)));
        console.error('Errore autenticazione utente:', e);
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
        } catch (err) {
          setProfileError('Errore caricamento profilo locale: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
          console.error('Errore caricamento profilo locale:', err);
        }
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
  // view: 'dashboard', // ora gestito localmente in MainApp
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
      nfcReport: false,
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
    // Ignora il campo view, che ora è locale
    const { view, ...rest } = normalized as any;
    setProfileData(rest);
    lastLocalChangeRef.current = Date.now();
    console.log('💾 Salvataggio locale completato, sync server in 500ms...');
    try {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      // Ridotto debounce da 800ms a 500ms per salvataggio più rapido
      saveTimeoutRef.current = window.setTimeout(async () => {
        try {
          console.log('📤 Invio profilo al server...');
          const saved = await profileApiService.saveProfile(rest);
          if (saved) {
            console.log('✅ Profilo salvato sul server con successo');
            lastServerSnapshotRef.current = JSON.stringify(rest);
          } else {
            console.warn('⚠️ Salvataggio server fallito, rimarrà in locale');
          }
        } catch (err) {
          console.error('❌ Errore salvataggio server:', err);
        } finally {
          saveTimeoutRef.current = null;
        }
      }, 500);
    } catch {}
  };

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      return;
    }

    let cancelled = false;
    const SYNC_INTERVAL = 10000; // Ridotto a 10 secondi per sync più frequente

    const pullServerProfiles = async (force = false) => {
      if (cancelled) {
        return;
      }

      const now = Date.now();
      // Ridotto il tempo di blocco da 4s a 2s per permettere sync più rapide
      if (!force && now - lastLocalChangeRef.current < 2000) {
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

        console.log('🔄 Sincronizzazione server → client completata');
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
        console.log('📱 Scheda tornata visibile, forzo sincronizzazione');
        pullServerProfiles(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, currentUser]);
  // --- RENDER ---
  return (
    <>
      {/* Lettura NFC: mostra il componente sempre, oppure solo se autenticato */}
      <div style={{ margin: '24px 0' }}>
        <NfcReader />
        {/* Istruzioni per la programmazione del tag NFC */}
        <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>
          <div style={{
            padding: 12,
            border: '1px solid #3b82f6',
            background: '#0b1220',
            borderRadius: 8
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Imposta il tuo tag NFC</div>
            <div style={{ opacity: 0.9 }}>Consigliato: usa la modalità automatica. Il sistema decide entrata/uscita in base all'ultimo evento di oggi e applica il cooldown.</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              flexWrap: 'wrap'
            }}>
              <code style={{ padding: '6px 8px', background: '#111827', borderRadius: 6 }}>
                https://gestione-turni-pl.vercel.app/?azione=auto
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText('https://gestione-turni-pl.vercel.app/?azione=auto')}
                style={{ padding: '6px 10px', borderRadius: 6 }}
                title="Copia negli appunti"
              >
                Copia URL
              </button>
            </div>
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>Opzioni avanzate</summary>
              <div style={{ marginTop: 6 }}>
                • Forza entrata: <code>https://gestione-turni-pl.vercel.app/?azione=entrata</code><br />
                • Forza uscita: <code>https://gestione-turni-pl.vercel.app/?azione=uscita</code><br />
                Il sito interpreta il parametro <code>azione</code> e registra di conseguenza.
              </div>
            </details>
          </div>
        </div>
      </div>
      {profileError && (
        <div style={{ color: 'red', background: '#fff0f0', padding: 16, margin: 16, border: '1px solid #f00', borderRadius: 8 }}>
          <strong>Errore profilo:</strong> {profileError}
          <button style={{ marginLeft: 16 }} onClick={() => window.location.reload()}>Riprova</button>
        </div>
      )}
      {isAuthenticated && !profileError ? (
        <MainApp
          profileName={deriveProfileKey(currentUser)!}
          profileData={profileData!}
          onUpdateProfileData={handleUpdateProfileData}
          onLogout={handleLogout}
        />
      ) : (!isAuthenticated && !profileError) ? (
        authView === 'login' ? (
          <Login onLogin={handleLogin} onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <Registration onRegister={handleRegister} onSwitchToLogin={() => setAuthView('login')} />
        )
      ) : null}
      <DebugPanel />
    </>
  );
}
export default App;