import React, { useState, useMemo } from 'react';
import { CardProps, CollapsibleCardProps, OvertimeEntry, OvertimeTimeSlot, OvertimeDestination } from '../types/types';
import { parseDateAsUTC, calculateHours } from '../utils/dateUtils';

export const OvertimeCard: React.FC<CardProps<OvertimeEntry> & CollapsibleCardProps> = ({ entries, setEntries, isCollapsed, onToggleCollapse }) => {
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');
    const [timeSlot, setTimeSlot] = useState<OvertimeTimeSlot>('Diurno');
    const [destination, setDestination] = useState<OvertimeDestination>('pagamento');
    const [timeError, setTimeError] = useState('');

    const totalValue = entries.reduce((sum, entry) => sum + entry.value, 0);
    const recoveryHours = entries.filter(e => e.destination === 'recupero').reduce((sum, e) => sum + e.value, 0);

    const { hoursThisMonth, paidHours } = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const currentMonthEntries = entries.filter(entry => {
            const entryDate = parseDateAsUTC(entry.date);
            return entryDate.getUTCMonth() === currentMonth && entryDate.getUTCFullYear() === currentYear;
        });

        const hoursThisMonth = currentMonthEntries.reduce((sum, entry) => sum + entry.value, 0);
        const paidHours = totalValue - recoveryHours;

        return { hoursThisMonth, paidHours };
    }, [entries, totalValue, recoveryHours]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !startTime || !endTime) return;
        const calculatedHours = calculateHours(date, startTime, endTime);
        if (calculatedHours <= 0) {
            setTimeError("L'orario di fine deve essere successivo a quello di inizio.");
            return;
        }

        const newEntry: OvertimeEntry = {
            id: new Date().toISOString(), date, value: calculatedHours, notes, timeSlot, destination, startTime, endTime, type: 'straordinario'
        };
        setEntries([...entries, newEntry].sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));
        setDate(''); setStartTime(''); setEndTime(''); setNotes(''); setTimeError('');
    };
    const handleDelete = (id: string) => setEntries(entries.filter(entry => entry.id !== id));

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Straordinario</h2>
                     <div className="summary-details">
                        <div><span>{hoursThisMonth.toLocaleString('it-IT')}</span> Mese Corrente</div>
                        <div><span>{paidHours.toLocaleString('it-IT')}</span> Pagate</div>
                        <div><span>{recoveryHours.toLocaleString('it-IT')}</span> Da Recuperare</div>
                        <div className="total-remaining"><span>{totalValue.toLocaleString('it-IT')}</span> Totale Accumulato</div>
                    </div>
                </div>
                <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="overtime-date">Data</label>
                            <input type="date" id="overtime-date" value={date} onChange={(e) => setDate(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="overtime-slot">Fascia</label>
                            <select id="overtime-slot" value={timeSlot} onChange={e => setTimeSlot(e.target.value as OvertimeTimeSlot)}>
                                <option>Diurno</option>
                                <option>Notturno</option>
                                <option>Festivo</option>
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
                            <label>Destinazione</label>
                            <div className="radio-group">
                                <label><input type="radio" value="pagamento" checked={destination === 'pagamento'} onChange={e => setDestination(e.target.value as OvertimeDestination)} /> Pagamento</label>
                                <label><input type="radio" value="recupero" checked={destination === 'recupero'} onChange={e => setDestination(e.target.value as OvertimeDestination)} /> Recupero</label>
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="overtime-notes">Note</label>
                            <input type="text" id="overtime-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dettagli aggiuntivi" />
                        </div>
                        <button type="submit" className="btn-add">Aggiungi ➕</button>
                    </form>
                    <ul className="entry-list">
                        {entries.map(entry => (
                            <li key={entry.id}>
                                <div className="entry-details">
                                    <span className="date">{new Date(entry.date).toLocaleDateString('it-IT', { timeZone: 'UTC' })} - [{entry.timeSlot} / {entry.destination}]</span>
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