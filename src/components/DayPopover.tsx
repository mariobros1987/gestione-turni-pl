import React, { useState } from 'react';
import { AllEntryTypes, ShiftOverride } from '../types/types';
import { getEventTooltip } from '../utils/eventUtils';
import { AddEventMenu } from './AddEventMenu';

interface DayPopoverProps {
    date: string;
    events: AllEntryTypes[];
    shiftOverride: ShiftOverride | null;
    onEventClick: (event: AllEntryTypes, clickedDate: string) => void;
    onAddEvent: (type: AllEntryTypes['type'] | 'cambio_turno', date: string) => void;
    onClose: () => void;
}

export const DayPopover: React.FC<DayPopoverProps> = ({ date, events, shiftOverride, onEventClick, onAddEvent, onClose }) => {
    const [addMenu, setAddMenu] = useState<{ x: number, y: number } | null>(null);

    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    
    const handleAddClick = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setAddMenu({ x: rect.left, y: rect.bottom });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="day-popover" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose} aria-label="Chiudi finestra">&times;</button>
                <h3>Dettagli del {formattedDate}</h3>
                {events.length > 0 ? (
                    <ul className="popover-event-list">
                        {events.map(event => (
                            <li key={event.id} onClick={() => onEventClick(event, date)} className={`event-item ${event.type}`} role="button">
                                <span className="event-type-label">{event.type.charAt(0).toUpperCase() + event.type.slice(1)}</span>
                                <span className="event-details">{getEventTooltip(event)}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="day-popover-no-events">Nessun evento per questo giorno.</p>
                )}
                
                <div className="day-popover-actions">
                    <button className="btn-secondary" onClick={handleAddClick}>Aggiungi Evento ➕</button>
                    <button className="btn-secondary-outline" onClick={() => onAddEvent('cambio_turno', date)}>
                        {shiftOverride ? 'Modifica Turno 🔄' : 'Imposta Turno 🔄'}
                    </button>
                </div>
            </div>
            {addMenu && (
                <AddEventMenu 
                    date={date}
                    position={{ x: addMenu.x, y: addMenu.y }}
                    onSelect={(type, date) => {
                        setAddMenu(null);
                        onAddEvent(type, date);
                    }}
                    onClose={() => setAddMenu(null)}
                />
            )}
        </div>
    );
};