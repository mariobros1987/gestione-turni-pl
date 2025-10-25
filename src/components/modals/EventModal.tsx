import React, { useState, useEffect } from 'react';
import { AllEntryTypes, HolidayEntry, OvertimeTimeSlot, OvertimeDestination, PermitCategory, OnCallType } from '../../types/types';
import { calculateHours } from '../../utils/dateUtils';
import { GoogleGenAI, Type } from '@google/genai';

interface EventModalProps {
    mode: 'add' | 'edit';
    entry: AllEntryTypes | null;
    date: string; // Data di riferimento, specialmente per la modalità 'add'
    type?: AllEntryTypes['type']; // Tipo di evento da creare in modalità 'add'
    onSave: (entry: AllEntryTypes | AllEntryTypes[]) => void;
    onDelete: (id: string, type: AllEntryTypes['type']) => void;
    onSplitDelete: (holiday: HolidayEntry, dateToDelete: string) => void;
    onClose: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({ mode, entry, date, type, onSave, onDelete, onSplitDelete, onClose }) => {
    const getInitialFormData = (): AllEntryTypes => {
        // PRIORITY 1: If an entry is passed directly (for editing OR for pre-filling), use it.
        if (entry) {
            return entry;
        }
        
        // PRIORITY 2: If no entry is passed, create a new blank one for 'add' mode.
        const base = { id: '', date: date, notes: '' };
        switch (type) {
            case 'ferie':
                return { ...base, type: 'ferie', value: 1 };
            case 'permessi':
                return { ...base, type: 'permessi', value: 0, startTime: '08:00', endTime: '09:00', category: 'Personale' };
            case 'straordinario':
                return { ...base, type: 'straordinario', value: 0, startTime: '14:00', endTime: '15:00', timeSlot: 'Diurno', destination: 'pagamento' };
            case 'reperibilita':
                return { ...base, type: 'reperibilita', value: 0, startTime: '22:00', endTime: '07:00', onCallType: 'Feriale' };
            case 'progetto':
                return { ...base, type: 'progetto', value: 0, startTime: '22:00', endTime: '00:00' };
            case 'appuntamento':
                 return { ...base, type: 'appuntamento', title: '', startTime: '10:00', endTime: '11:00', value: 1 };
            default: // Fallback, non dovrebbe accadere
                return { ...base, type: 'ferie', value: 1 };
        }
    };

    const [formData, setFormData] = useState(getInitialFormData);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [timeError, setTimeError] = useState('');

    useEffect(() => {
        setFormData(getInitialFormData());
        setTimeError('');
        setAiPrompt('');
        setAiError('');
    }, [entry, mode, date, type]);

    const handleAiParse = async () => {
        if (!aiPrompt) return;
        setIsAiLoading(true);
        setAiError('');
        
        // FIX: Switched to process.env.API_KEY to align with @google/genai guidelines.
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setAiError("Funzionalità AI non configurata. La chiave API non è stata trovata.");
            setIsAiLoading(false);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            let schema: any;
            let specificInstructions = '';

            const basePrompt = `Sei un assistente che analizza una nota di servizio per un agente di Polizia Locale e la converte in dati strutturati. Estrai le informazioni dal testo fornito e restituiscile in formato JSON secondo lo schema. Se un'informazione (come l'ora di fine o una nota) non è presente nel testo, omettila dalla risposta JSON. Il testo da analizzare è: "${aiPrompt}"`;

            switch (formData.type) {
                case 'straordinario':
                    specificInstructions = `Estrai orario di inizio, fine, note, la fascia oraria (Diurno, Notturno, Festivo) e la destinazione (pagamento, recupero).`;
                    schema = {
                        type: Type.OBJECT,
                        properties: {
                            startTime: { type: Type.STRING },
                            endTime: { type: Type.STRING },
                            notes: { type: Type.STRING },
                            timeSlot: { type: Type.STRING, enum: ['Diurno', 'Notturno', 'Festivo'] },
                            destination: { type: Type.STRING, enum: ['pagamento', 'recupero'] }
                        }
                    };
                    break;
                case 'permessi':
                     specificInstructions = `Estrai orario di inizio, fine, note e la categoria del permesso (Personale, L.104, Studio, Sindacale).`;
                     schema = {
                        type: Type.OBJECT,
                        properties: {
                            startTime: { type: Type.STRING },
                            endTime: { type: Type.STRING },
                            notes: { type: Type.STRING },
                            category: { type: Type.STRING, enum: ['Personale', 'L.104', 'Studio', 'Sindacale'] }
                        }
                    };
                    break;
                case 'reperibilita':
                    specificInstructions = `Estrai orario di inizio, fine, note e il tipo di reperibilità (Feriale, Festiva).`;
                    schema = {
                        type: Type.OBJECT,
                        properties: {
                            startTime: { type: Type.STRING },
                            endTime: { type: Type.STRING },
                            notes: { type: Type.STRING },
                            onCallType: { type: Type.STRING, enum: ['Feriale', 'Festiva'] }
                        }
                    };
                    break;
                case 'progetto':
                    specificInstructions = `Estrai orario di inizio, fine e le note relative al progetto.`;
                    schema = {
                        type: Type.OBJECT,
                        properties: {
                            startTime: { type: Type.STRING },
                            endTime: { type: Type.STRING },
                            notes: { type: Type.STRING }
                        }
                    };
                    break;
                 case 'appuntamento':
                    specificInstructions = `Estrai un titolo, orario di inizio, fine e le note relative all'appuntamento.`;
                    schema = {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            startTime: { type: Type.STRING },
                            endTime: { type: Type.STRING },
                            notes: { type: Type.STRING }
                        }
                    };
                    break;
                default:
                    return; // Non fare nulla per tipi non supportati
            }
            
            const fullPrompt = `${basePrompt}\n\n${specificInstructions}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                },
            });

            const jsonStr = response.text?.trim() || '';
            const extractedData = JSON.parse(jsonStr);
            
            setFormData(prev => ({
                ...prev,
                ...extractedData
            }));

        } catch (error) {
            console.error("Errore durante l'analisi del testo con AI:", error);
            setAiError("Non è stato possibile analizzare il testo. Riprova.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'value' ? parseFloat(value) : value }));
    };
    
    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTimeError('');
        const { name, value } = e.target;
        const updatedData = { ...formData, [name]: value } as AllEntryTypes;
        
        if ('startTime' in updatedData && 'endTime' in updatedData && updatedData.type !== 'appuntamento') {
            const newHours = calculateHours(updatedData.date, updatedData.startTime, updatedData.endTime);
            updatedData.value = newHours;
        } else if (updatedData.type === 'appuntamento') {
            const newHours = calculateHours(updatedData.date, updatedData.startTime, updatedData.endTime);
            updatedData.value = newHours;
        }
        setFormData(updatedData);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.type === 'reperibilita') {
            // Suddividi in due eventi: Parte 1 sempre nel giorno selezionato, Parte 2 nel giorno successivo
            const dateStr1 = formData.date;
            const entry1 = {
                ...formData,
                id: `${dateStr1}-22:00-00:00-${Math.random()}`,
                date: dateStr1,
                startTime: '22:00',
                endTime: '00:00',
                value: calculateHours(dateStr1, '22:00', '00:00'),
                notes: formData.notes ? formData.notes + ' (Parte 1)' : 'Reperibilità (Parte 1)',
            };
            // Calcola giorno successivo in locale
            const d2 = new Date(dateStr1 + 'T00:00:00');
            d2.setDate(d2.getDate() + 1);
            const pad = (n: number) => n.toString().padStart(2, '0');
            const dateStr2 = `${d2.getFullYear()}-${pad(d2.getMonth() + 1)}-${pad(d2.getDate())}`;
            const entry2 = {
                ...formData,
                id: `${dateStr2}-00:00-07:00-${Math.random()}`,
                date: dateStr2,
                startTime: '00:00',
                endTime: '07:00',
                value: calculateHours(dateStr2, '00:00', '07:00'),
                notes: formData.notes ? formData.notes + ' (Parte 2)' : 'Reperibilità (Parte 2)',
            };
            onSave([entry1, entry2]);
            onClose();
            return;
        }

        if ('startTime' in formData && 'endTime' in formData) {
            const calculatedHours = calculateHours(formData.date, formData.startTime, formData.endTime);
            if (calculatedHours <= 0) {
                setTimeError("L'orario di fine deve essere successivo a quello di inizio.");
                return;
            }
        }
        
        const entryToSave = { ...formData };
        if (mode === 'add') {
             // Assegna un ID solo se è una nuova voce
             entryToSave.id = new Date().toISOString();
             // Calcola le ore per le nuove voci basate su tempo
             if('startTime' in entryToSave && 'endTime' in entryToSave){
                entryToSave.value = calculateHours(entryToSave.date, entryToSave.startTime, entryToSave.endTime);
             }
        }
        onSave(entryToSave);
        onClose();
    };

    const handleDeleteClick = () => {
        if (formData.type === 'ferie' && formData.value > 1 && mode === 'edit') {
            setShowDeleteConfirm(true);
        } else if (mode === 'edit' && entry) {
            onDelete(entry.id, entry.type);
            onClose();
        }
    };

    const handleDeleteDay = () => {
        if (entry) {
            onSplitDelete(entry as HolidayEntry, date);
        }
        onClose();
    };

    const handleDeleteAll = () => {
        if (entry) {
            onDelete(entry.id, entry.type);
        }
        onClose();
    };


    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose} aria-label="Chiudi finestra">&times;</button>
                <h3>{mode === 'add' ? 'Aggiungi Voce' : 'Modifica Voce'}</h3>
                <form onSubmit={handleSubmit} className="modal-form">
                     {formData.type !== 'ferie' && (
                        <div className="ai-creation-box">
                            <h4>Crea con AI</h4>
                            <div className="form-group">
                                <label htmlFor="ai-prompt">Incolla qui la nota di servizio</label>
                                <textarea
                                    id="ai-prompt"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder="Es. Straordinario per viabilità dalle 15 alle 18"
                                    disabled={isAiLoading}
                                />
                            </div>
                            <button
                                type="button"
                                className="btn-ai-parse"
                                onClick={handleAiParse}
                                disabled={isAiLoading || !aiPrompt}
                            >
                                {isAiLoading ? 'Analisi in corso...' : 'Analizza Testo ✨'}
                            </button>
                            {aiError && <p className="ai-error">{aiError}</p>}
                        </div>
                    )}
                    <div className="form-group">
                        <label>Data</label>
                        <input type="date" name="date" value={formData.date} onChange={handleChange} required />
                    </div>
                    {formData.type === 'ferie' && (
                        <div className="form-group">
                            <label>Giorni</label>
                            <input type="number" name="value" value={formData.value} onChange={handleChange} min="1" required />
                        </div>
                    )}
                    {formData.type === 'appuntamento' && (
                        <>
                            <div className="form-group">
                                <label>Titolo</label>
                                <input type="text" name="title" value={(formData as any).title} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label>Orario (Inizio - Fine)</label>
                                <div className="time-range-group">
                                    <input type="time" name="startTime" value={(formData as any).startTime} onChange={handleTimeChange} required />
                                    <span>-</span>
                                    <input type="time" name="endTime" value={(formData as any).endTime} onChange={handleTimeChange} required />
                                </div>
                                {timeError && <small className="warning-text">{timeError}</small>}
                            </div>
                        </>
                    )}
                    {formData.type !== 'ferie' && formData.type !== 'appuntamento' && 'startTime' in formData && (
                         <div className="form-group">
                            <label>Orario (Inizio - Fine)</label>
                            <div className="time-range-group">
                                <input type="time" name="startTime" value={formData.startTime} onChange={handleTimeChange} required />
                                <span>-</span>
                                <input type="time" name="endTime" value={formData.endTime} onChange={handleTimeChange} required />
                            </div>
                            {timeError && <small className="warning-text">{timeError}</small>}
                        </div>
                    )}
                    {formData.type === 'permessi' && (
                        <div className="form-group">
                            <label>Tipologia</label>
                            <select name="category" value={(formData as any).category} onChange={handleChange}>
                                <option>Personale</option><option>L.104</option><option>Studio</option><option>Sindacale</option>
                            </select>
                        </div>
                    )}
                    {formData.type === 'straordinario' && (
                        <>
                            <div className="form-group">
                                <label>Fascia</label>
                                <select name="timeSlot" value={(formData as any).timeSlot} onChange={handleChange}>
                                    <option>Diurno</option><option>Notturno</option><option>Festivo</option>
                                </select>
                            </div>
                             <div className="form-group">
                                <label>Destinazione</label>
                                <div className="radio-group">
                                    <label><input type="radio" name="destination" value="pagamento" checked={(formData as any).destination === 'pagamento'} onChange={handleChange} /> Pagamento</label>
                                    <label><input type="radio" name="destination" value="recupero" checked={(formData as any).destination === 'recupero'} onChange={handleChange} /> Recupero</label>
                                </div>
                            </div>
                        </>
                    )}
                    {formData.type === 'reperibilita' && (
                        <div className="form-group">
                            <label>Tipologia</label>
                            <select name="onCallType" value={(formData as any).onCallType} onChange={handleChange}>
                               <option>Feriale</option><option>Festiva</option>
                            </select>
                        </div>
                    )}
                     <div className="form-group">
                        <label>Note</label>
                        <input type="text" name="notes" value={formData.notes} onChange={handleChange} />
                    </div>

                    {showDeleteConfirm ? (
                        <div className="delete-confirm">
                            <p>Vuoi eliminare solo il giorno selezionato o l'intero periodo di ferie?</p>
                            <div className="modal-actions">
                                <button type="button" onClick={handleDeleteDay} className="btn-delete-day">Solo il giorno</button>
                                <button type="button" onClick={handleDeleteAll} className="btn-delete-modal">Tutto l'evento 🗑️</button>
                                <button type="button" onClick={() => setShowDeleteConfirm(false)} className="btn-cancel">Annulla</button>
                            </div>
                        </div>
                    ) : (
                        <div className="modal-actions">
                            <button type="submit" className="btn-save">{mode === 'add' ? 'Aggiungi ➕' : 'Salva ✔️'}</button>
                            {mode === 'edit' && <button type="button" onClick={handleDeleteClick} className="btn-delete-modal">Elimina 🗑️</button>}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};