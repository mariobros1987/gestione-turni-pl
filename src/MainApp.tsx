import React, { useState, useEffect, useCallback, useMemo, DragEvent } from 'react';
import { AppContext } from './AppContext';
import { ProfileData, AllEntryTypes, HolidayEntry, ShiftOverride, CheckInEntry, AppointmentEntry, OnCallEntry } from './types/types';
import { PayrollCard } from './components/PayrollCard';
import { ReminderCard } from './components/ReminderCard';
import { NetSalaryCalculatorCard } from './components/NetSalaryCalculatorCard';
import { SalarySettingsCard } from './components/SalarySettingsCard';
import { ShiftCard } from './components/ShiftCard';
import { HolidayCard } from './components/HolidayCard';
import { PermitCard } from './components/PermitCard';
import { OvertimeCard } from './components/OvertimeCard';
import { OnCallCard } from './components/OnCallCard';
import { ProjectCard } from './components/ProjectCard';
import { CalendarFilters } from './components/CalendarFilters';
import { Calendar } from './components/Calendar';

import { EventModal } from './components/modals/EventModal';
import { DayPopover } from './components/DayPopover';
import { ShiftOverrideModal } from './components/modals/ShiftOverrideModal';
import { Dashboard } from './components/Dashboard';
import { DataManagementCard } from './components/DataManagementCard';
import { Report } from './components/Report';
import { WorkLocationCard } from './components/WorkLocationCard';
import { CheckInCard } from './components/CheckInCard';
import { NfcCheckInButton } from './components/NfcCheckInButton';
import NfcReportCard from './components/NfcReportCard';
import { parseDateAsUTC, calculateHours } from './utils/dateUtils';
import { parseShiftPattern } from './utils/shiftUtils';
import { getEventTooltip, getShortEventText } from './utils/eventUtils';
import { CustomTooltip } from './components/CustomTooltip';
import { ShiftPatternModal } from './components/modals/ShiftPatternModal';
import { UserProfile } from './components/auth/UserProfile';



// --- COMPONENTE PRINCIPALE DELL'APP QUANDO UN PROFILO È ATTIVO ---

interface MainAppProps {
    profileName: string;
    profileData: ProfileData;
    onUpdateProfileData: (data: ProfileData) => void;
    onLogout: () => void;
}

