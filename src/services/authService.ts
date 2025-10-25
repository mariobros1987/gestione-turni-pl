// Import del nuovo servizio API
import { authService as apiAuthService } from './apiAuthService'

// Servizio per la gestione dell'autenticazione e degli utenti
export interface UserData {
    id: string;
    email: string;
    passwordHash?: string; // Reso opzionale per compatibilità API
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
    // Compatibilità API
    name?: string;
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

class AuthService {
    private readonly USERS_KEY = 'turni_pl_users';
    private readonly CURRENT_USER_KEY = 'turni_pl_current_user';
    private useApi = true; // FORZATO: Usa sempre l'API in produzione

    constructor() {
        // Controlla se l'API è disponibile all'avvio, ma preferisce sempre l'API
        this.checkApiAvailability();
    }

    private async checkApiAvailability() {
        try {
            const isHealthy = await apiAuthService.checkApiHealth();
            this.useApi = isHealthy;
            console.log(`🔧 AuthService: ${this.useApi ? 'API mode (FORCED)' : 'localStorage mode (fallback)'}`);
            
            // In produzione, forza sempre API se il database è disponibile
            if (window.location.hostname !== 'localhost') {
                this.useApi = true;
                console.log('🌐 Produzione rilevata: forzo API mode');
            }
        } catch {
            // Solo in sviluppo locale usa localStorage
            this.useApi = window.location.hostname === 'localhost';
            console.log(`🔧 AuthService: ${this.useApi ? 'localStorage mode (sviluppo)' : 'API mode (produzione fallback)'}`);
        }
    }

