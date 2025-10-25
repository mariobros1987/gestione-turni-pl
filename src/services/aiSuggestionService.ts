import { GoogleGenAI, Type } from "@google/genai";
import { ProfileData, AllEntryTypes, OvertimeEntry, HolidayEntry, AiInsightResponse, PermitEntry, ProjectEntry, Shift, ShiftDefinition } from "../types/types";
import { parseDateAsUTC } from "../utils/dateUtils";

// Sistema di gestione quota AI
interface QuotaState {
    dailyRequests: number;
    lastResetDate: string;
    isQuotaExceeded: boolean;
    nextRetryTime: number;
}

const QUOTA_KEY = 'ai_quota_state';
const MAX_DAILY_REQUESTS = 200;
const RETRY_COOLDOWN = 5 * 60 * 1000;

class AIQuotaManager {
    private getQuotaState(): QuotaState {
        const stored = localStorage.getItem(QUOTA_KEY);
        const today = new Date().toISOString().split('T')[0];
        
        if (!stored) {
            return {
                dailyRequests: 0,
                lastResetDate: today,
                isQuotaExceeded: false,
                nextRetryTime: 0
            };
        }
        
        const state: QuotaState = JSON.parse(stored);
        
        if (state.lastResetDate !== today) {
            state.dailyRequests = 0;
            state.lastResetDate = today;
            state.isQuotaExceeded = false;
            state.nextRetryTime = 0;
        }
        
        return state;
    }
    
    private saveQuotaState(state: QuotaState): void {
        localStorage.setItem(QUOTA_KEY, JSON.stringify(state));
    }
    
    canMakeRequest(): boolean {
        const state = this.getQuotaState();
        const now = Date.now();
        
        if (state.isQuotaExceeded && now < state.nextRetryTime) {
            return false;
        }
        
        if (state.dailyRequests >= MAX_DAILY_REQUESTS) {
            return false;
        }
        
        return true;
    }
    
    recordRequest(): void {
        const state = this.getQuotaState();
        state.dailyRequests++;
        this.saveQuotaState(state);
    }
    
    recordQuotaExceeded(): void {
        const state = this.getQuotaState();
        state.isQuotaExceeded = true;
        state.nextRetryTime = Date.now() + RETRY_COOLDOWN;
        this.saveQuotaState(state);
    }
    
    getRemainingRequests(): number {
        const state = this.getQuotaState();
        return Math.max(0, MAX_DAILY_REQUESTS - state.dailyRequests);
    }
}

const quotaManager = new AIQuotaManager();

const getApiKey = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Funzionalità AI non configurata. La chiave API non è stata trovata.");
    }
    return apiKey;
};

const safeAICall = async <T>(aiFunction: () => Promise<T>, fallbackData?: T): Promise<T> => {
    if (!quotaManager.canMakeRequest()) {
        const remaining = quotaManager.getRemainingRequests();
        console.warn(`⚠️ Quota AI esaurita. Richieste rimanenti oggi: ${remaining}`);
        
        if (fallbackData) {
            return fallbackData;
        }
        
        throw new Error("Quota giornaliera API AI esaurita. Riprova domani o usa la modalità manuale.");
    }
    
    try {
        quotaManager.recordRequest();
        const result = await aiFunction();
        return result;
    } catch (error: any) {
        if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
            quotaManager.recordQuotaExceeded();
            console.error('🚫 Quota API Gemini esaurita:', error.message);
            
            if (fallbackData) {
                return fallbackData;
            }
            
            throw new Error("Quota giornaliera API esaurita. La funzionalità AI sarà disponibile domani.");
        }
        
        throw error;
    }
};

