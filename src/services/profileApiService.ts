// Service per gestire i profili tramite API con fallback locale
export class ProfileApiService {
  private readonly LOCAL_KEY = 'turni_pl_profiles_data';
  private readonly PENDING_SYNC_KEY = 'turni_pl_pending_sync';
  private readonly baseUrl: string;

  constructor() {
    if (typeof window !== 'undefined' && window.location?.origin) {
      this.baseUrl = window.location.origin;
    } else if (process.env.VERCEL_URL) {
      this.baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      this.baseUrl = 'http://localhost:3000';
    }
  }

  private readLocalProfiles(): Record<string, any> {
    if (typeof window === 'undefined') {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(this.LOCAL_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn('⚠️ Lettura profili locali fallita, uso fallback vuoto', error);
      return {};
    }
  }

  private writeLocalProfiles(profiles: Record<string, any>): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(this.LOCAL_KEY, JSON.stringify(profiles));
    } catch (error) {
      console.warn('⚠️ Salvataggio profili locali fallito', error);
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

  private async fetchProfilesFromServer(): Promise<Record<string, any> | null> {
    const authHeaders = this.getAuthHeaders();
    if (!authHeaders.Authorization) {
      return null;
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/profiles`, {
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
        console.warn('❌ Errore caricamento profili:', response.status, details?.message ?? '');
        return null;
      }

      const data = await response.json();
      if (data.success) {
        this.writeLocalProfiles(data.profiles ?? {});
        return data.profiles ?? {};
      }

      return null;
    } catch (error) {
      console.error('❌ Errore connessione API profili:', error);
      return null;
    }
  }

  private async pushProfilesToServer(profiles: Record<string, any>, fullSync: boolean): Promise<boolean> {
    const authHeaders = this.getAuthHeaders();
    if (!authHeaders.Authorization) {
      return false;
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/profiles`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ profiles, fullSync }),
      });

      if (!response.ok) {
        let details: any = null;
        try { details = await response.json(); } catch {}
        console.warn('❌ Errore salvataggio profili:', response.status, details?.message ?? '', details?.prismaCode ?? '');
        return false;
      }

      const data = await response.json();
      return Boolean(data.success);
    } catch (error) {
      console.error('❌ Errore salvataggio profili:', error);
      return false;
    }
  }

  async getProfiles(): Promise<Record<string, any> | null> {
    const serverProfiles = await this.fetchProfilesFromServer();
    if (serverProfiles && Object.keys(serverProfiles).length > 0) {
      return serverProfiles;
    }
    return this.readLocalProfiles();
  }

  async saveProfiles(profiles: Record<string, any>, options: { fullSync?: boolean } = {}): Promise<boolean> {
    const fullSync = options.fullSync ?? true;
    this.writeLocalProfiles(profiles);
    this.markPendingSync();
    const saved = await this.pushProfilesToServer(profiles, fullSync);
    if (saved) {
      this.clearPendingSync();
    }
    return saved;
  }

  async syncProfiles(options: { prefer?: 'server' | 'local' } = {}): Promise<{ profiles: Record<string, any>; source: 'server' | 'local' } | null> {
    const prefer = options.prefer ?? 'server';
    const localProfiles = this.readLocalProfiles();
    const hasLocal = Object.keys(localProfiles).length > 0;
    const serverProfiles = await this.fetchProfilesFromServer();
    const hasServer = serverProfiles && Object.keys(serverProfiles).length > 0;

    if (prefer === 'local') {
      if (!hasServer && hasLocal) {
        this.markPendingSync();
        const pushed = await this.pushProfilesToServer(localProfiles, true);
        if (pushed) {
          this.clearPendingSync();
        }
        return { profiles: localProfiles, source: 'local' };
      }

      if (hasServer) {
        return { profiles: serverProfiles!, source: 'server' };
      }

      if (hasLocal) {
        return { profiles: localProfiles, source: 'local' };
      }

      return null;
    }

    if (hasServer) {
      return { profiles: serverProfiles!, source: 'server' };
    }

    if (hasLocal) {
      this.markPendingSync();
      const pushed = await this.pushProfilesToServer(localProfiles, true);
      if (pushed) {
        this.clearPendingSync();
      }
      return { profiles: localProfiles, source: 'local' };
    }

    return null;
  }

  async repairProfiles(): Promise<{ success: boolean; repaired?: number; message?: string }> {
    const authHeaders = this.getAuthHeaders();
    if (!authHeaders.Authorization) {
      return { success: false };
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/profiles/repair`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });

      if (!response.ok) {
        let details: any = null;
        try { details = await response.json(); } catch {}
        return { success: false, message: details?.message };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Errore repair profili:', error);
      return { success: false, message: error instanceof Error ? error.message : undefined };
    }
  }
}

export const profileApiService = new ProfileApiService();