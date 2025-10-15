import React, { useState, useRef } from 'react';
import { CardProps, CollapsibleCardProps, OnCallEntry, OnCallType } from '../types/types';
import { parseDateAsUTC, calculateHours } from '../utils/dateUtils';
import { GoogleGenAI, Type } from '@google/genai';
import * as XLSX from 'xlsx';

export const OnCallCard: React.FC<CardProps<OnCallEntry> & CollapsibleCardProps & {
    filterName: string;
    setFilterName: (value: string) => void;
}> = ({ entries, setEntries, isCollapsed, onToggleCollapse, filterName, setFilterName }) => {
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');
    const [onCallType, setOnCallType] = useState<OnCallType>('Feriale');
    const [timeError, setTimeError] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadInfo, setUploadInfo] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const totalValue = entries.reduce((sum, entry) => sum + entry.value, 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !startTime || !endTime) return;
        const calculatedHours = calculateHours(date, startTime, endTime);
        if (calculatedHours <= 0) {
            setTimeError("L'orario di fine deve essere successivo a quello di inizio.");
            return;
        }

        const newEntry: OnCallEntry = {
            id: new Date().toISOString(), date, value: calculatedHours, notes, onCallType, startTime, endTime, type: 'reperibilita'
        };
        setEntries([...entries, newEntry].sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));
        setDate(''); setStartTime(''); setEndTime(''); setNotes(''); setTimeError('');
    };

    const handleDelete = (id: string) => setEntries(entries.filter(entry => entry.id !== id));
    
    const handleDownloadTemplate = () => {
        const ws_data = [
            ["Nome", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
            ["DIBENEDETTO MARIO", "", "", "R", "", "", "", "", "", "", "", "R", "", "", "", "", "", "", "", "R", "", "", "", "", "", "", "", "R", "", "", "R"],
            ["ALTRO NOME", "R", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        if(!ws["A1"].c) ws["A1"].c = [];
        ws["A1"].c.push({a: "Istruzioni", t: "Inserisci la 'R' nelle celle corrispondenti ai giorni di reperibilità per ogni nominativo. L'applicazione leggerà il mese e l'anno dal nome del file (es. 'turni_settembre_2024.xlsx') o dal contenuto del file."});
        XLSX.utils.book_append_sheet(wb, ws, "Template Turni");
        XLSX.writeFile(wb, "template_reperibilita.xlsx");
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError('');
        setUploadInfo('');
        
        // FIX: Switched to process.env.API_KEY to align with @google/genai guidelines.
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setUploadError("Funzionalità AI non configurata. La chiave API non è stata trovata.");
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const supportedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (!supportedTypes.includes(file.type)) {
            setUploadError('Formato file non supportato. Carica un PDF o un file Excel (.xlsx).');
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });

            const schema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING, description: 'La data della reperibilità in formato YYYY-MM-DD.' },
                        startTime: { type: Type.STRING, description: 'L\'ora di inizio in formato HH:MM.' },
                        endTime: { type: Type.STRING, description: 'L\'ora di fine in formato HH:MM.' },
                        onCallType: { type: Type.STRING, description: 'Il tipo di reperibilità, deve essere "Feriale" o "Festiva".' },
                        notes: { type: Type.STRING, description: 'Eventuali note aggiuntive.' },
                    },
                    required: ['date', 'startTime', 'endTime', 'onCallType'],
                },
            };
            
            const basePrompt = `**OBIETTIVO FINALE**: Estrarre i turni di reperibilità SOLO per l'operatore '${filterName}' da un documento (PDF o testo CSV) che rappresenta un calendario di turni mensile. Il documento ha una struttura tabellare specifica.

**REGOLE DI ANALISI (DA SEGUIRE IN ORDINE E SENZA ECCEZioni):**

---

**1. IDENTIFICA IL CONTESTO: MESE E ANNO**
*   Prima di tutto, analizza l'intero documento per trovare il MESE e l'ANNO a cui si riferisce il calendario. Questa informazione è FONDAMENTALE e di solito si trova nel titolo (es. "TURNI SETTEMBRE 2024") o in un'intestazione. Se non la trovi, non puoi procedere.

**2. ANALIZZA LA STRUTTURA DELLA TABELLA (Simulazione OCR)**
*   Il documento contiene una tabella.
*   La **prima colonna** contiene i NOMI degli operatori.
*   Le **colonne successive alla prima** rappresentano i GIORNI DEL MESE in ordine sequenziale.
*   **REGOLA CHIAVE SULLE DATE**: La colonna numero 2 corrisponde al giorno 1 del mese identificato. La colonna 3 corrisponde al giorno 2. La colonna 4 al giorno 3, e così via. Non devi basarti sulle intestazioni di colonna per la data, ma sulla POSIZIONE della colonna.

**3. ESTRAI I TURNI SEGUENDO QUESTA LOGICA RIGIDA:**
*   **A. FILTRO ASSOLUTO SUL NOME**:
    *   Trova la riga esatta che corrisponde a '${filterName}'. Ignora maiuscole/minuscole e ordine nome/cognome.
    *   **IGNORA COMPLETAMENTE TUTTE LE ALTRE RIGHE.** L'analisi deve essere confinata ESCLUSIVAMENTE a questa singola riga. Se non trovi il nome, restituisci un array JSON vuoto \`[]\`.

*   **B. SCANSIONE DEI GIORNI E IDENTIFICAZIONE DELLA 'R'**:
    *   Partendo dalla seconda colonna della riga di '${filterName}', scorri ogni colonna verso destra.
    *   Per ogni colonna, controlla se la cella contiene la lettera 'R'.

*   **C. CREAZIONE DELLE VOCI DI REPERIBILITÀ**:
    *   Se trovi una 'R' nella colonna numero 'N', il giorno del mese è 'N - 1'.
    *   Esempio: Una 'R' nella 16ª colonna della tabella corrisponde al giorno 15 del mese (16 - 1 = 15).
    *   Per OGNI 'R' trovata, applica la **REGOLA DI SUDDIVISIONE OBBLIGATORIA**:
        *   **Parte 1**: Crea un turno dalle **22:00** alle **00:00** del giorno calcolato. Usa la nota "Reperibilità (Parte 1)".
        *   **Parte 2**: Crea un turno dalle **00:01** alle **07:00** del giorno **SUCCESSIVO**. Usa la nota "Reperibilità (Parte 2)".
    *   Determina se ogni parte del turno cade in un giorno 'Feriale' o 'Festiva'.

**ESEMPIO PRATICO DI RAGIONAMENTO:**
1.  **Contesto**: Leggo "Turnazione Ottobre 2024" nel titolo. Mese = Ottobre, Anno = 2024.
2.  **Struttura**: Vedo una tabella. La prima colonna ha i nomi.
3.  **Estrazione**:
    *   **A. Filtro**: Trovo la riga "DIBENEDETTO MARIO". Ignoro tutte le altre.
    *   **B. Scansione**: Scorro la riga di Mario. Nella colonna 5 trovo una 'R'.
    *   **C. Creazione**:
        *   Il giorno è 5 - 1 = 4. La data è 4 Ottobre 2024.
        *   Creo la Parte 1: \`{ "date": "2024-10-04", "startTime": "22:00", "endTime": "00:00", "onCallType": "Feriale", "notes": "Reperibilità (Parte 1)" }\`
        *   Creo la Parte 2: \`{ "date": "2024-10-05", "startTime": "00:01", "endTime": "07:00", "onCallType": "Feriale", "notes": "Reperibilità (Parte 2)" }\` (assumendo che 4 e 5 Ottobre siano feriali).
4.  Continuo la scansione per altre 'R' nella stessa riga e ripeto il processo.
5.  Alla fine, restituisco un array JSON contenente tutte le parti generate.

Applica questa logica al documento fornito.`;

            let modelContents;

            if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const csvData = XLSX.utils.sheet_to_csv(worksheet);

                const excelPrompt = `${basePrompt}

Il testo seguente è in formato CSV e rappresenta una tabella di turni. Applica le regole sopra descritte.

Ecco i dati CSV:
${csvData}`;

                modelContents = {
                    parts: [{ text: excelPrompt }]
                };

            } else { // Handle PDF file
                 const base64Data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = error => reject(error);
                });
                
                const pdfPrompt = `${basePrompt}

Il documento allegato è un PDF che contiene una tabella o un calendario di turni. Applica le regole sopra descritte al suo contenuto.`;


                modelContents = {
                    parts: [
                        { text: pdfPrompt },
                        { inlineData: { mimeType: file.type, data: base64Data } }
                    ]
                };
            }


            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: modelContents,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                },
            });

            const jsonStr = response.text?.trim() || '';
            const newEntriesData = JSON.parse(jsonStr);

            if (!Array.isArray(newEntriesData)) {
                throw new Error("Il formato della risposta non è un array.");
            }
            
            const existingEntryKeys = new Set(entries.map(e => `${e.date}|${e.startTime}`));
            let addedCount = 0;
            
            const newEntries: OnCallEntry[] = newEntriesData.map((item: any) => {
                if (!item.date || !item.startTime || !item.endTime || !item.onCallType) {
                    console.warn('Voce estratta non valida, la salto:', item);
                    return null;
                }
                
                // Normalizza la data in formato YYYY-MM-DD
                const d = new Date(item.date);
                if (isNaN(d.getTime())) {
                    console.warn('Data non valida, la salto:', item.date);
                    return null;
                }
                const normalizedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                const entryKey = `${normalizedDate}|${item.startTime}`;
                if (existingEntryKeys.has(entryKey)) {
                    return null; // Duplicato, salta
                }

                const calculatedHours = calculateHours(normalizedDate, item.startTime, item.endTime);
                if (calculatedHours <= 0) return null;
                
                return {
                    id: `${new Date().toISOString()}-${Math.random()}`,
                    date: normalizedDate,
                    value: calculatedHours,
                    notes: item.notes || '',
                    onCallType: item.onCallType,
                    startTime: item.startTime,
                    endTime: item.endTime,
                    type: 'reperibilita',
                };
            }).filter((e): e is OnCallEntry => e !== null);

            addedCount = newEntries.length;
            const skippedCount = newEntriesData.length - addedCount;

            if (addedCount > 0) {
                 setEntries([...entries, ...newEntries].sort((a,b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()));
            }
            
            setUploadInfo(`${addedCount} nuovi turni aggiunti. ${skippedCount} turni duplicati o non validi sono stati ignorati.`);

        } catch (error) {
            console.error("Errore durante l'analisi del file:", error);
            setUploadError('Impossibile analizzare il file. La struttura potrebbe non essere riconosciuta o il nome non trovato. Riprova.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Reperibilità</h2>
                    <p className="summary">Totale ore svolte: <span>{totalValue.toLocaleString('it-IT')} ore</span></p>
                </div>
                <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <div className="pdf-upload-section">
                        <h4>Importazione Automatica</h4>
                        <div className="upload-recommendation">
                            <p><strong>Consiglio:</strong> Per la massima precisione, usa il nostro template Excel. L'analisi dei PDF può essere imprecisa.</p>
                            <button
                                onClick={handleDownloadTemplate}
                                className="btn-secondary-outline"
                            >
                                📥 Scarica Template Excel
                            </button>
                        </div>
                        <p>Carica il PDF o Excel con i turni per aggiungerli automaticamente.</p>
                        <div className="form-group">
                            <label htmlFor="filter-name">Nome da Filtrare nel PDF/Excel</label>
                            <input type="text" id="filter-name" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Es. Mario Rossi" />
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                            className="sr-only"
                            aria-hidden="true"
                            disabled={isUploading}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-upload-pdf"
                            disabled={isUploading}
                        >
                            {isUploading ? 'Caricamento...' : '📤 Carica File'}
                        </button>
                        {uploadError && <p className="upload-error">{uploadError}</p>}
                        {uploadInfo && <p className="upload-info">{uploadInfo}</p>}
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="oncall-date">Data</label>
                            <input type="date" id="oncall-date" value={date} onChange={(e) => setDate(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="oncall-type">Tipologia</label>
                            <select id="oncall-type" value={onCallType} onChange={e => setOnCallType(e.target.value as OnCallType)}>
                                <option>Feriale</option>
                                <option>Festiva</option>
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
                            <label htmlFor="oncall-notes">Note</label>
                            <input type="text" id="oncall-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dettagli aggiuntivi" />
                        </div>
                        <button type="submit" className="btn-add">Aggiungi ➕</button>
                    </form>
                    <ul className="entry-list">
                        {entries.map(entry => (
                            <li key={entry.id}>
                                <div className="entry-details">
                                    <span className="date">{new Date(entry.date).toLocaleDateString('it-IT', { timeZone: 'UTC' })} - [{entry.onCallType}]</span>
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