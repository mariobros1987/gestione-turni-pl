import React, { useState, useMemo } from 'react';
import { CardProps, CollapsibleCardProps, HolidayEntry } from '../types/types';
import { parseDateAsUTC } from '../utils/dateUtils';

export const HolidayCard: React.FC<CardProps<HolidayEntry> & CollapsibleCardProps & {
    totalCurrentYear: number;
    setTotalCurrentYear: (value: number) => void;
    totalPreviousYears: number;
    setTotalPreviousYears: (value: number) => void;
}> = ({ entries, setEntries, isCollapsed, onToggleCollapse, totalCurrentYear, setTotalCurrentYear, totalPreviousYears, setTotalPreviousYears }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [notes, setNotes] = useState('');

    const calculatedDays = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const start = parseDateAsUTC(startDate);
        const end = parseDateAsUTC(endDate);
        if (end < start) return 0;
        
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    }, [startDate, endDate]);

    const usedValue = entries.reduce((sum, entry) => sum + entry.value, 0);
    const remainingCurrent = totalCurrentYear - usedValue;
    const totalRemaining = remainingCurrent + totalPreviousYears;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate || calculatedDays <= 0) return;
        const newEntry: HolidayEntry = {
            id: new Date().toISOString(), 
            date: startDate, 
            value: calculatedDays, 
            notes, 
            type: 'ferie'
        };
        setEntries([...entries, newEntry].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));
        setStartDate(''); setEndDate(''); setNotes('');
    };

    const handleDelete = (id: string) => setEntries(entries.filter(entry => entry.id !== id));
    
    const formatDateRange = (entry: HolidayEntry) => {
        const entryStartDate = parseDateAsUTC(entry.date);
        
        if (entry.value === 1) {
            return entryStartDate.toLocaleDateString('it-IT', { timeZone: 'UTC' });
        }
        
        const entryEndDate = new Date(entryStartDate.getTime());
        entryEndDate.setUTCDate(entryStartDate.getUTCDate() + entry.value - 1);
        
        return `${entryStartDate.toLocaleDateString('it-IT', { timeZone: 'UTC' })} - ${entryEndDate.toLocaleDateString('it-IT', { timeZone: 'UTC' })}`;
    };

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Ferie</h2>
                    <div className="summary-details">
                        <div><span>{totalCurrentYear}</span> Anno Corrente</div>
                        <div><span>{totalPreviousYears}</span> Anni Precedenti</div>
                        <div><span>{usedValue}</span> Godute</div>
                        <div className="total-remaining"><span>{totalRemaining}</span> Totale Residuo</div>
                    </div>
                </div>
                 <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <div className="total-inputs">
                        <div className="form-group">
                            <label htmlFor="total-current">Totale Ferie A.C.</label>
                            <input type="number" id="total-current" value={totalCurrentYear} onChange={e => setTotalCurrentYear(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="total-previous">Totale Ferie A.P.</label>
                            <input type="number" id="total-previous" value={totalPreviousYears} onChange={e => setTotalPreviousYears(parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-grid-2-cols">
                            <div className="form-group">
                                <label htmlFor="holiday-start-date">Data Inizio</label>
                                <input type="date" id="holiday-start-date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="holiday-end-date">Data Fine</label>
                                <input type="date" id="holiday-end-date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} required />
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label>Giorni totali (calcolati)</label>
                            <input type="text" value={calculatedDays > 0 ? `${calculatedDays} giorni` : 'Seleziona un intervallo valido'} readOnly disabled />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="holiday-notes">Note</label>
                            <input type="text" id="holiday-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dettagli aggiuntivi" />
                        </div>
                        <button type="submit" className="btn-add">Aggiungi ➕</button>
                    </form>
                    <ul className="entry-list" aria-live="polite">
                        {entries.map(entry => (
                            <li key={entry.id}>
                                <div className="entry-details">
                                    <span className="date">{formatDateRange(entry)}</span>
                                    <span className="value">{entry.value} {entry.value === 1 ? 'giorno' : 'giorni'} {entry.notes && `- ${entry.notes}`}</span>
                                </div>
                                <button onClick={() => handleDelete(entry.id)} className="btn-delete" aria-label={`Elimina voce del ${entry.date}`}>🗑️</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};