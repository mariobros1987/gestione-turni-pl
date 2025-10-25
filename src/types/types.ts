// --- TIPI DI DATI ---
export interface BaseEntry {
    id: string;
    date: string;
    notes: string;
    type: 'ferie' | 'permessi' | 'straordinario' | 'reperibilita' | 'progetto' | 'appuntamento';
}

export interface HolidayEntry extends BaseEntry {
    type: 'ferie';
    value: number; // giorni
}

export type PermitCategory = 'L.104' | 'Studio' | 'Sindacale' | 'Personale';
export interface PermitEntry extends BaseEntry {
    type: 'permessi';
    value: number; // ore
    startTime: string;
    endTime: string;
    category: PermitCategory;
}

export type OvertimeTimeSlot = 'Diurno' | 'Notturno' | 'Festivo';
export type OvertimeDestination = 'pagamento' | 'recupero';
export interface OvertimeEntry extends BaseEntry {
    type: 'straordinario';
    value: number; // ore
    startTime: string;
    endTime: string;
    timeSlot: OvertimeTimeSlot;
    destination: OvertimeDestination;
}

export type OnCallType = 'Feriale' | 'Festiva';
export interface OnCallEntry extends BaseEntry {
    type: 'reperibilita';
    value: number; // ore
    startTime: string;
    endTime: string;
    onCallType: OnCallType;
}

export interface ProjectEntry extends BaseEntry {
    type: 'progetto';
    value: number; // ore
    startTime: string;
    endTime: string;
}

export interface AppointmentEntry extends BaseEntry {
    type: 'appuntamento';
    title: string;
    startTime: string;
    endTime: string;
    value: number; // Ore calcolate
}

export type AllEntryTypes = HolidayEntry | PermitEntry | OvertimeEntry | OnCallEntry | ProjectEntry | AppointmentEntry;

// --- NUOVI TIPI PER I TURNI ---
export type ShiftDefinition = Record<string, { start: string; end:string; }>;

export interface Shift {
    dayOfWeek: string;
    name: string;
    start: string;
    end: string;
}

export interface ShiftOverride {
    name: string;
    start: string;
    end: string;
}

// --- NUOVI TIPI PER CHECK-IN BASATO SU POSIZIONE ---
export interface WorkLocation {
    name: string; // Nome della sede
    address: string;
    lat: number;
    lon: number;
    radius: number; // in metri
}

export interface CheckInEntry {
    id: string;
    timestamp: string; // ISO string
    type: 'entrata' | 'uscita';
}


// --- TIPO PER IMPOSTAZIONI STIPENDIO ---
export interface SalarySettings {
    baseRate: number;
    overtimeDiurnoRate: number;
    overtimeNotturnoRate: number;
    overtimeFestivoRate: number;
    onCallFerialeRate: number;
    onCallFestivaRate: number;
    projectRate: number;
}

// --- TIPI PER DASHBOARD PERSONALIZZABILE ---
export interface WidgetConfig {
    id: string;
    type: string; // e.g., 'remainingHolidays', 'overtimeHoursThisMonth', 'reminders'
    // Per widget onCall, può contenere entries
    entries?: OnCallEntry[];
}

// --- TIPO PER SUGGERIMENTI AI ---
export interface AiInsightResponse {
    type: 'warning' | 'tip' | 'info' | 'none';
    message: string;
}


// --- TIPO PER I DATI DEL PROFILO ---
export interface ProfileData {
    holidays: HolidayEntry[];
    permits: PermitEntry[];
    overtime: OvertimeEntry[];
    onCall: OnCallEntry[];
    projects: ProjectEntry[];
    appointments: AppointmentEntry[];
    shiftOverrides: Record<string, ShiftOverride>;
    workLocation: WorkLocation | null;
    checkIns: CheckInEntry[];
    
    totalCurrentYearHolidays: number;
    totalPreviousYearsHolidays: number;
    onCallFilterName: string;
    shiftPattern: string;
    shiftDefinitions: ShiftDefinition;
    cycleStartDate: string;
    cycleEndDate?: string | null;
    salarySettings: SalarySettings;
    
    netSalary: {
        ral: number;
        addRegionale: number;
        addComunale: number;
        detrazioniFamiliari: number;
        bonusIrpef: number;
    };
    
    reminderDays: number;
    sentNotifications: string[];

    view?: 'dashboard' | 'grid' | 'calendar' | 'report'; // ora opzionale, gestito localmente
    calendarFilters: Record<string, boolean>;
    collapsedCards: {
        holidays: boolean;
        permits: boolean;
        overtime: boolean;
        onCall: boolean;
        projects: boolean;
        shifts: boolean;
        salarySettings: boolean;
        payroll: boolean;
        netSalary: boolean;
        reminders: boolean;
        dataManagement: boolean;
        workLocation: boolean;
        checkIn: boolean;
        nfcReport: boolean;
    };
    operativeCardOrder: string[];
    economicCardOrder: string[];
    dashboardLayout: WidgetConfig[];
}

// --- PROPS GENERICHE PER LE CARD ---
export interface CardProps<T extends AllEntryTypes> {
    entries: T[];
    setEntries: (entries: T[]) => void;
}

export interface CollapsibleCardProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}