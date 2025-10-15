import React, { useMemo } from 'react';
import { CollapsibleCardProps } from '../types/types';
import { parseShiftPattern } from '../utils/shiftUtils';

export const ShiftCard: React.FC<{
    pattern: string;
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string | null | undefined;
    setEndDate: (date: string | null) => void;
    onOpenEditor: () => void;
} & CollapsibleCardProps> = ({ pattern, startDate, setStartDate, endDate, setEndDate, onOpenEditor, isCollapsed, onToggleCollapse }) => {

    const isStartDateMonday = useMemo(() => {
        if (!startDate) return true;
        // La data viene interpretata come UTC, getDay() per UTC è getUTCDay()
        const date = new Date(`${startDate}T00:00:00Z`);
        return date.getUTCDay() === 1; // 1 è Lunedì in UTC
    }, [startDate]);

    const patternSummary = useMemo(() => {
        const parsed = parseShiftPattern(pattern);
        if (parsed.length === 0) {
            return "Nessuno schema visuale definito.";
        }
        return `Ciclo di ${parsed.length} giorni definito.`;
    }, [pattern]);

    return (
        <div className={`card full-width-card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Gestione Turni</h2>
                    <p className="summary">Definisci il tuo ciclo di turni.</p>
                </div>
                 <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <div className="form-group">
                        <label htmlFor="cycle-start-date">Data di Inizio Ciclo</label>
                        <input type="date" id="cycle-start-date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                        {!isStartDateMonday && (
                            <small className="warning-text">
                                Attenzione: per un calcolo corretto, la data di inizio del ciclo dovrebbe essere un Lunedì.
                            </small>
                        )}
                    </div>
                    <div className="form-group">
                        <label htmlFor="cycle-end-date">Data di Fine Ciclo (Opzionale)</label>
                        <input
                            type="date"
                            id="cycle-end-date"
                            value={endDate || ''}
                            onChange={e => setEndDate(e.target.value || null)}
                            min={startDate}
                        />
                        <small>Se impostata, il ciclo di turni si interromperà in questa data. Altrimenti, continuerà all'infinito.</small>
                    </div>
                    <div className="form-group">
                        <label>Schema del Ciclo di Turni</label>
                        <div className="shift-pattern-summary">
                            <p>{patternSummary}</p>
                        </div>
                        <button type="button" onClick={onOpenEditor} className="btn-secondary">
                            ✍️ Modifica Schema Visuale
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};