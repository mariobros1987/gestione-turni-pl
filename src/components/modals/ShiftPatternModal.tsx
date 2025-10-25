import React, { useState, useEffect, DragEvent } from 'react';
import { parseShiftPattern } from '../../utils/shiftUtils';
import { ShiftDefinition } from '../../types/types';

// Constants for shift names and week days to reconstruct the pattern string
const SHIFT_NAMES = ['Mattina', 'Pomeriggio', 'Notte', 'Riposo', 'Vuoto'];
const WEEK_DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

interface ShiftPatternModalProps {
    initialPattern: string;
    initialDefinitions: ShiftDefinition;
    onSave: (newPattern: string, newDefinitions: ShiftDefinition) => void;
    onClose: () => void;
}

export const ShiftPatternModal: React.FC<ShiftPatternModalProps> = ({ initialPattern, initialDefinitions, onSave, onClose }) => {
    // State for the list of shift names in the cycle
    const [patternDays, setPatternDays] = useState<string[]>([]);
    // State for the start/end time definitions of each shift type
    const [definitions, setDefinitions] = useState<ShiftDefinition>(initialDefinitions);
    // State to track the index of the item being dragged
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Parse the initial pattern string into a list of shift names when the component mounts
    useEffect(() => {
        const parsed = parseShiftPattern(initialPattern);
        setPatternDays(parsed.map(p => p.name || 'Riposo'));
    }, [initialPattern]);

    // Handlers for modifying the pattern
    const handleAddDay = () => {
        setPatternDays(prev => [...prev, 'Riposo']); // Add a new 'Riposo' day by default
    };

    const handleRemoveDay = (index: number) => {
        setPatternDays(prev => prev.filter((_, i) => i !== index));
    };

    const handleShiftChange = (index: number, newShift: string) => {
        setPatternDays(prev => {
            const newPattern = [...prev];
            newPattern[index] = newShift;
            return newPattern;
        });
    };

    // Handler for changing shift start/end times
    const handleDefinitionChange = (shiftName: string, field: 'start' | 'end', value: string) => {
        setDefinitions(prev => ({
            ...prev,
            [shiftName]: {
                ...prev[shiftName],
                [field]: value,
            }
        }));
    };
    
    // Handler for saving the changes
    const handleSave = () => {
        // Reconstruct the pattern string from the state
        const patternString = patternDays
            .map((shiftName, index) => {
                if (!shiftName) return null;
                const dayOfWeek = WEEK_DAYS[index % 7];
                const shiftDetails = definitions[shiftName as keyof typeof definitions];
                // 'Riposo' or 'Vuoto' shifts should not have time values
                const start = (shiftName === 'Riposo' || shiftName === 'Vuoto') ? '' : (shiftDetails?.start || '');
                const end = (shiftName === 'Riposo' || shiftName === 'Vuoto') ? '' : (shiftDetails?.end || '');
                return `${dayOfWeek},${shiftName},${start},${end}`;
            })
            .filter(line => line !== null)
            .join('\n');
        onSave(patternString, definitions);
        onClose();
    };

    const handleClearPattern = () => {
        if (window.confirm("Sei sicuro di voler svuotare l'intero schema? Tutti i giorni verranno impostati su 'Vuoto'.")) {
            setPatternDays(prev => prev.map(() => 'Vuoto'));
        }
    };

    // Drag & Drop Handlers
    const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
        setDraggedIndex(index);
        e.currentTarget.classList.add('dragging'); // Add class for visual feedback
    };
    
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // This is necessary to allow dropping
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIndex) return;
        
        // Reorder the array
        const newPattern = [...patternDays];
        const [draggedItem] = newPattern.splice(draggedIndex, 1);
        newPattern.splice(targetIndex, 0, draggedItem);
        
        setPatternDays(newPattern);
    };
    
    const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('dragging');
        setDraggedIndex(null);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content shift-pattern-modal-content">
                <div className="shift-pattern-modal-header">
                    <h3>Editor Schema Turni</h3>
                    <button onClick={handleClearPattern} className="btn-clear-schema" title="Svuota l'intero schema">Svuota Schema 🗑️</button>
                    <button className="modal-close-btn" onClick={onClose} aria-label="Chiudi finestra">&times;</button>
                </div>
                <div className="shift-pattern-modal-body">
                    {/* Section to edit start/end times for each shift type */}
                    <div className="shift-time-editor">
                        <h4>Orari dei Turni</h4>
                        {['Mattina', 'Pomeriggio', 'Notte'].map(shiftName => (
                            <div key={shiftName} className="shift-time-editor-row">
                                <label>{shiftName}</label>
                                <div className="time-range-group">
                                    <input 
                                        type="time" 
                                        value={definitions[shiftName]?.start || ''}
                                        onChange={(e) => handleDefinitionChange(shiftName, 'start', e.target.value)}
                                    />
                                    <span>-</span>
                                    <input 
                                        type="time" 
                                        value={definitions[shiftName]?.end || ''}
                                        onChange={(e) => handleDefinitionChange(shiftName, 'end', e.target.value)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="instructions">Crea il tuo ciclo di turni. Aggiungi, rimuovi e riordina i giorni trascinandoli.</p>
                    
                    {/* Container for the dynamic list of days */}
                    <div className="shift-pattern-list-container">
                        {patternDays.map((shiftName, index) => (
                            <div 
                                key={index} 
                                className="shift-pattern-list-row"
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                            >
                                <span className="drag-handle" title="Trascina per riordinare">☰</span>
                                <span className="day-label">Giorno {index + 1}</span>
                                <select value={shiftName} onChange={(e) => handleShiftChange(index, e.target.value)}>
                                    {SHIFT_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                                <button onClick={() => handleRemoveDay(index)} className="btn-delete-shift-day" aria-label={`Rimuovi giorno ${index + 1}`}>🗑️</button>
                            </div>
                        ))}
                    </div>

                    <button onClick={handleAddDay} className="btn-add-day">Aggiungi Giorno al Ciclo ➕</button>
                </div>

                <div className="shift-pattern-modal-actions">
                    <button onClick={handleSave} className="btn-save">Salva ✔️</button>
                    <button onClick={onClose} className="btn-cancel">Annulla</button>
                </div>
            </div>
        </div>
    );
};