    // Simulazione di hash della password (in produzione usare una libreria come bcrypt)
    private hashPassword(password: string): string {
        // Questa è solo una simulazione - NON usare in produzione
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    private validatePassword(password: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        if (password.length < 8) {
            errors.push('La password deve essere di almeno 8 caratteri');
        }
        
        if (!/[A-Z]/.test(password)) {
            errors.push('La password deve contenere almeno una lettera maiuscola');
        }
        
        if (!/[a-z]/.test(password)) {
            errors.push('La password deve contenere almeno una lettera minuscola');
        }
        
        if (!/[0-9]/.test(password)) {
            errors.push('La password deve contenere almeno un numero');
        }
        
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('La password deve contenere almeno un carattere speciale');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private getUsers(): UserData[] {
        const usersJson = localStorage.getItem(this.USERS_KEY);
        return usersJson ? JSON.parse(usersJson) : [];
    }

    private saveUsers(users: UserData[]): void {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    }

    private generateUserId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    private validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    public async register(data: RegistrationData): Promise<{ success: boolean; message: string; user?: UserData }> {
        // Usa solo l'API online
        try {
            const result = await apiAuthService.register(data);
            // Se la registrazione è andata a buon fine, crea subito il profilo base
            if (result.success && result.user) {
                                // Import dinamico per evitare dipendenza circolare
                                const { profileApiService } = await import('./profileApiService');
                                // Valori di default come in getInitialProfileData di App.tsx
                                const baseProfile = {
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
                                    onCallFilterName: `${result.user.firstName} ${result.user.lastName}`,
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
                                    // view: 'dashboard', // ora gestito localmente
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
                                    operativeCardOrder: [
                                        'holidays',
                                        'permits',
                                        'overtime',
                                        'onCall',
                                        'projects',
                                        'shifts',
                                        'workLocation',
                                        'checkIn',
                                    ],
                                    economicCardOrder: [
                                        'payroll',
                                        'reminders',
                                        'netSalary',
                                        'salarySettings',
                                        'dataManagement',
                                    ],
                                    dashboardLayout: [
                                        { id: 'w_ai_insights', type: 'aiInsights' },
                                        { id: 'w_holidays', type: 'remainingHolidays' },
                                        { id: 'w_overtime', type: 'overtimeHoursThisMonth' },
                                        { id: 'w_permits', type: 'permitHoursThisMonth' },
                                        { id: 'w_projects', type: 'projectHoursThisMonth' },
                                        { id: 'w_reminders', type: 'reminders' },
                                    ],
                                };
                                await profileApiService.saveProfile(baseProfile);
            }
            return result;
        } catch (error) {
            let msg = 'Errore API: ';
            if (typeof error === 'string') msg += error;
            else if (error && typeof error === 'object' && 'message' in error) msg += (error as any).message;
            else msg += JSON.stringify(error);
            return { success: false, message: msg };
        }

        // Fallback al sistema localStorage originale
        try {
            // Validazione email
            if (!this.validateEmail(data.email)) {
                return { success: false, message: 'Email non valida' };
            }

            // Validazione password
            const passwordValidation = this.validatePassword(data.password);
            if (!passwordValidation.isValid) {
                return { 
                    success: false, 
                    message: 'Password non valida:\n' + passwordValidation.errors.join('\n') 
                };
            }

            // Verifica che le password coincidano
            if (data.password !== data.confirmPassword) {
                return { success: false, message: 'Le password non coincidono' };
            }

            // Verifica che l'email non sia già in uso
            const users = this.getUsers();
            if (users.find((user: UserData) => user.email.toLowerCase() === data.email.toLowerCase())) {
                return { success: false, message: 'Email già registrata' };
            }

            // Verifica che il numero di matricola non sia già in uso
            if (users.find((user: UserData) => user.badgeNumber === data.badgeNumber)) {
                return { success: false, message: 'Numero di matricola già registrato' };
            }

            // Validazione campi obbligatori
            if (!data.firstName.trim() || !data.lastName.trim() || !data.badgeNumber.trim() || !data.department.trim()) {
                return { success: false, message: 'Tutti i campi obbligatori devono essere compilati' };
            }

            // Creazione nuovo utente
            const newUser: UserData = {
                id: this.generateUserId(),
                email: data.email.toLowerCase(),
                passwordHash: this.hashPassword(data.password),
                createdAt: new Date().toISOString(),
                firstName: data.firstName.trim(),
                lastName: data.lastName.trim(),
                badgeNumber: data.badgeNumber.trim(),
                department: data.department.trim(),
                rank: data.rank?.trim() || '',
                phoneNumber: data.phoneNumber?.trim() || '',
                isVerified: false,
                isActive: true
            };

            // Salvataggio
            users.push(newUser);
            this.saveUsers(users);

            console.log('=== DEBUG REGISTRAZIONE ===');
            console.log('Nuovo utente creato:', {
                email: newUser.email,
                nome: `${newUser.firstName} ${newUser.lastName}`,
                passwordHash: newUser.passwordHash
            });
            console.log('Totale utenti dopo registrazione:', users.length);
            console.log('========================');

            return { 
                success: true, 
                message: 'Registrazione completata con successo!', 
                user: newUser !== undefined ? newUser : undefined
            };

        } catch (error) {
            console.error('Errore durante la registrazione:', error);
            return { success: false, message: 'Errore durante la registrazione. Riprova.' };
        }
    }

    public async login(credentials: LoginCredentials): Promise<{ success: boolean; message: string; user?: UserData }> {
        // Usa solo l'API online
        try {
            const result = await apiAuthService.login(credentials);
            return result;
        } catch (error) {
            let msg = 'Errore API: ';
            if (typeof error === 'string') msg += error;
            else if (error && typeof error === 'object' && 'message' in error) msg += (error as any).message;
            else msg += JSON.stringify(error);
            return { success: false, message: msg };
        }

        // Fallback al sistema localStorage originale
        try {
            console.log('=== DEBUG LOGIN ===');
            console.log('Email inserita:', credentials.email);
            console.log('Password inserita:', credentials.password);
            
            const users = this.getUsers();
            console.log('Utenti trovati nel localStorage:', users.length);
            
            const passwordHash = this.hashPassword(credentials.password);
            console.log('Hash della password inserita:', passwordHash);
            
            const user = users.find((u: UserData) => 
                u.email.toLowerCase() === credentials.email.toLowerCase() && 
                u.passwordHash === passwordHash
            );

            console.log('Utente trovato:', user ? 'SÌ' : 'NO');
            
            if (!user) {
                // Debug: mostra tutti gli utenti per confronto
                users.forEach((u: UserData, index: number) => {
                    console.log(`Utente ${index + 1}:`, {
                        email: u.email,
                        emailMatch: u.email.toLowerCase() === credentials.email.toLowerCase(),
                        passwordHashSalvato: u.passwordHash,
                        passwordHashInserito: passwordHash,
                        passwordMatch: u.passwordHash === passwordHash,
                        nomeCompleto: `${u.firstName} ${u.lastName}`
                    });
                });
                return { success: false, message: 'Email o password non corretti' };
            }

            if (user) {
                if (!user!.isActive) {
                    return { success: false, message: 'Account disattivato. Contatta l\'amministratore.' };
                }
                user!.lastLogin = new Date().toISOString();
                this.saveUsers(users);
                // Salva utente corrente
                localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
                return { 
                    success: true, 
                    message: 'Login effettuato con successo!', 
                    user: user
                };
            }

        } catch (error) {
            console.error('Errore durante il login:', error);
            return { success: false, message: 'Errore durante il login. Riprova.' };
        }
    }

    public getCurrentUser(): UserData | null {
        const userJson = localStorage.getItem(this.CURRENT_USER_KEY);
        return userJson ? JSON.parse(userJson) : null;
    }

    public logout(): void {
        localStorage.removeItem(this.CURRENT_USER_KEY);
    }

    public isLoggedIn(): boolean {
        return this.getCurrentUser() !== null;
    }

    public updateUserProfile(updates: Partial<UserData>): { success: boolean; message: string } {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                return { success: false, message: 'Utente non autenticato' };
            }

            const users = this.getUsers();
            const userIndex = users.findIndex((u: UserData) => u.id === currentUser.id);
            
            if (userIndex === -1) {
                return { success: false, message: 'Utente non trovato' };
            }

            // Aggiorna i dati
            users[userIndex] = { ...users[userIndex], ...updates };
            this.saveUsers(users);

            // Aggiorna utente corrente
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(users[userIndex]));

            return { success: true, message: 'Profilo aggiornato con successo!' };

        } catch (error) {
            console.error('Errore durante l\'aggiornamento del profilo:', error);
            return { success: false, message: 'Errore durante l\'aggiornamento. Riprova.' };
        }
    }

