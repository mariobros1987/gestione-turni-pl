import React, { useState, useMemo, DragEvent, useCallback, useEffect } from 'react';
import { AllEntryTypes, ProfileData, WidgetConfig, AiInsightResponse } from '../types/types';
import { ReminderCard } from './ReminderCard';
import { parseDateAsUTC } from '../utils/dateUtils';
import { SmartCheckIn } from './SmartCheckIn';
import { getAiSuggestion } from '../services/aiSuggestionService';
import { AiEventCreator } from './AiEventCreator';

// --- WIDGET COMPONENTS ---

// Generic Stat Widget
const StatWidget: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <div className="stat-widget">
        <h3>{title}</h3>
        <p className="stat-value">{value}</p>
    </div>
);

// Reminders Widget
const RemindersWidget: React.FC<{
    allEvents: AllEntryTypes[];
    profileData: ProfileData;
    notificationPermission: NotificationPermission;
    onRequestNotificationPermission: () => void;
    setReminderDays: (days: number) => void;
}> = (props) => (
    <div className="reminders-widget-inner">
        <ReminderCard
            events={props.allEvents}
            reminderDays={props.profileData.reminderDays}
            setReminderDays={props.setReminderDays}
            notificationPermission={props.notificationPermission}
            onRequestNotificationPermission={props.onRequestNotificationPermission}
            isCollapsed={false}
            onToggleCollapse={() => {}}
        />
    </div>
);

// AI Insights Widget
const AiInsightsWidget: React.FC<{
    allEvents: AllEntryTypes[];
    profileData: ProfileData;
}> = ({ allEvents, profileData }) => {
    const [insight, setInsight] = useState<AiInsightResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchTime, setLastFetchTime] = useState<number>(0);
    
    // Cache per evitare troppe chiamate API
    const CACHE_DURATION = 10 * 60 * 1000; // 10 minuti
    const MIN_FETCH_INTERVAL = 30 * 1000; // Minimo 30 secondi tra le chiamate

    const fetchInsight = useCallback(async (forceRefresh = false) => {
        const now = Date.now();
        
        // Controlla se abbiamo già un insight valido e non è una richiesta forzata
        if (!forceRefresh && insight && (now - lastFetchTime) < CACHE_DURATION) {
            console.log('🔄 AI insight cache hit - nessuna nuova chiamata necessaria');
            return;
        }
        
        // Previeni chiamate troppo frequenti
        if (!forceRefresh && (now - lastFetchTime) < MIN_FETCH_INTERVAL) {
            console.log('⏳ AI insight call troppo frequente - saltata');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            console.log('🤖 Fetching AI insight...');
            const result = await getAiSuggestion(profileData, allEvents);
            setInsight(result);
            setLastFetchTime(now);
            console.log('✅ AI insight ricevuto:', result);
        } catch (err: any) {
            console.error('❌ Errore AI insight:', err);
            
            // Gestione specifica per quota esaurita
            if (err.message?.includes('quota') || err.message?.includes('Quota')) {
                setError("Quota AI esaurita per oggi. Funzionalità disponibile domani.");
            } else {
                setError("Suggerimento AI temporaneamente non disponibile.");
            }
        } finally {
            setIsLoading(false);
        }
    }, [profileData, allEvents, insight, lastFetchTime]);

    // Debounce per evitare chiamate eccessive quando i dati cambiano rapidamente
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchInsight();
        }, 1000); // Attendi 1 secondo prima di fare la chiamata

        return () => clearTimeout(timeoutId);
    }, [fetchInsight]);
    
    const getInsightIcon = (type: AiInsightResponse['type']) => {
        switch (type) {
            case 'warning': return '⚠️';
            case 'tip': return '💡';
            case 'info': return '✅';
            default: return '🤖';
        }
    };

    return (
        <div className="ai-insights-widget">
            <div className="ai-widget-header">
                <h3>Suggerimenti AI</h3>
                <button 
                    onClick={() => fetchInsight(true)} 
                    disabled={isLoading} 
                    className="btn-refresh-ai" 
                    title="Aggiorna suggerimento"
                >
                    🔄
                </button>
            </div>
            <div className="ai-suggestion-list">
                {isLoading && <p className="ai-widget-loading">Analisi in corso...</p>}
                {error && <p className="ai-widget-error">{error}</p>}
                {!isLoading && !error && insight && insight.type !== 'none' && (
                    <div className={`ai-suggestion-item suggestion-${insight.type}`}>
                        <span className="ai-suggestion-icon">{getInsightIcon(insight.type)}</span>
                        <p className="ai-suggestion-text">{insight.message}</p>
                    </div>
                )}
                 {!isLoading && !error && (!insight || insight.type === 'none') && (
                     <div className="ai-suggestion-item suggestion-info">
                        <span className="ai-suggestion-icon">✅</span>
                        <p className="ai-suggestion-text">Tutto sembra procedere regolarmente!</p>
                    </div>
                )}
            </div>
        </div>
    );
};