export const parseEventWithAI = async (prompt: string): Promise<Partial<AllEntryTypes> & { type: AllEntryTypes['type'] }> => {
    return await safeAICall(async () => {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const fullPrompt = `Sei un assistente per la creazione di eventi per un agente di Polizia Locale. Analizza il testo fornito dall'utente per estrarre i dettagli di un singolo evento e restituiscili in formato JSON.

**Contesto Temporale:**
- La data di oggi è: ${today.toLocaleDateString('it-IT')} (${today.toISOString().split('T')[0]})
- La data di domani è: ${tomorrow.toLocaleDateString('it-IT')} (${tomorrow.toISOString().split('T')[0]})

**Regole di Estrazione:**
1. **Tipo di Evento**: Identifica il tipo di evento principale (permessi, straordinario, appuntamento, etc.). Se non è chiaro, usa 'appuntamento'.
2. **Data**: Risolvi date relative come "domani", "venerdì", "il 15" nel contesto del mese corrente. Restituisci sempre la data completa in formato **YYYY-MM-DD**.
3. **Orari**: Estrai l'ora di inizio e di fine. Se viene menzionata solo un'ora, considerala come ora di inizio.
4. **Dettagli Specifici**: Estrai dettagli come la categoria per i permessi (es. "L.104"), la fascia per lo straordinario (es. "Notturno"), o il titolo per un appuntamento. Se non specificati, usa un valore di default ragionevole.
5. **Note**: Qualsiasi testo descrittivo rimanente va inserito nelle note.

**Testo da analizzare**: "${prompt}"

Restituisci solo il JSON secondo lo schema fornito.`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, enum: ['ferie', 'permessi', 'straordinario', 'reperibilita', 'progetto', 'appuntamento'] },
                date: { type: Type.STRING, description: 'La data dell\'evento in formato YYYY-MM-DD. Risolvi date relative come "domani".' },
                startTime: { type: Type.STRING, description: 'L\'ora di inizio in formato HH:MM.' },
                endTime: { type: Type.STRING, description: 'L\'ora di fine in formato HH:MM.' },
                notes: { type: Type.STRING, description: 'Note o descrizione dell\'evento.' },
                title: { type: Type.STRING, description: 'Titolo, solo per appuntamenti.' },
                category: { type: Type.STRING, enum: ['Personale', 'L.104', 'Studio', 'Sindacale'], description: 'Categoria, solo per permessi.' },
                timeSlot: { type: Type.STRING, enum: ['Diurno', 'Notturno', 'Festivo'], description: 'Fascia, solo per straordinario.' },
                destination: { type: Type.STRING, enum: ['pagamento', 'recupero'], description: 'Destinazione, solo per straordinario.' },
                onCallType: { type: Type.STRING, enum: ['Feriale', 'Festiva'], description: 'Tipo, solo per reperibilità.' },
            },
            required: ['type', 'date']
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });
        const jsonStr = response.text?.trim() || '';
        return JSON.parse(jsonStr);
    });
};

export const getAiSuggestion = async (profileData: ProfileData, allEvents: AllEntryTypes[]): Promise<AiInsightResponse> => {
    const fallbackSuggestion: AiInsightResponse = {
        type: 'info',
        message: 'Servizio AI temporaneamente non disponibile. I tuoi dati sembrano sotto controllo!'
    };
    
    return await safeAICall(async () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const overtimeEvents = allEvents.filter(e => e.type === 'straordinario') as OvertimeEntry[];
        const holidayEvents = allEvents.filter(e => e.type === 'ferie') as HolidayEntry[];
        
        const recentActivitySummary = {
            overtimeHours: allEvents.filter(e => e.type === 'straordinario' && parseDateAsUTC(e.date) >= thirtyDaysAgo).reduce((s, e) => s + e.value, 0),
            permitHours: allEvents.filter(e => e.type === 'permessi' && parseDateAsUTC(e.date) >= thirtyDaysAgo).reduce((s, e) => s + e.value, 0),
            projectHours: allEvents.filter(e => e.type === 'progetto' && parseDateAsUTC(e.date) >= thirtyDaysAgo).reduce((s, e) => s + e.value, 0),
        };

        const overtimeHoursThisMonth = overtimeEvents
            .filter(e => {
                const d = parseDateAsUTC(e.date);
                return d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear;
            })
            .reduce((sum, e) => sum + e.value, 0);

        const overtimeByMonth: { [key: string]: number } = {};
        overtimeEvents.forEach(e => {
            const d = parseDateAsUTC(e.date);
            const monthKey = e.date.substring(0, 7);
            if (d.getUTCFullYear() < currentYear || (d.getUTCFullYear() === currentYear && d.getUTCMonth() < currentMonth)) {
                 if (!overtimeByMonth[monthKey]) overtimeByMonth[monthKey] = 0;
                 overtimeByMonth[monthKey] += e.value;
            }
        });
        const monthlyTotals = Object.values(overtimeByMonth);
        const averageMonthlyOvertime = monthlyTotals.length > 0
            ? monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length
            : 0;

        let daysSinceLastHoliday = 9999;
        if (holidayEvents.length > 0) {
            const lastHoliday = holidayEvents.sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime())[0];
            const lastHolidayEndDate = parseDateAsUTC(lastHoliday.date);
            lastHolidayEndDate.setUTCDate(lastHolidayEndDate.getUTCDate() + lastHoliday.value - 1);
            
            if (lastHolidayEndDate < now) {
                const diffTime = now.getTime() - lastHolidayEndDate.getTime();
                daysSinceLastHoliday = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            } else {
                daysSinceLastHoliday = 0;
            }
        }
        
        const usedHolidays = profileData.holidays.reduce((sum, entry) => sum + entry.value, 0);
        const remainingHolidays = (profileData.totalCurrentYearHolidays + profileData.totalPreviousYearsHolidays) - usedHolidays;
        const recoveryOvertimeHours = overtimeEvents.filter(e => e.destination === 'recupero').reduce((sum, e) => sum + e.value, 0);

        const prompt = `Sei un assistente personale per un agente di Polizia Locale, il tuo obiettivo è analizzare i suoi dati di lavoro per fornire un singolo suggerimento proattivo, mirato al suo benessere e alla gestione efficiente delle sue risorse.

**Dati dell'Utente:**
- Ore di straordinario questo mese: ${overtimeHoursThisMonth.toFixed(1)}
- Media ore di straordinario mensile (storica): ${averageMonthlyOvertime.toFixed(1)}
- Giorni dall'ultimo giorno di ferie: ${daysSinceLastHoliday}
- Ferie totali residue: ${remainingHolidays} giorni
- Ore di straordinario accumulate da recuperare: ${recoveryOvertimeHours.toFixed(1)}
- Riepilogo attività ultimi 30 giorni: ${recentActivitySummary.overtimeHours.toFixed(1)} ore di straordinario, ${recentActivitySummary.permitHours.toFixed(1)} ore di permesso, ${recentActivitySummary.projectHours.toFixed(1)} ore di progetto.

**Regole di Analisi (segui questa priorità per scegliere il suggerimento più importante):**

1. **RISCHIO BURNOUT (Priorità Massima - warning)**: Se lo straordinario di questo mese è superiore a 15 ore E sono passati più di 120 giorni dall'ultima vacanza, è un segnale di allarme.
2. **GESTIONE RECUPERO ORE (Priorità Alta - tip)**: Se le ore di straordinario da recuperare superano le 16 ore, consiglia di utilizzarle.
3. **NECESSITÀ DI FERIE (Priorità Media - tip)**: Se sono passati più di 150 giorni dall'ultima vacanza E ci sono più di 10 giorni di ferie residue, suggerisci di pianificare una vacanza.
4. **ANOMALIA STRAORDINARI (Priorità Bassa - warning)**: Se lo straordinario di questo mese è superiore del 50% rispetto alla media storica E supera le 10 ore.
5. **RINFORZO POSITIVO (Priorità Bassa - info)**: Se l'utente è tornato dalle ferie da meno di 10 giorni, dagli un feedback positivo.
6. **DEFAULT (Nessuna Anomalia - none)**: Se nessuna delle condizioni sopra è soddisfatta, restituisci un messaggio che indica che la situazione è sotto controllo.

Fornisci la risposta esclusivamente in formato JSON, seguendo lo schema specificato, scegliendo una sola delle situazioni sopra descritte.`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                type: {
                    type: Type.STRING,
                    description: 'Il tipo di suggerimento: "warning", "tip", "info", o "none".'
                },
                message: {
                    type: Type.STRING,
                    description: 'Il messaggio da mostrare all\'utente.'
                }
            },
            required: ['type', 'message']
        };

        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });

        const jsonStr = response.text?.trim() || '';
        const result = JSON.parse(jsonStr) as AiInsightResponse;
        return result;
    }, fallbackSuggestion);
};

