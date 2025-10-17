import React from 'react';
import { CollapsibleCardProps, CheckInEntry } from '../types/types';

interface CheckInCardProps extends CollapsibleCardProps {
    entries: CheckInEntry[];
    onDelete: (id: string) => void;
    extraContent?: React.ReactNode;
}

export const CheckInCard: React.FC<CheckInCardProps> = ({ entries, onDelete, isCollapsed, onToggleCollapse, extraContent }) => {
    // Sort entries chronologically, most recent first
    const sortedEntries = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Registro Presenze</h2>
                    <p className="summary">Storico delle entrate e uscite.</p>
                </div>
                <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    {extraContent && (
                        <div
                            className="card-section card-section--actions"
                            style={{ marginBottom: sortedEntries.length > 0 ? '1rem' : 0 }}
                        >
                            {extraContent}
                        </div>
                    )}
                    {sortedEntries.length > 0 ? (
                        <ul className="entry-list check-in-list">
                            {sortedEntries.map(entry => {
                                const entryDate = new Date(entry.timestamp);
                                return (
                                    <li key={entry.id}>
                                        <div className="entry-details">
                                            <span className="date">
                                                <span className={`check-in-icon ${entry.type === 'entrata' ? 'entry' : 'exit'}`}>
                                                    {entry.type === 'entrata' ? '➡️' : '⬅️'}
                                                </span>
                                                {entryDate.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}
                                            </span>
                                            <span className="value">
                                                {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} alle ore {entryDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <button onClick={() => onDelete(entry.id)} className="btn-delete" aria-label={`Elimina voce del ${entryDate.toLocaleString()}`}>🗑️</button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="no-reminders-message">Nessuna registrazione di presenza trovata.</p>
                    )}
                </div>
            )}
        </div>
    );
};