    public changePassword(currentPassword: string, newPassword: string): { success: boolean; message: string } {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                return { success: false, message: 'Utente non autenticato' };
            }

            // Verifica password corrente
            if (currentUser.passwordHash !== this.hashPassword(currentPassword)) {
                return { success: false, message: 'Password corrente non corretta' };
            }

            // Validazione nuova password
            const passwordValidation = this.validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return { 
                    success: false, 
                    message: 'Nuova password non valida:\n' + passwordValidation.errors.join('\n') 
                };
            }

            // Aggiorna password
            const users = this.getUsers();
            const userIndex = users.findIndex((u: UserData) => u.id === currentUser.id);
            
            if (userIndex === -1) {
                return { success: false, message: 'Utente non trovato' };
            }

            users[userIndex].passwordHash = this.hashPassword(newPassword);
            this.saveUsers(users);

            // Aggiorna utente corrente
            localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(users[userIndex]));

            return { success: true, message: 'Password cambiata con successo!' };

        } catch (error) {
            console.error('Errore durante il cambio password:', error);
            return { success: false, message: 'Errore durante il cambio password. Riprova.' };
        }
    }

    public getAllUsers(): UserData[] {
        return this.getUsers();
    }

    public getUserStats(): { totalUsers: number; activeUsers: number; recentRegistrations: number } {
        const users = this.getUsers();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return {
            totalUsers: users.length,
            activeUsers: users.filter((u: UserData) => u.isActive).length,
            recentRegistrations: users.filter((u: UserData) => new Date(u.createdAt) >= thirtyDaysAgo).length
        };
    }

    // Funzione di debug per controllare gli utenti nel localStorage
    public debugUsers(): void {
        const users = this.getUsers();
        console.log('=== DEBUG UTENTI ===');
        console.log('Numero utenti totali:', users.length);
        console.log('Utenti nel localStorage:', users);
    users.forEach((user: UserData, index: number) => {
            console.log(`Utente ${index + 1}:`, {
                email: user.email,
                nome: `${user.firstName} ${user.lastName}`,
                matricola: user.badgeNumber,
                passwordHash: user.passwordHash,
                isActive: user.isActive
            });
        });
        console.log('==================');
    }

    // Funzione per testare l'hash di una password
    public testPasswordHash(password: string): string {
        const hash = this.hashPassword(password);
        console.log(`Password "${password}" -> Hash: ${hash}`);
        return hash;
    }

    // Funzione per creare un utente di test
    public createTestUser(): void {
        const testUser: UserData = {
            id: this.generateUserId(),
            email: 'test@polizialocale.it',
            passwordHash: this.hashPassword('123456'),
            createdAt: new Date().toISOString(),
            firstName: 'Mario',
            lastName: 'Rossi',
            badgeNumber: 'PL001',
            department: 'Polizia Locale',
            rank: 'Agente',
            phoneNumber: '123456789',
            isVerified: true,
            isActive: true
        };

        const users = this.getUsers();
        // Rimuovi utente di test esistente se presente
        const existingIndex = users.findIndex(u => u.email === testUser.email);
        if (existingIndex >= 0) {
            users.splice(existingIndex, 1);
        }
        
        users.push(testUser);
        this.saveUsers(users);
        
        console.log('✅ Utente di test creato:', {
            email: testUser.email,
            password: '123456',
            nome: `${testUser.firstName} ${testUser.lastName}`
        });
    }
}

export const authService = new AuthService();