// Add Widget Modal
const AddWidgetModal: React.FC<{
    availableWidgets: { type: string; name: string }[];
    onAdd: (type: string) => void;
    onClose: () => void;
}> = ({ availableWidgets, onAdd, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content add-widget-modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={onClose} aria-label="Chiudi finestra">&times;</button>
            <h3>Aggiungi Widget</h3>
            {availableWidgets.length > 0 ? (
                <ul className="add-widget-list">
                    {availableWidgets.map(widget => (
                        <li key={widget.type}>
                            <button onClick={() => onAdd(widget.type)}>{widget.name}</button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Tutti i widget disponibili sono già stati aggiunti.</p>
            )}
        </div>
    </div>
);


// --- MAIN DASHBOARD COMPONENT ---

interface DashboardProps {
    allEvents: AllEntryTypes[];
    profileData: ProfileData;
    notificationPermission: NotificationPermission;
    onRequestNotificationPermission: () => void;
    setReminderDays: (days: number) => void;
    onAddCheckIn: (type: 'entrata' | 'uscita') => void;
    layout: WidgetConfig[];
    setLayout: (layout: WidgetConfig[]) => void;
    onOpenModalWithAiData: (data: Partial<AllEntryTypes> & { type: AllEntryTypes['type'] }) => void;
}

const ALL_WIDGET_DEFINITIONS = [
    { type: 'aiInsights', name: 'Suggerimenti AI' },
    { type: 'remainingHolidays', name: 'Ferie Residue' },
    { type: 'overtimeHoursThisMonth', name: 'Ore Straordinario (Mese)' },
    { type: 'permitHoursThisMonth', name: 'Ore Permesso (Mese)' },
    { type: 'projectHoursThisMonth', name: 'Ore Progetto (Mese)' },
    { type: 'reminders', name: 'Promemoria' },
];

export const Dashboard: React.FC<DashboardProps> = (props) => {
    const { allEvents, profileData, layout, setLayout, onAddCheckIn, onOpenModalWithAiData } = props;
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isCustomizing, setIsCustomizing] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // Drag & Drop State
    const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);

    const stats = useMemo(() => {
        // ... (same stat calculation logic as before)
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const monthFilter = (entry: AllEntryTypes) => {
            const entryDate = parseDateAsUTC(entry.date);
            return entryDate.getUTCFullYear() === year && entryDate.getUTCMonth() === month;
        };
        const overtimeHoursThisMonth = allEvents.filter(e => e.type === 'straordinario' && monthFilter(e)).reduce((sum, e) => sum + e.value, 0);
        const permitHoursThisMonth = allEvents.filter(e => e.type === 'permessi' && monthFilter(e)).reduce((sum, e) => sum + e.value, 0);
        const projectHoursThisMonth = allEvents.filter(e => e.type === 'progetto' && monthFilter(e)).reduce((sum, e) => sum + e.value, 0);
        const usedHolidays = profileData.holidays.reduce((sum, entry) => sum + entry.value, 0);
        const remainingHolidays = (profileData.totalCurrentYearHolidays + profileData.totalPreviousYearsHolidays) - usedHolidays;
        return { overtimeHoursThisMonth, permitHoursThisMonth, projectHoursThisMonth, remainingHolidays };
    }, [allEvents, profileData, selectedDate]);
    
    const selectedMonthName = useMemo(() => {
        const month = selectedDate.toLocaleString('it-IT', { month: 'long' });
        return month.charAt(0).toUpperCase() + month.slice(1) + ' ' + selectedDate.getFullYear();
    }, [selectedDate]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value + '-02');
        setSelectedDate(newDate);
    };

    // --- Customization Handlers ---
    const handleRemoveWidget = (widgetId: string) => {
        setLayout(layout.filter(w => w.id !== widgetId));
    };

    const handleAddWidget = (widgetType: string) => {
        const newWidget: WidgetConfig = {
            id: `w_${Date.now()}`,
            type: widgetType,
        };
        setLayout([...layout, newWidget]);
        setIsAddModalOpen(false);
    };
    
    const availableWidgetsToAdd = useMemo(() => {
        const currentWidgetTypes = new Set(layout.map(w => w.type));
        return ALL_WIDGET_DEFINITIONS.filter(def => !currentWidgetTypes.has(def.type));
    }, [layout]);

    // --- Drag & Drop Handlers ---
    const handleDragStart = (e: DragEvent<HTMLDivElement>, widgetId: string) => {
        setDraggedWidgetId(widgetId);
        e.currentTarget.classList.add('widget-card--dragging');
    };
    
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>, targetWidgetId: string) => {
        e.preventDefault();
        if (!draggedWidgetId || draggedWidgetId === targetWidgetId) return;

        const draggedIndex = layout.findIndex(w => w.id === draggedWidgetId);
        const targetIndex = layout.findIndex(w => w.id === targetWidgetId);

        const newLayout = [...layout];
        const [draggedItem] = newLayout.splice(draggedIndex, 1);
        newLayout.splice(targetIndex, 0, draggedItem);
        
        setLayout(newLayout);
        setDraggedWidgetId(null);
    };

    const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
         e.currentTarget.classList.remove('widget-card--dragging');
         setDraggedWidgetId(null);
    };

    const renderWidget = (widget: WidgetConfig) => {
        switch (widget.type) {
            case 'remainingHolidays':
                return <StatWidget title="Ferie Residue Totali" value={`${stats.remainingHolidays} giorni`} />;
            case 'overtimeHoursThisMonth':
                return <StatWidget title="Ore Straordinario (Mese)" value={`${stats.overtimeHoursThisMonth.toFixed(2)} ore`} />;
            case 'permitHoursThisMonth':
                return <StatWidget title="Ore Permesso (Mese)" value={`${stats.permitHoursThisMonth.toFixed(2)} ore`} />;
            case 'projectHoursThisMonth':
                return <StatWidget title="Ore Progetto (Mese)" value={`${stats.projectHoursThisMonth.toFixed(2)} ore`} />;
            case 'reminders':
                return <RemindersWidget {...props} />;
            case 'aiInsights':
                return <AiInsightsWidget {...props} />;
            default:
                return <div>Widget sconosciuto: {widget.type}</div>;
        }
    };

    return (
        <div className="dashboard">
            <SmartCheckIn workLocation={profileData.workLocation} checkIns={profileData.checkIns} onAddCheckIn={onAddCheckIn} />
            
            <AiEventCreator onEventParsed={onOpenModalWithAiData} />

            <div className="dashboard-header">
                <div className="dashboard-customize-header">
                    <h2>Dashboard di {selectedMonthName}</h2>
                    <div className="dashboard-controls">
                        {isCustomizing && (
                            <button className="btn-add" onClick={() => setIsAddModalOpen(true)}>Aggiungi Widget ➕</button>
                        )}
                        <button className="btn-secondary" onClick={() => setIsCustomizing(!isCustomizing)}>
                            {isCustomizing ? 'Fine ✔️' : 'Personalizza ✏️'}
                        </button>
                    </div>
                </div>
                {!isCustomizing && (
                    <div className="form-group">
                        <label htmlFor="dashboard-month-picker" className="sr-only">Cambia Mese</label>
                        <input type="month" id="dashboard-month-picker" value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`} onChange={handleDateChange} />
                    </div>
                )}
            </div>

            <div className="dashboard-widget-grid">
                {layout.map(widget => (
                    <div
                        key={widget.id}
                        draggable={isCustomizing}
                        onDragStart={isCustomizing ? (e) => handleDragStart(e, widget.id) : undefined}
                        onDragOver={isCustomizing ? handleDragOver : undefined}
                        onDrop={isCustomizing ? (e) => handleDrop(e, widget.id) : undefined}
                        onDragEnd={isCustomizing ? handleDragEnd : undefined}
                        className={`widget-card ${widget.type === 'reminders' ? 'reminders-widget' : ''} ${widget.type === 'aiInsights' ? 'ai-insights-widget' : ''} ${isCustomizing ? 'widget-card--customizing' : ''}`}
                    >
                        {isCustomizing && (
                            <div className="widget-controls">
                                <button
                                    className="widget-remove-btn"
                                    onClick={() => handleRemoveWidget(widget.id)}
                                    title="Rimuovi widget"
                                    aria-label="Rimuovi widget"
                                >
                                    &times;
                                </button>
                            </div>
                        )}
                        {renderWidget(widget)}
                    </div>
                ))}
                {layout.length === 0 && (
                     <div className="widget-card">
                         <p className="no-reminders-message">La tua dashboard è vuota. Clicca su "Personalizza" per aggiungere dei widget!</p>
                     </div>
                )}
            </div>
            
            {isAddModalOpen && (
                <AddWidgetModal
                    availableWidgets={availableWidgetsToAdd}
                    onAdd={handleAddWidget}
                    onClose={() => setIsAddModalOpen(false)}
                />
            )}
        </div>
    );
};