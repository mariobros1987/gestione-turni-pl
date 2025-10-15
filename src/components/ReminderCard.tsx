import React, { useMemo } from 'react';
import { AllEntryTypes } from '../types/types';
import { parseDateAsUTC } from '../utils/dateUtils';
import { getEventTooltip } from '../utils/eventUtils';

export const ReminderCard: React.FC<{
    events: AllEntryTypes[];
    reminderDays: number;
    setReminderDays: (value: number) => void;
    notificationPermission: NotificationPermission;
    onRequestNotificationPermission: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}> = ({ events, reminderDays, setReminderDays, notificationPermission, onRequestNotificationPermission, isCollapsed, onToggleCollapse }) => {

    const upcomingEvents = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        const reminderEndDate = new Date(today);
        reminderEndDate.setDate(today.getDate() + reminderDays);

        return events
            .filter(event => {
                const eventDate = parseDateAsUTC(event.date);
                return event.type !== 'straordinario' && event.type !== 'progetto' &&
                       eventDate >= today && eventDate < reminderEndDate;
            })
            .sort((a, b) => parseDateAsUTC(a.date).getTime() - parseDateAsUTC(b.date).getTime());
    }, [events, reminderDays]);
    
    const getDaysUntil = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDate = parseDateAsUTC(dateStr);
        const diffTime = eventDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };
    
    const formatRelativeDate = (days: number) => {
        if (days === 0) return 'Oggi';
        if (days === 1) return 'Domani';
        return `tra ${days} giorni`;
    };
    
    const getEventIcon = (type: AllEntryTypes['type']) => {
        switch (type) {
            case 'ferie': return '🏖️';
            case 'permessi': return '⏰';
            case 'reperibilita': return '📞';
            case 'appuntamento': return '🗓️';
            default: return '➡️';
        }
    };

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Promemoria</h2>
                    <p className="summary">Eventi imminenti nei prossimi {reminderDays} giorni</p>
                </div>
                <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    {notificationPermission === 'default' && (
                        <div className="notification-permission-prompt">
                            <p>Abilita le notifiche per non dimenticare i tuoi eventi!</p>
                            <button onClick={onRequestNotificationPermission} className="btn-secondary">
                                Abilita Notifiche
                            </button>
                        </div>
                    )}
                    {notificationPermission === 'denied' && (
                         <div className="notification-permission-prompt notification-denied">
                            <p><strong>Le notifiche sono bloccate.</strong></p>
                            <p>Per riceverle, devi abilitare i permessi per questo sito nelle impostazioni del tuo browser.</p>
                        </div>
                    )}
                    <div className="form-group">
                        <label htmlFor="reminder-days">Giorni di preavviso</label>
                        <input
                            type="number"
                            id="reminder-days"
                            value={reminderDays}
                            onChange={e => setReminderDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            min="1"
                        />
                    </div>
                    {upcomingEvents.length > 0 ? (
                        <ul className="entry-list reminder-list">
                            {upcomingEvents.map(event => {
                                const daysUntil = getDaysUntil(event.date);
                                return (
                                    <li key={event.id} className={`event-item ${event.type}`}>
                                        <div className="reminder-icon">{getEventIcon(event.type)}</div>
                                        <div className="entry-details">
                                            <span className="date">
                                                {new Date(event.date).toLocaleDateString('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })}
                                                <span className="relative-date"> ({formatRelativeDate(daysUntil)})</span>
                                            </span>
                                            <span className="value">{getEventTooltip(event)}</span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="no-reminders-message">Nessun promemoria imminente.</p>
                    )}
                </div>
            )}
        </div>
    );
};