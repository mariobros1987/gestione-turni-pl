import React, { useState } from 'react';
import { ShiftOverride } from '../../types/types';

interface ShiftOverrideModalProps {
    date: string;
    override: ShiftOverride | null;
    onSave: (date: string, override: ShiftOverride) => void;
    onDelete: (date: string) => void;
    onClose: () => void;
}

export const ShiftOverrideModal: React.FC<ShiftOverrideModalProps> = ({ date, override, onSave, onDelete, onClose }) => {
    const [name, setName] = useState(override?.name || 'Mattina');
    const [start, setStart] = useState(override?.start || '08:00');
    const [end, setEnd] = useState(override?.end || '14:00');

    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(date, { name, start, end });
        onClose();
    };

    const handleDelete = () => {
        onDelete(date);
        onClose();
    };

    return (
         <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose} aria-label="Chiudi finestra">&times;</button>
                <h3>Cambio Turno per {formattedDate}</h3>
                 <form onSubmit={handleSubmit} className="modal-form">
                     <div className="form-group">
                        <label htmlFor="shift-name">Nome Turno</label>
                        <input id="shift-name" type="text" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Orario (Inizio - Fine)</label>
                        <div className="time-range-group">
                            <input type="time" value={start} onChange={e => setStart(e.target.value)} required />
                            <span>-</span>
                            <input type="time" value={end} onChange={e => setEnd(e.target.value)} required />
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="submit" className="btn-save">Salva ✔️</button>
                        {override && <button type="button" onClick={handleDelete} className="btn-delete-modal">Rimuovi 🗑️</button>}
                    </div>
                 </form>
            </div>
        </div>
    );
};