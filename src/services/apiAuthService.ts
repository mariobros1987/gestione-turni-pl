// Nuovo servizio per l'autenticazione basata su API
export interface UserData {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    lastLogin?: string;
    // Dati dell'agente
    firstName: string;
    lastName: string;
    badgeNumber: string;
    department: string;
    rank?: string;
    phoneNumber?: string;
    // Impostazioni
    isVerified: boolean;
    isActive: boolean;
    // Compatibilità con localStorage service (non esposta nell'API)
    passwordHash?: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegistrationData {
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    badgeNumber: string;
    department: string;
    rank?: string;
    phoneNumber?: string;
}

class ApiAuthService {
    private readonly API_BASE_URL: string;
    private readonly CURRENT_USER_KEY = 'turni_pl_current_user';
    private readonly AUTH_TOKEN_KEY = 'turni_pl_auth_token';

    constructor() {
        if (typeof window !== 'undefined' && window.location?.origin) {
            this.API_BASE_URL = `${window.location.origin}/api`;
        } else if (process.env.API_BASE_URL) {
            this.API_BASE_URL = process.env.API_BASE_URL;
        } else if (process.env.VERCEL_URL) {
            this.API_BASE_URL = `https://${process.env.VERCEL_URL}/api`;
        } else {
            this.API_BASE_URL = 'http://localhost:3000/api';
        }
    }

    private async makeRequest(endpoint: string, options: RequestInit = {}) {
        const token = localStorage.getItem(this.AUTH_TOKEN_KEY);
        
    const response = await fetch(`${this.API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...options.headers,
            },
            credentials: 'include', // Include cookies
            ...options,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    public async register(data: RegistrationData): Promise<{ success: boolean; message: string; user?: UserData }> {
        try {
            const result = await this.makeRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify(data),
            });

            return result;
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Errore durante la registrazione'
            };
        }
    }

    public async login(credentials: LoginCredentials): Promise<{ success: boolean; message: string; user?: UserData }> {
        try {
            const result = await this.makeRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify(credentials),
            });

            if (result.success && result.user) {
                // Salva utente corrente e token
                localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(result.user));
                if (result.token) {
                    localStorage.setItem(this.AUTH_TOKEN_KEY, result.token);
                }
            }

            return result;
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Errore durante il login'
            };
        }
    }

    public async getCurrentUser(): Promise<UserData | null> {
        // Prima prova a verificare il token con il server
        const token = localStorage.getItem(this.AUTH_TOKEN_KEY);
        if (token) {
            try {
                const result = await this.makeRequest('/auth/verify', {
                    method: 'POST',
                    body: JSON.stringify({ token }),
                });
                
                if (result.success && result.user) {
                    // Aggiorna utente nel localStorage
                    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(result.user));
                    return result.user;
                }
            } catch (error) {
                // Token non valido, rimuovi tutto
                this.logout();
                return null;
            }
        }

        // Fallback al localStorage (per compatibilità)
        const userJson = localStorage.getItem(this.CURRENT_USER_KEY);
        return userJson ? JSON.parse(userJson) : null;
    }

    // Versione sincrona per compatibilità
    public getCurrentUserSync(): UserData | null {
        const userJson = localStorage.getItem(this.CURRENT_USER_KEY);
        return userJson ? JSON.parse(userJson) : null;
    }

    public logout(): void {
        localStorage.removeItem(this.CURRENT_USER_KEY);
        localStorage.removeItem(this.AUTH_TOKEN_KEY);
        
        // Rimuovi anche il cookie se presente (solo client-side)
        if (typeof document !== 'undefined') {
            document.cookie = 'auth_token=; Max-Age=0; Path=/';
        }
    }

    public isLoggedIn(): boolean {
        const token = localStorage.getItem(this.AUTH_TOKEN_KEY);
        const user = localStorage.getItem(this.CURRENT_USER_KEY);
        return !!(token && user);
    }

    public async updateUserProfile(updates: Partial<UserData>): Promise<{ success: boolean; message: string }> {
        try {
            const result = await this.makeRequest('/auth/profile', {
                method: 'PUT',
                body: JSON.stringify(updates),
            });

            if (result.success && result.user) {
                // Aggiorna utente corrente in localStorage
                localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(result.user));
            }

            return result;
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Errore durante l\'aggiornamento del profilo'
            };
        }
    }

    public async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        try {
            const result = await this.makeRequest('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                }),
            });

            return result;
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Errore durante il cambio password'
            };
        }
    }

    // Funzioni di utilità per il debugging
    public async checkApiHealth(): Promise<boolean> {
        try {
            await this.makeRequest('/health');
            return true;
        } catch {
            return false;
        }
    }

    // Funzione per testare la connessione API
    public async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const isHealthy = await this.checkApiHealth();
            if (isHealthy) {
                return { success: true, message: 'Connessione API funzionante' };
            } else {
                return { success: false, message: 'API non raggiungibile' };
            }
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Errore di connessione'
            };
        }
    }

    // Funzione per ottenere tutti gli utenti (solo per debug)
    public async getAllUsers(): Promise<{ success: boolean; users?: any[]; message: string }> {
        try {
            const result = await this.makeRequest('/users');
            return result;
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Errore nel recupero utenti'
            };
        }
    }

    // Funzione per controllare lo stato del database
    public async checkDatabaseStatus(): Promise<{ success: boolean; stats?: any; message: string }> {
        try {
            const result = await this.makeRequest('/health');
            return result;
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Errore nel controllo database'
            };
        }
    }

    // Funzione di test completo per la console del browser
    public async runDiagnostics(): Promise<void> {
        console.log('🔍 === DIAGNOSTICA API AUTH SERVICE ===');
        
        // Test 1: Health check
        console.log('1. Test connessione API...');
        const healthCheck = await this.checkDatabaseStatus();
        console.log(healthCheck.success ? '✅ API connessa' : '❌ API non disponibile', healthCheck);
        
        // Test 2: Lista utenti
        console.log('2. Recupero lista utenti...');
        const usersCheck = await this.getAllUsers();
        console.log(usersCheck.success ? `✅ ${usersCheck.users?.length || 0} utenti trovati` : '❌ Errore recupero utenti', usersCheck);
        
        // Test 3: Utente corrente
        console.log('3. Controllo utente corrente...');
        const currentUser = this.getCurrentUserSync();
        console.log(currentUser ? `✅ Utente loggato: ${currentUser.email}` : '⚠️ Nessun utente loggato', currentUser);
        
        console.log('🔍 === FINE DIAGNOSTICA ===');
    }
}

export const authService = new ApiAuthService();

// Espone il servizio globalmente per il debugging nella console del browser
if (typeof window !== 'undefined') {
    (window as any).authDebug = {
        service: authService,
        runDiagnostics: () => authService.runDiagnostics(),
        checkHealth: () => authService.checkDatabaseStatus(),
        getAllUsers: () => authService.getAllUsers(),
        getCurrentUser: () => authService.getCurrentUser()
    };
}