export const parseShiftPatternWithAI = async (prompt: string, definitions: ShiftDefinition): Promise<Shift> => {
    return await safeAICall(async () => {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });

        const fullPrompt = `Sei un assistente per la configurazione di schemi di turni. Analizza il testo fornito dall'utente, che descrive un singolo giorno di turno, ed estrai i dati in formato JSON.

**Orari di Default (da usare se non specificati nel testo):**
- Mattina: Inizio ${definitions.Mattina.start}, Fine ${definitions.Mattina.end}
- Pomeriggio: Inizio ${definitions.Pomeriggio.start}, Fine ${definitions.Pomeriggio.end}
- Notte: Inizio ${definitions.Notte.start}, Fine ${definitions.Notte.end}
- Riposo: Nessun orario

**Regole di Estrazione:**
1. **Giorno della Settimana (dayOfWeek)**: Identifica il giorno della settimana (es. "Lunedì", "Martedì", etc.). Deve essere uno dei sette giorni.
2. **Tipo di Turno (name)**: Identifica il tipo di turno. Deve essere uno tra "Mattina", "Pomeriggio", "Notte", "Riposo".
3. **Orari (start, end)**: Estrai l'ora di inizio e di fine in formato HH:MM. Se non sono specificati, usa gli orari di default corrispondenti al tipo di turno. Per "Riposo", lascia gli orari vuoti.

**Testo da analizzare**: "${prompt}"

Restituisci solo l'oggetto JSON strutturato secondo lo schema.`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                dayOfWeek: { type: Type.STRING, description: 'Il giorno della settimana (es. Lunedì).' },
                name: { type: Type.STRING, enum: ['Mattina', 'Pomeriggio', 'Notte', 'Riposo'], description: 'Il nome del turno.' },
                start: { type: Type.STRING, description: 'L\'ora di inizio in formato HH:MM. Stringa vuota per Riposo.' },
                end: { type: Type.STRING, description: 'L\'ora di fine in formato HH:MM. Stringa vuota per Riposo.' }
            },
            required: ['dayOfWeek', 'name', 'start', 'end']
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });
        const jsonStr = response.text?.trim() || '';
        return JSON.parse(jsonStr) as Shift;
    });
};

export const getAIQuotaStatus = () => {
    return {
        canMakeRequest: quotaManager.canMakeRequest(),
        remainingRequests: quotaManager.getRemainingRequests(),
        maxDailyRequests: MAX_DAILY_REQUESTS
    };
};