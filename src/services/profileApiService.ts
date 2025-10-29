import { ProfileData } from '../types/types';

// Gestisce il profilo personale (unico per utente) sincronizzato via API con cache locale
export class ProfileApiService {
  private readonly LOCAL_KEY = 'turni_pl_profile_data';
  private readonly PENDING_SYNC_KEY = 'turni_pl_pending_sync';
  private readonly baseUrl: string;

  constructor() {
    if (
      typeof window !== 'undefined' &&
      window.location?.origin &&
      window.location.port === '5173'
    ) {
      // In sviluppo con Vite: usa richieste relative per sfruttare il proxy
      this.baseUrl = '';
    } else if (process.env.VERCEL_URL) {
      this.baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (typeof window !== 'undefined') {
      this.baseUrl = window.location.origin;
    } else {
      this.baseUrl = 'http://localhost:3000';
    }
  }

  private readLocalProfile(): ProfileData | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(this.LOCAL_KEY);
      return raw ? (JSON.parse(raw) as ProfileData | null) : null;
    } catch (error) {
      console.warn('⚠️ Lettura profilo locale fallita, uso fallback null', error);
      return null;
    }
  }

  private writeLocalProfile(profile: ProfileData | null): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (profile) {
        window.localStorage.setItem(this.LOCAL_KEY, JSON.stringify(profile));
      } else {
        window.localStorage.removeItem(this.LOCAL_KEY);
      }
    } catch (error) {
      console.warn('⚠️ Salvataggio profilo locale fallito', error);
    }
  }

  private markPendingSync(): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(this.PENDING_SYNC_KEY, '1');
    } catch {}
  }

  private clearPendingSync(): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.removeItem(this.PENDING_SYNC_KEY);
    } catch {}
  }

  public hasPendingSync(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      return window.localStorage.getItem(this.PENDING_SYNC_KEY) === '1';
    } catch {
      return false;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') {
      return {};
    }
    const token = window.localStorage.getItem('turni_pl_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async fetchProfileFromServer(): Promise<ProfileData | null> {
    const authHeaders = this.getAuthHeaders();
    if (!authHeaders.Authorization) {
      return null;
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/profile`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });

      if (!response.ok) {
        let details: any = null;
        try { details = await response.json(); } catch {}
        console.warn('❌ Errore caricamento profilo:', response.status, details?.message ?? '');
        return null;
      }

      const data = await response.json();
      if (data.success) {
        // Il backend può rispondere con { user: ... } oppure { profile: ... }
        const profile = (data.profile || data.user) as ProfileData | null;
        if (profile) {
          this.writeLocalProfile(profile);
        }
        return profile ?? null;
      }
      return null;
    } catch (error) {
      console.error('❌ Errore connessione API profilo:', error);
      return null;
    }
  }

  private async pushProfileToServer(profile: ProfileData): Promise<boolean> {
  console.log('[DEBUG] Profilo inviato al backend:', profile);
    const authHeaders = this.getAuthHeaders();
    if (!authHeaders.Authorization) {
      return false;
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/profile`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ profile }),
      });

      if (!response.ok) {
        let details: any = null;
        try { details = await response.json(); } catch {}
        console.warn('❌ Errore salvataggio profilo:', response.status, details?.message ?? '', details?.prismaCode ?? '');
        return false;
      }

      const data = await response.json();
      return Boolean(data.success);
    } catch (error) {
      console.error('❌ Errore salvataggio profilo:', error);
      return false;
    }
  }

  async getProfile(): Promise<ProfileData | null> {
    const serverProfile = await this.fetchProfileFromServer();
    if (serverProfile) {
      return serverProfile;
    }
    return this.readLocalProfile();
  }

  async saveProfile(profile: ProfileData): Promise<boolean> {
    this.writeLocalProfile(profile);
    this.markPendingSync();
    const saved = await this.pushProfileToServer(profile);
    if (saved) {
      this.clearPendingSync();
    }
    return saved;
  }

  async syncProfile(options: { prefer?: 'server' | 'local' } = {}): Promise<{ profile: ProfileData; source: 'server' | 'local' } | null> {
    const prefer = options.prefer ?? 'server';
    const localProfile = this.readLocalProfile();

    if (prefer === 'local') {
      if (localProfile) {
        const pushed = await this.pushProfileToServer(localProfile);
        if (pushed) {
          this.clearPendingSync();
        } else {
          this.markPendingSync();
        }
        return { profile: localProfile, source: 'local' };
      }

      const serverProfile = await this.fetchProfileFromServer();
      if (serverProfile) {
        return { profile: serverProfile, source: 'server' };
      }

      return null;
    }

    const serverProfile = await this.fetchProfileFromServer();
    if (serverProfile) {
      return { profile: serverProfile, source: 'server' };
    }

    if (localProfile) {
      this.markPendingSync();
      const pushed = await this.pushProfileToServer(localProfile);
      if (pushed) {
        this.clearPendingSync();
      }
      return { profile: localProfile, source: 'local' };
    }

    return null;
  }

  async repairProfile(): Promise<{ success: boolean; message?: string }> {
    // Con un singolo profilo l'endpoint di repair diventa un no-op
    return { success: true };
  }
}

export const profileApiService = new ProfileApiService();