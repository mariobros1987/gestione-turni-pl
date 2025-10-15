import React, { useEffect, useRef } from 'react';
import { AllEntryTypes } from '../types/types';

interface AddEventMenuProps {
    date: string;
    position: { x: number; y: number };
    onSelect: (type: AllEntryTypes['type'] | 'cambio_turno', date: string) => void;
    onClose: () => void;
}
export const AddEventMenu: React.FC<AddEventMenuProps> = ({ date, position, onSelect, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div ref={menuRef} className="add-event-menu" style={{ top: position.y, left: position.x }}>
            <button onClick={() => onSelect('appuntamento', date)}>🗓️ Appuntamento</button>
            <hr />
            <button onClick={() => onSelect('ferie', date)}>🏖️ Ferie</button>
            <button onClick={() => onSelect('permessi', date)}>⏰ Permesso</button>
            <button onClick={() => onSelect('straordinario', date)}>🏃 Straordinario</button>
            <button onClick={() => onSelect('reperibilita', date)}>📞 Reperibilità</button>
            <button onClick={() => onSelect('progetto', date)}>💼 Progetto</button>
            <hr />
            <button onClick={() => onSelect('cambio_turno', date)}>🔄 Cambio Turno</button>
        </div>
    );
};