export const MainApp: React.FC<MainAppProps> = ({ profileName, profileData, onUpdateProfileData, onLogout }) => {
    // Funzione per creare i setter
    const createSetter = <K extends keyof ProfileData>(key: K) => {
        return (value: ProfileData[K]) => {
            onUpdateProfileData({ ...profileData, [key]: value });
        };
    };

    // Tutti i setter
    const setHolidays = createSetter('holidays');
    const setPermits = createSetter('permits');
    const setOvertime = createSetter('overtime');
    const setOnCall = createSetter('onCall');
    const setProjects = createSetter('projects');
    const setAppointments = createSetter('appointments');
    const setShiftOverrides = createSetter('shiftOverrides');
    const setTotalCurrentYearHolidays = createSetter('totalCurrentYearHolidays');
    const setTotalPreviousYearsHolidays = createSetter('totalPreviousYearsHolidays');
    const setOnCallFilterName = createSetter('onCallFilterName');
    const setCycleStartDate = createSetter('cycleStartDate');
    const setCycleEndDate = createSetter('cycleEndDate');
    const setSalarySettings = createSetter('salarySettings');
    const setNetSalarySettings = createSetter('netSalary');
    const setReminderDays = createSetter('reminderDays');
    const setSentNotifications = createSetter('sentNotifications');
    const [view, setView] = useState<ProfileData['view']>(profileData.view || 'dashboard');
    const setCalendarFilters = createSetter('calendarFilters');
    const setCollapsedCards = createSetter('collapsedCards');
    const setWorkLocation = createSetter('workLocation');
    const setCheckIns = createSetter('checkIns');
    const setOperativeCardOrder = createSetter('operativeCardOrder');
    const setEconomicCardOrder = createSetter('economicCardOrder');
    const setDashboardLayout = createSetter('dashboardLayout');

    // --- ORA il blocco useEffect che usa setAppointments ---
    useEffect(() => {
        let polling = true;
        async function fetchCheckInsAndSyncAppointments() {
            try {
                const { supabase } = await import('./lib/supabase');
                const userJson = localStorage.getItem('turni_pl_current_user');
                const user = userJson ? JSON.parse(userJson) : null;
                if (!user) return;
                const { data, error } = await supabase
                    .from('checkin')
                    .select('*')
                    .eq('userId', user.id)
                    .order('timestamp', { ascending: true });
                console.log('DEBUG CHECKIN QUERY userId:', user.id, 'Risultato:', data, 'Errore:', error);
                if (error) return;
                // Raggruppa per giorno e crea appuntamenti "Presenza"
                const byDay: Record<string, { entrata?: any; uscita?: any }> = {};
                for (const entry of data) {
                    const date = entry.timestamp.split('T')[0];
                    if (!byDay[date]) byDay[date] = {};
                    if (entry.azione === 'entrata') byDay[date].entrata = entry;
                    if (entry.azione === 'uscita') byDay[date].uscita = entry;
                }
                const newAppointments: AppointmentEntry[] = [];
                for (const date in byDay) {
                    const entrata = byDay[date].entrata;
                    const uscita = byDay[date].uscita;
                    if (entrata && uscita) {
                        const startTime = new Date(entrata.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                        const endTime = new Date(uscita.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                        const oreLavorate = (new Date(uscita.timestamp).getTime() - new Date(entrata.timestamp).getTime()) / (1000 * 60 * 60);
                        newAppointments.push({
                            id: `${entrata.id}-${uscita.id}-presenza`,
                            date,
                            type: 'appuntamento',
                            title: 'Presenza',
                            notes: `Entrata: ${startTime} - Uscita: ${endTime}`,
                            startTime,
                            endTime,
                            value: parseFloat(oreLavorate.toFixed(2)),
                        });
                    }
                }
                // Aggiorna solo se ci sono cambiamenti
                if (JSON.stringify(newAppointments) !== JSON.stringify(profileData.appointments.filter(a => a.title === 'Presenza'))) {
                    const otherAppointments = profileData.appointments.filter(a => a.title !== 'Presenza');
                    setAppointments([...otherAppointments, ...newAppointments]);
                }
            } catch {}
        }
        fetchCheckInsAndSyncAppointments();
        const interval = setInterval(() => {
            if (polling) fetchCheckInsAndSyncAppointments();
        }, 15000);
        return () => { polling = false; clearInterval(interval); };
    }, [profileData.appointments, setAppointments]);
    // Rileva parametro azione NFC dall'URL
    const [azioneNfc, setAzioneNfc] = useState<string | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const azione = params.get('azione');
        if (azione === 'entrata' || azione === 'uscita') {
            setAzioneNfc(azione);
        } else {
            setAzioneNfc(null);
        }
    }, []);
    React.useEffect(() => {
        console.log('DEBUG MainApp - Array completo delle reperibilità:', profileData.onCall);
    }, [profileData.onCall]);
    // Safety check: profileData must not be null
    if (!profileData) {
        return <div className="profile-loading"><p>Caricamento dati profilo…</p></div>;
    }
        // --- POLLING AUTOMATICO EVENTI ---
        useEffect(() => {
            const interval = setInterval(() => {
                // Recupera il token JWT dalla localStorage
                const token = window.localStorage.getItem('turni_pl_auth_token');
                if (!token) {
                    alert('Autenticazione scaduta o non presente. Effettua di nuovo il login.');
                    clearInterval(interval);
                    return;
                }
                fetch('/api/profiles', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    cache: 'no-store'
                })
                    .then(res => {
                        if (res.status === 401) {
                            alert('Token JWT scaduto o non valido. Effettua di nuovo il login.');
                            clearInterval(interval);
                            return null;
                        }
                        return res.json();
                    })
                    .then(data => {
                        if (!data) return;
                        // Aggiorna solo il profilo attivo
                        if (data && data.success && data.profiles && data.profiles[profileName]) {
                            onUpdateProfileData(data.profiles[profileName]);
                        }
                    })
                    .catch(err => console.error('Errore polling eventi:', err));
            }, 15000); // ogni 15 secondi
            return () => clearInterval(interval);
        }, [profileName, onUpdateProfileData]);
    // Assicura che onCall sia sempre un array
    if (!Array.isArray(profileData.onCall)) {
        profileData.onCall = [];
    }
    // Stato temporaneo per sessione NFC
    const [pendingNfcEntry, setPendingNfcEntry] = React.useState<CheckInEntry | null>(null);
    // DEBUG: Mostra i check-in NFC attuali
    React.useEffect(() => {
        console.log('DEBUG CHECKINS:', profileData.checkIns);
    }, [profileData.checkIns]);
    
    // Create setters that call the main update function

    
    
    useEffect(() => {
    let polling = true;
    async function fetchCheckInsAndSyncAppointments() {
        try {
            const { supabase } = await import('./lib/supabase');
            const userJson = localStorage.getItem('turni_pl_current_user');
            const user = userJson ? JSON.parse(userJson) : null;
            if (!user) return;
            const { data, error } = await supabase
                .from('checkin')
                .select('*')
                .eq('user_id', user.id)
                .order('timestamp', { ascending: true });
            if (error) return;
            // Raggruppa per giorno e crea appuntamenti "Presenza"
            const byDay: Record<string, { entrata?: any; uscita?: any }> = {};
            for (const entry of data) {
                const date = entry.timestamp.split('T')[0];
                if (!byDay[date]) byDay[date] = {};
                if (entry.azione === 'entrata') byDay[date].entrata = entry;
                if (entry.azione === 'uscita') byDay[date].uscita = entry;
            }
            const newAppointments: AppointmentEntry[] = [];
            for (const date in byDay) {
                const entrata = byDay[date].entrata;
                const uscita = byDay[date].uscita;
                if (entrata && uscita) {
                    const startTime = new Date(entrata.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                    const endTime = new Date(uscita.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                    const oreLavorate = (new Date(uscita.timestamp).getTime() - new Date(entrata.timestamp).getTime()) / (1000 * 60 * 60);
                    newAppointments.push({
                        id: `${entrata.id}-${uscita.id}-presenza`,
                        date,
                        type: 'appuntamento',
                        title: 'Presenza',
                        notes: `Entrata: ${startTime} - Uscita: ${endTime}`,
                        startTime,
                        endTime,
                        value: parseFloat(oreLavorate.toFixed(2)),
                    });
                }
            }
            // Aggiorna solo se ci sono cambiamenti
            if (JSON.stringify(newAppointments) !== JSON.stringify(profileData.appointments.filter(a => a.title === 'Presenza'))) {
                const otherAppointments = profileData.appointments.filter(a => a.title !== 'Presenza');
                setAppointments([...otherAppointments, ...newAppointments]);
            }
        } catch {}
    }
    fetchCheckInsAndSyncAppointments();
    const interval = setInterval(() => {
        if (polling) fetchCheckInsAndSyncAppointments();
    }, 15000);
    return () => { polling = false; clearInterval(interval); };
}, [profileData.appointments, setAppointments]);

    // Local UI state (not persisted per profile)
    const [eventModalState, setEventModalState] = useState<{ mode: 'add' | 'edit'; entry: AllEntryTypes | null; date: string; type?: AllEntryTypes['type'] } | null>(null);
    const [dayPopoverData, setDayPopoverData] = useState<{ date: string, events: AllEntryTypes[], shiftOverride: ShiftOverride | null } | null>(null);
    const [shiftOverrideModalDate, setShiftOverrideModalDate] = useState<string | null>(null);
    type NotifPerm = 'default' | 'granted' | 'denied';
    const [notificationPermission, setNotificationPermission] = useState<NotifPerm>(() => {
        try {
            if (typeof window !== 'undefined' && 'Notification' in window && typeof Notification !== 'undefined') {
                return Notification.permission as NotifPerm;
            }
        } catch {}
        return 'default';
    });
    const [tooltip, setTooltip] = useState({ visible: false, content: <></>, x: 0, y: 0 });
    const [isShiftEditorOpen, setIsShiftEditorOpen] = useState(false);

    // State for drag-and-drop
    const [draggedItem, setDraggedItem] = useState<string | null>(null);
    const [dragOverItem, setDragOverItem] = useState<string | null>(null);


    const { holidays, permits, overtime, onCall, projects, appointments, shiftOverrides, calendarFilters, collapsedCards, reminderDays, sentNotifications } = profileData;

    const requestNotificationPermission = useCallback(async () => {
        if (typeof window === 'undefined' || !('Notification' in window) || typeof Notification === 'undefined') {
            alert('Questo browser non supporta le notifiche desktop.');
            return;
        }
        try {
            const permissionResult = await Notification.requestPermission();
            // Aggiorna lo stato per riflettere la scelta dell'utente
            setNotificationPermission(permissionResult);
        } catch (error) {
            console.error("Errore durante la richiesta di permesso per le notifiche:", error);
        }
    }, []);

    const toggleCollapse = (cardId: keyof ProfileData['collapsedCards']) => {
        setCollapsedCards({
            ...collapsedCards,
            [cardId]: !collapsedCards[cardId]
        });
    };
    
    const allEvents: AllEntryTypes[] = useMemo(() => 
    [
        ...holidays,
        ...permits,
        ...overtime,
        ...onCall,
        ...projects,
        ...appointments,
    ],
    [holidays, permits, overtime, onCall, projects, appointments]
    );

    const parsedShiftPattern = useMemo(() => {
        const parsed = parseShiftPattern(profileData.shiftPattern);
        // Enrich with the latest definitions
        return parsed.map(shift => {
            const definition = profileData.shiftDefinitions[shift.name];
            if (definition) {
                return { ...shift, start: definition.start, end: definition.end };
            }
            return shift;
        });
    }, [profileData.shiftPattern, profileData.shiftDefinitions]);
    
    useEffect(() => {
        if (
            notificationPermission === 'granted' &&
            typeof navigator !== 'undefined' &&
            'serviceWorker' in navigator &&
            navigator.serviceWorker &&
            navigator.serviceWorker.controller
        ) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const newSentIds: string[] = [];

            allEvents
                .filter(event => event.type !== 'straordinario' && event.type !== 'progetto')
                .forEach(event => {
                    if (!event.date) return;
                    const eventDate = parseDateAsUTC(event.date);
                    if (isNaN(eventDate.getTime())) return;

                    const diffTime = eventDate.getTime() - today.getTime();
                    const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (daysUntil >= 0 && daysUntil === reminderDays && !sentNotifications.includes(event.id)) {
                        const title = `Promemoria: ${getShortEventText(event)}`;
                        const options = {
                            body: getEventTooltip(event),
                            icon: 'icon-192.png',
                            tag: event.id
                        };
                        
                        navigator.serviceWorker.ready.then(registration => {
                            registration.showNotification(title, options);
                            newSentIds.push(event.id);
                        }).catch(err => console.error('Notification failed:', err));
                    }
                });

            if (newSentIds.length > 0) {
                setSentNotifications([...sentNotifications, ...newSentIds]);
            }
        }
    }, [allEvents, reminderDays, sentNotifications, setSentNotifications, notificationPermission]);
    
    const handleEventClick = (event: AllEntryTypes, clickedDate: string) => {
        setEventModalState({ mode: 'edit', entry: event, date: clickedDate });
    };

    const handleDayClick = (date: string, events: AllEntryTypes[], shiftOverride: ShiftOverride | null) => {
        // Unify click behavior: always open the DayPopover.
        setDayPopoverData({ date, events, shiftOverride });
    };
    
    const handleAddEventFromPopover = (type: AllEntryTypes['type'] | 'cambio_turno', date: string) => {
        setDayPopoverData(null);
        if (type === 'cambio_turno') {
            setShiftOverrideModalDate(date);
        } else {
            setEventModalState({ mode: 'add', entry: null, date: date, type: type });
        }
    };
    
    const handleSaveShiftOverride = (date: string, override: ShiftOverride) => {
        setShiftOverrides({...shiftOverrides, [date]: override });
    };
    const handleDeleteShiftOverride = (date: string) => {
        const newOverrides = {...shiftOverrides};
        delete newOverrides[date];
        setShiftOverrides(newOverrides);
    };

    const handleSaveEvent = useCallback((entryToSave: AllEntryTypes | AllEntryTypes[]) => {
        // Se ricevo un array, aggiungo tutti gli eventi in una sola operazione
        if (Array.isArray(entryToSave)) {
            // Solo reperibilità: aggiungi tutti
            const reperEntries = entryToSave.filter(ev => ev.type === 'reperibilita') as OnCallEntry[];
            if (reperEntries.length > 0) {
                setOnCall([...onCall, ...reperEntries].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));
                return;
            }
            // Per altri tipi, chiama la logica singola per ciascuno
            entryToSave.forEach(ev => handleSaveEvent(ev));
            return;
        }
        const isNew = !allEvents.some(e => e.id === entryToSave.id);
        const updater = (setter: (entries: any[]) => void, currentEntries: any[]) => {
            // Per reperibilità, aggiungi sempre senza sovrascrivere
            if (entryToSave.type === 'reperibilita') {
                setter([...currentEntries, entryToSave].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));
                return;
            }
            // Per gli altri tipi, mantieni la logica esistente
            if (isNew) {
                 setter([...currentEntries, entryToSave].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));
            } else {
                 setter( 
                    currentEntries.map(e => (e.id === entryToSave.id ? entryToSave : e))
                        .sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime())
                 );
            }
        };

        switch (entryToSave.type) {
            case 'ferie': updater(setHolidays, holidays); break;
            case 'permessi': updater(setPermits, permits); break;
            case 'straordinario': updater(setOvertime, overtime); break;
            case 'reperibilita': updater(setOnCall, onCall); break;
            case 'progetto': updater(setProjects, projects); break;
            case 'appuntamento': updater(setAppointments, appointments); break;
        }
    }, [allEvents, holidays, permits, overtime, onCall, projects, appointments, setHolidays, setPermits, setOvertime, setOnCall, setProjects, setAppointments]);
    
    const handleDeleteEntry = useCallback((id: string, type: AllEntryTypes['type']) => {
        if (type === 'appuntamento') {
            // Elimina anche i check-in NFC dal database
            const presenza = appointments.find(a => a.id === id && a.title === 'Presenza');
            if (presenza) {
                (async () => {
                    const { supabase } = await import('./lib/supabase');
                    const userJson = localStorage.getItem('turni_pl_current_user');
                    const user = userJson ? JSON.parse(userJson) : null;
                    if (user) {
                        await supabase
                          .from('checkin')
                          .delete()
                          .eq('user_id', user.id)
                          .gte('timestamp', `${presenza.date}T00:00:00`)
                          .lte('timestamp', `${presenza.date}T23:59:59`);
                    }
                })();
            }
            setAppointments(appointments.filter(e => e.id !== id));
        } else {
            switch (type) {
                case 'ferie': setHolidays(holidays.filter(e => e.id !== id)); break;
                case 'permessi': setPermits(permits.filter(e => e.id !== id)); break;
                case 'straordinario': setOvertime(overtime.filter(e => e.id !== id)); break;
                case 'reperibilita': setOnCall(onCall.filter(e => e.id !== id)); break;
                case 'progetto': setProjects(projects.filter(e => e.id !== id)); break;
            }
        }
    }, [holidays, permits, overtime, onCall, projects, appointments, setHolidays, setPermits, setOvertime, setOnCall, setProjects, setAppointments]);

    const handleSplitHoliday = useCallback((holidayEntry: HolidayEntry, dateToDeleteStr: string) => {
        const dateToDelete = parseDateAsUTC(dateToDeleteStr);
        const holidayStart = parseDateAsUTC(holidayEntry.date);

        const oneDay = 24 * 60 * 60 * 1000;
        
        const otherHolidays = holidays.filter(h => h.id !== holidayEntry.id);
        const newHolidays: HolidayEntry[] = [];

        if (holidayEntry.value <= 1) {
            setHolidays(otherHolidays); 
            return;
        }

        const dayIndexToDelete = Math.round((dateToDelete.getTime() - holidayStart.getTime()) / oneDay);

        if (dayIndexToDelete === 0) { // Eliminazione del primo giorno
            const newStartDate = new Date(holidayStart.getTime() + oneDay);
            newHolidays.push({
                ...holidayEntry,
                date: newStartDate.toISOString().split('T')[0],
                value: holidayEntry.value - 1,
            });
        } else if (dayIndexToDelete === holidayEntry.value - 1) { // Eliminazione dell'ultimo giorno
             newHolidays.push({
                ...holidayEntry,
                value: holidayEntry.value - 1,
            });
        } else if (dayIndexToDelete > 0 && dayIndexToDelete < holidayEntry.value - 1) { // Eliminazione di un giorno intermedio
            const firstPart: HolidayEntry = { ...holidayEntry, value: dayIndexToDelete };

            const newStartDate = new Date(dateToDelete.getTime() + oneDay);
            const daysAfter = holidayEntry.value - dayIndexToDelete - 1;
            
            const secondPart: HolidayEntry = {
                ...holidayEntry,
                id: new Date().toISOString(),
                date: newStartDate.toISOString().split('T')[0],
                value: daysAfter,
            };
            
            if (firstPart.value > 0) newHolidays.push(firstPart);
            if (secondPart.value > 0) newHolidays.push(secondPart);
        }
        
        setHolidays([...otherHolidays, ...newHolidays].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));

    }, [holidays, setHolidays]);

    const handleAddCheckIn = (type: 'entrata' | 'uscita', customTimestamp?: Date) => {
        const timestamp = customTimestamp ? customTimestamp.toISOString() : new Date().toISOString();
        if (type === 'entrata') {
            // Salva solo in stato temporaneo, NON visualizzare nel calendario
            setPendingNfcEntry({ id: timestamp, timestamp, type });
        } else if (type === 'uscita') {
            if (!pendingNfcEntry || pendingNfcEntry.type !== 'entrata') {
                console.warn('Non puoi registrare una uscita senza una entrata NFC aperta.');
                return;
            }
            // Crea evento unico "Presenza" con orario entrata/uscita
            const tEntrata = new Date(pendingNfcEntry.timestamp);
            const tUscita = customTimestamp ? customTimestamp : new Date();
            const startTime = tEntrata.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            const endTime = tUscita.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            const dateStr = tEntrata.toISOString().split('T')[0];
            const oreLavorate = (tUscita.getTime() - tEntrata.getTime()) / (1000 * 60 * 60);
            const newAppointment = {
                id: `${pendingNfcEntry.id}-${timestamp}-presenza`,
                date: dateStr,
                type: 'appuntamento' as const,
                title: 'Presenza',
                notes: `Entrata: ${startTime} - Uscita: ${endTime}`,
                startTime,
                endTime,
                value: parseFloat(oreLavorate.toFixed(2)),
            };
            setAppointments([...profileData.appointments, newAppointment]);
            setPendingNfcEntry(null);
        }
    };

    const handleCreateEventFromNfc = (type: 'entrata' | 'uscita', timestamp: Date) => {
        const dateStr = timestamp.toISOString().split('T')[0];
        const hours = timestamp.getHours();
        const minutes = timestamp.getMinutes();
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const location = profileData.workLocation?.name || 'Sede principale';
        
        const title = type === 'entrata' 
            ? `🏢 Entrata presso ${location}`
            : `🚪 Uscita da ${location}`;
        
        // Crea l'evento con un slot di 15 minuti
        const endTime = new Date(timestamp);
        endTime.setMinutes(endTime.getMinutes() + 15);
        const endTimeStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
        
        const newAppointment: AppointmentEntry = {
            id: `${timestamp.toISOString()}-nfc-${type}`,
            date: dateStr,
            type: 'appuntamento',
            title,
            notes: `Registrazione automatica NFC alle ore ${timeStr}`,
            startTime: timeStr,
            endTime: endTimeStr,
            value: 0.25, // 15 minuti = 0.25 ore
        };
        
        setAppointments([...profileData.appointments, newAppointment]);
        console.log(`✅ Evento calendario creato: ${title} alle ${timeStr}`);
    };

    const handleDeleteCheckIn = (id: string) => {
        setCheckIns(profileData.checkIns.filter(c => c.id !== id));
    };

    const handleOpenModalWithAiData = (aiData: Partial<AllEntryTypes> & { type: AllEntryTypes['type'] }) => {
        const type = aiData.type;
        const date = aiData.date || new Date().toISOString().split('T')[0];

        const base = { id: '', date: date, notes: '' };
        let defaultEntry: AllEntryTypes;
        switch (type) {
            case 'ferie':
                defaultEntry = { ...base, type: 'ferie', value: 1 };
                break;
            case 'permessi':
                defaultEntry = { ...base, type: 'permessi', value: 0, startTime: '08:00', endTime: '09:00', category: 'Personale' };
                break;
            case 'straordinario':
                defaultEntry = { ...base, type: 'straordinario', value: 0, startTime: '14:00', endTime: '15:00', timeSlot: 'Diurno', destination: 'pagamento' };
                break;
            case 'reperibilita':
                defaultEntry = { ...base, type: 'reperibilita', value: 0, startTime: '22:00', endTime: '07:00', onCallType: 'Feriale' };
                break;
            case 'progetto':
                defaultEntry = { ...base, type: 'progetto', value: 0, startTime: '22:00', endTime: '00:00' };
                break;
            case 'appuntamento':
            default:
                defaultEntry = { ...base, type: 'appuntamento', title: '', startTime: '10:00', endTime: '11:00', value: 1 };
                break;
        }

        const prefilledEntry = { ...defaultEntry, ...aiData };

        if ('startTime' in prefilledEntry && 'endTime' in prefilledEntry && prefilledEntry.startTime && prefilledEntry.endTime) {
            prefilledEntry.value = calculateHours(prefilledEntry.date, prefilledEntry.startTime, prefilledEntry.endTime);
        }
        
        // FIX: Add type assertion to resolve complex union type inference issue.
        setEventModalState({ mode: 'add', entry: prefilledEntry as AllEntryTypes, date: prefilledEntry.date, type: prefilledEntry.type });
    };

    // New unified save function for shift pattern and definitions
    const handleSaveShiftPatternAndDefinitions = (newPattern: string, newDefinitions: ProfileData['shiftDefinitions']) => {
        onUpdateProfileData({ 
            ...profileData, 
            shiftPattern: newPattern,
            shiftDefinitions: newDefinitions 
        });
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: DragEvent<HTMLDivElement>, itemKey: string) => {
        setDraggedItem(itemKey);
        e.currentTarget.classList.add('dragging');
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>, itemKey: string) => {
        e.preventDefault();
        if (draggedItem !== itemKey) {
            setDragOverItem(itemKey);
            e.currentTarget.classList.add('drag-over');
        }
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('drag-over');
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>, targetItemKey: string) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        if (!draggedItem || draggedItem === targetItemKey) return;
        
        const operativeOrder = profileData.operativeCardOrder || [];
        const economicOrder = profileData.economicCardOrder || [];
        
        const isDraggedInOperative = operativeOrder.includes(draggedItem);
        const isTargetInOperative = operativeOrder.includes(targetItemKey);

        if (isDraggedInOperative && isTargetInOperative) {
            const items = [...operativeOrder];
            const draggedIndex = items.indexOf(draggedItem);
            const targetIndex = items.indexOf(targetItemKey);
            
            const [removed] = items.splice(draggedIndex, 1);
            items.splice(targetIndex, 0, removed);
            
            setOperativeCardOrder(items);
        } else if (!isDraggedInOperative && !isTargetInOperative) {
            const items = [...economicOrder];
            const draggedIndex = items.indexOf(draggedItem);
            const targetIndex = items.indexOf(targetItemKey);
            
            const [removed] = items.splice(draggedIndex, 1);
            items.splice(targetIndex, 0, removed);
            
            setEconomicCardOrder(items);
        }
        
        setDraggedItem(null);
        setDragOverItem(null);
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    };

    // Helper to render detail rows in tooltip
    const renderTooltipDetail = (label: string, value: string | number | undefined | null) => {
        if (!value && value !== 0) return null;
        return (
            <div className="tooltip-detail">
                <strong>{label}</strong>
                <span>{value}</span>
            </div>
        );
    };

    const getEventIcon = (type: AllEntryTypes['type']) => {
        switch (type) {
            case 'ferie': return '🏖️';
            case 'permessi': return '⏰';
            case 'reperibilita': return '📞';
            case 'appuntamento': return '🗓️';
            case 'progetto': return '💼';
            case 'straordinario': return '🏃';
            default: return '➡️';
        }
    };

    const handleShowTooltip = (event: AllEntryTypes, e: React.MouseEvent) => {
        const tooltipContent = (
            <div className="tooltip-content">
                <div className={`tooltip-header ${event.type}`}>
                    {getEventIcon(event.type)} {event.type}
                </div>
                <div className="tooltip-body">
                    {event.type === 'appuntamento' && renderTooltipDetail('Titolo:', event.title)}
                    {('startTime' in event && 'endTime' in event) && renderTooltipDetail('Orario:', `${event.startTime} - ${event.endTime}`)}
                    {event.type === 'ferie' && renderTooltipDetail('Giorni:', `${event.value}`)}
                    {('value' in event && event.type !== 'ferie' && event.type !== 'appuntamento') && renderTooltipDetail('Ore:', `${event.value.toFixed(2)}`)}
                    {event.type === 'permessi' && renderTooltipDetail('Tipo:', event.category)}
                    {event.type === 'straordinario' && renderTooltipDetail('Fascia:', event.timeSlot)}
                    {event.type === 'straordinario' && renderTooltipDetail('Dest.:', event.destination)}
                    {event.type === 'reperibilita' && renderTooltipDetail('Tipo:', event.onCallType)}
                    {event.notes && (
                        <p className="tooltip-notes">{event.notes}</p>
                    )}
                </div>
            </div>
        );
        setTooltip({ visible: true, content: tooltipContent, x: e.clientX, y: e.clientY });
    };

    const handleHideTooltip = () => {
        setTooltip(prev => ({ ...prev, visible: false }));
    };

    const renderView = () => {
        if (view === 'dashboard') {
             return (
                <Dashboard 
                    allEvents={allEvents} 
                    profileData={profileData} 
                    notificationPermission={notificationPermission}
                    onRequestNotificationPermission={requestNotificationPermission}
                    setReminderDays={setReminderDays}
                    onAddCheckIn={handleAddCheckIn}
                    layout={profileData.dashboardLayout || []}
                    setLayout={setDashboardLayout}
                    onOpenModalWithAiData={handleOpenModalWithAiData}
                />
            );
        }

        if (view === 'calendar') {
            return (
                <>
                    <CalendarFilters filters={calendarFilters} setFilters={setCalendarFilters} />
                    <Calendar 
                        events={allEvents} 
                        onDayClick={handleDayClick} 
                        shiftPattern={parsedShiftPattern}
                        cycleStartDate={profileData.cycleStartDate}
                        cycleEndDate={profileData.cycleEndDate}
                        shiftOverrides={shiftOverrides}
                        filters={calendarFilters}
                        onShowTooltip={handleShowTooltip}
                        onHideTooltip={handleHideTooltip}
                    />
                </>
            );
        }

        if (view === 'report') {
            return (
                <Report
                    allEvents={allEvents}
                    profileData={profileData}
                />
            );
        }
        
        // Grid View with Draggable Cards
        if(view === 'grid') {
            // FIX: Replaced `JSX.Element` with `React.ReactElement` to resolve TypeScript namespace error.
            const allCards: { [key: string]: React.ReactElement } = {
                holidays: <HolidayCard entries={holidays} setEntries={setHolidays} isCollapsed={collapsedCards.holidays} onToggleCollapse={() => toggleCollapse('holidays')} totalCurrentYear={profileData.totalCurrentYearHolidays} setTotalCurrentYear={setTotalCurrentYearHolidays} totalPreviousYears={profileData.totalPreviousYearsHolidays} setTotalPreviousYears={setTotalPreviousYearsHolidays} />,
                permits: <PermitCard entries={permits} setEntries={setPermits} isCollapsed={collapsedCards.permits} onToggleCollapse={() => toggleCollapse('permits')} />,
                overtime: <OvertimeCard entries={overtime} setEntries={setOvertime} isCollapsed={collapsedCards.overtime} onToggleCollapse={() => toggleCollapse('overtime')} />,
                onCall: <OnCallCard entries={onCall} setEntries={setOnCall} setOnCall={setOnCall} isCollapsed={collapsedCards.onCall} onToggleCollapse={() => toggleCollapse('onCall')} />, 
                projects: <ProjectCard entries={projects} setEntries={setProjects} isCollapsed={collapsedCards.projects} onToggleCollapse={() => toggleCollapse('projects')} />,
                shifts: <ShiftCard pattern={profileData.shiftPattern} startDate={profileData.cycleStartDate} setStartDate={setCycleStartDate} endDate={profileData.cycleEndDate} setEndDate={setCycleEndDate} onOpenEditor={() => setIsShiftEditorOpen(true)} isCollapsed={collapsedCards.shifts} onToggleCollapse={() => toggleCollapse('shifts')} />,
                workLocation: <WorkLocationCard workLocation={profileData.workLocation} setWorkLocation={setWorkLocation} isCollapsed={collapsedCards.workLocation} onToggleCollapse={() => toggleCollapse('workLocation')} />,
                checkIn: (
                    <CheckInCard
                        entries={profileData.checkIns}
                        onDelete={handleDeleteCheckIn}
                        isCollapsed={collapsedCards.checkIn}
                        onToggleCollapse={() => toggleCollapse('checkIn')}
                        extraContent={
                            <NfcCheckInButton
                                lastEntryType={profileData.checkIns.length > 0 ? profileData.checkIns[profileData.checkIns.length - 1].type : null}
                                onRegister={(type, context) => {
                                    handleAddCheckIn(type, context?.timestamp);
                                }}
                                workLocation={profileData.workLocation?.name || 'Sede principale'}
                            />
                        }
                    />
                ),
                nfcReport: (
                    <NfcReportCard
                        appointments={profileData.appointments}
                        monthDate={new Date()}
                    />
                ),
                payroll: <PayrollCard allEvents={allEvents} settings={profileData.salarySettings} shiftPattern={parsedShiftPattern} cycleStartDate={profileData.cycleStartDate} shiftOverrides={profileData.shiftOverrides} isCollapsed={collapsedCards.payroll} onToggleCollapse={() => toggleCollapse('payroll')} />,
                reminders: <ReminderCard events={allEvents} reminderDays={reminderDays} setReminderDays={setReminderDays} notificationPermission={notificationPermission} onRequestNotificationPermission={requestNotificationPermission} isCollapsed={collapsedCards.reminders} onToggleCollapse={() => toggleCollapse('reminders')} />,
                netSalary: <NetSalaryCalculatorCard isCollapsed={collapsedCards.netSalary} onToggleCollapse={() => toggleCollapse('netSalary')} netSalarySettings={profileData.netSalary} setNetSalarySettings={setNetSalarySettings} />,
                salarySettings: <SalarySettingsCard settings={profileData.salarySettings} setSettings={setSalarySettings} isCollapsed={collapsedCards.salarySettings} onToggleCollapse={() => toggleCollapse('salarySettings')} />,
                dataManagement: <DataManagementCard profileName={profileName} profileData={profileData} allEvents={allEvents} onImportData={onUpdateProfileData} isCollapsed={collapsedCards.dataManagement} onToggleCollapse={() => toggleCollapse('dataManagement')} />,
            };

            let operativeOrder = profileData.operativeCardOrder && profileData.operativeCardOrder.length > 0
                ? [...profileData.operativeCardOrder]
                : ['holidays', 'permits', 'overtime', 'onCall', 'projects', 'shifts', 'workLocation', 'checkIn', 'nfcReport'];
            if (!operativeOrder.includes('onCall')) {
                operativeOrder.splice(3, 0, 'onCall'); // inserisci sempre in quarta posizione
            }
            const economicOrder = profileData.economicCardOrder || ['payroll', 'reminders', 'netSalary', 'salarySettings', 'dataManagement'];

            const renderCard = (key: string) => (
                <div
                    key={key}
                    className="draggable-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, key)}
                    onDragOver={(e) => handleDragOver(e, key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, key)}
                >
                    {allCards[key]}
                </div>
            );

            return (
                <div className="app-layout">
                    <div className="card-column column-operative">
                        <div className="column-header">
                            <h2>Gestione Operativa</h2>
                        </div>
                        {operativeOrder.map(renderCard)}
                    </div>
                    <div className="card-column column-economic">
                         <div className="column-header">
                            <h2>Gestione Economica e Dati</h2>
                        </div>
                        {economicOrder.map(renderCard)}
                    </div>
                </div>
            );
        }

        return null;
    };
    
    return (
        <AppContext.Provider value={{ handleSaveEvent }}>
        <>
            {/* Se l'URL contiene ?azione=entrata o ?azione=uscita mostra i pulsanti NFC */}
            {azioneNfc && (
                <div style={{ background: '#e3f7e3', border: '1px solid #2e7d32', padding: 16, borderRadius: 8, margin: '16px 0' }}>
                    <h3>Registrazione NFC: {azioneNfc === 'entrata' ? 'Entrata' : 'Uscita'}</h3>
                    <button
                        style={{ padding: '8px 16px', fontSize: 16, background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        onClick={() => {
                            handleAddCheckIn(azioneNfc as 'entrata' | 'uscita');
                            alert(`Registrazione ${azioneNfc} effettuata!`);
                        }}
                    >
                        Registra {azioneNfc}
                    </button>
                </div>
            )}
            <header>
                <div className="header-profile-info">
                    <h1>Gestione Turni P.L.</h1>
                    <span>Profilo: <strong>{profileName}</strong></span>
                </div>
                <div className="view-switcher">
                    <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'active' : ''} aria-pressed={view === 'dashboard'}>
                        Dashboard 📊
                    </button>
                    <button onClick={() => setView('grid')} className={view === 'grid' ? 'active' : ''} aria-pressed={view === 'grid'}>
                        Griglia ▦
                    </button>
                    <button onClick={() => setView('calendar')} className={view === 'calendar' ? 'active' : ''} aria-pressed={view === 'calendar'}>
                        Calendario 📅
                    </button>
                    <button onClick={() => setView('report')} className={view === 'report' ? 'active' : ''} aria-pressed={view === 'report'}>
                        Report 📈
                    </button>
                    <UserProfile onLogout={onLogout} />
                </div>
            </header>
            <main>
                {renderView()}
            </main>
            {eventModalState && (
                <EventModal
                    mode={eventModalState.mode}
                    entry={eventModalState.entry}
                    date={eventModalState.date}
                    type={eventModalState.type}
                    onSave={handleSaveEvent}
                    onDelete={handleDeleteEntry}
                    onSplitDelete={handleSplitHoliday}
                    onClose={() => setEventModalState(null)}
                />
            )}
            {dayPopoverData && (
                <DayPopover
                    date={dayPopoverData.date}
                    events={dayPopoverData.events}
                    shiftOverride={dayPopoverData.shiftOverride}
                    onClose={() => setDayPopoverData(null)}
                    onEventClick={(event, clickedDate) => {
                        handleEventClick(event, clickedDate);
                        setDayPopoverData(null);
                    }}
                    onAddEvent={handleAddEventFromPopover}
                />
            )}
            {shiftOverrideModalDate && (
                <ShiftOverrideModal
                    date={shiftOverrideModalDate}
                    override={shiftOverrides[shiftOverrideModalDate] || null}
                    onSave={handleSaveShiftOverride}
                    onDelete={handleDeleteShiftOverride}
                    onClose={() => setShiftOverrideModalDate(null)}
                />
            )}
            {isShiftEditorOpen && (
                <ShiftPatternModal
                    initialPattern={profileData.shiftPattern}
                    initialDefinitions={profileData.shiftDefinitions}
                    onSave={handleSaveShiftPatternAndDefinitions}
                    onClose={() => setIsShiftEditorOpen(false)}
                />
            )}
            <CustomTooltip 
                visible={tooltip.visible}
                content={tooltip.content}
                position={{ x: tooltip.x, y: tooltip.y }}
            />
    </>
    </AppContext.Provider>
    );
};