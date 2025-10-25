import React, { useState } from 'react';
import { CardProps, CollapsibleCardProps, PermitEntry, PermitCategory } from '../types/types';
import { parseDateAsUTC, calculateHours } from '../utils/dateUtils';

export const PermitCard: React.FC<CardProps<PermitEntry> & CollapsibleCardProps> = ({ entries, setEntries, isCollapsed, onToggleCollapse }) => {
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');
    const [category, setCategory] = useState<PermitCategory>('Personale');
    const [timeError, setTimeError] = useState('');
    
    const totalValue = entries.reduce((sum, entry) => sum + entry.value, 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !startTime || !endTime) return;

        const calculatedHours = calculateHours(date, startTime, endTime);
        if (calculatedHours <= 0) {
            setTimeError("L'orario di fine deve essere successivo a quello di inizio.");
            return;
        }

        const newEntry: PermitEntry = {
            id: new Date().toISOString(), date, value: calculatedHours, notes, category, startTime, endTime, type: 'permessi'
        };
        setEntries([...entries, newEntry].sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));
        setDate(''); setStartTime(''); setEndTime(''); setNotes(''); setTimeError('');
    };
    const handleDelete = (id: string) => setEntries(entries.filter(entry => entry.id !== id));

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Permessi</h2>
                    <p className="summary">Totale ore prese: <span>{totalValue.toLocaleString('it-IT')} ore</span></p>
                </div>
                 <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="permit-date">Data</label>
                            <input type="date" id="permit-date" value={date} onChange={(e) => setDate(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="permit-category">Tipologia</label>
                            <select id="permit-category" value={category} onChange={e => setCategory(e.target.value as PermitCategory)}>
                                <option>Personale</option>
                                <option>L.104</option>
                                <option>Studio</option>
                                <option>Sindacale</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Orario (Inizio - Fine)</label>
                            <div className="time-range-group">
                                <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setTimeError(''); }} required />
                                <span>-</span>
                                <input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setTimeError(''); }} required />
                            </div>
                            {timeError && <small className="warning-text">{timeError}</small>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="permit-notes">Note</label>
                            <input type="text" id="permit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dettagli aggiuntivi" />
                        </div>
                        <button type="submit" className="btn-add">Aggiungi ➕</button>
                    </form>
                    <ul className="entry-list">
                        {entries.map(entry => (
                            <li key={entry.id}>
                                <div className="entry-details">
                                    <span className="date">{new Date(entry.date).toLocaleDateString('it-IT', { timeZone: 'UTC' })} - [{entry.category}]</span>
                                    <span className="value">{entry.startTime}-{entry.endTime} ({entry.value} ore) {entry.notes && `- ${entry.notes}`}</span>
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