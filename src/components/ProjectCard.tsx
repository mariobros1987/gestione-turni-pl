import React, { useState } from 'react';
import { CardProps, CollapsibleCardProps, ProjectEntry } from '../types/types';
import { parseDateAsUTC, calculateHours } from '../utils/dateUtils';

export const ProjectCard: React.FC<CardProps<ProjectEntry> & CollapsibleCardProps> = ({ entries, setEntries, isCollapsed, onToggleCollapse }) => {
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('00:00');
    const [notes, setNotes] = useState('');
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

        const newEntry: ProjectEntry = {
            id: new Date().toISOString(), date, value: calculatedHours, notes, startTime, endTime, type: 'progetto'
        };
        setEntries([...entries, newEntry].sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));
        setDate(''); setStartTime('22:00'); setEndTime('00:00'); setNotes(''); setTimeError('');
    };
    const handleDelete = (id: string) => setEntries(entries.filter(entry => entry.id !== id));

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Progetto</h2>
                    <p className="summary">Totale ore progetto: <span>{totalValue.toLocaleString('it-IT')} ore</span></p>
                </div>
                <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="project-date">Data</label>
                            <input type="date" id="project-date" value={date} onChange={(e) => setDate(e.target.value)} required />
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
                            <label htmlFor="project-notes">Note</label>
                            <input type="text" id="project-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dettagli aggiuntivi" />
                        </div>
                        <button type="submit" className="btn-add">Aggiungi ➕</button>
                    </form>
                    <ul className="entry-list">
                        {entries.map(entry => (
                            <li key={entry.id}>
                                <div className="entry-details">
                                    <span className="date">{new Date(entry.date).toLocaleDateString('it-IT', { timeZone: 'UTC' })}</span>
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