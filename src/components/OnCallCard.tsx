import React, { useState, useRef, useContext } from 'react';
import { AppContext } from '../AppContext';
import { CardProps, CollapsibleCardProps, OnCallEntry, OnCallType } from '../types/types';
import { parseDateAsUTC, calculateHours } from '../utils/dateUtils';
import { GoogleGenAI, Type } from '@google/genai';
import * as XLSX from 'xlsx';

export const OnCallCard: React.FC<CardProps<OnCallEntry> & CollapsibleCardProps & {
    setOnCall?: (entries: OnCallEntry[]) => void;
}> = ({
    entries,
    setEntries,
    isCollapsed,
    onToggleCollapse,
    setOnCall
}) => {
    const [localFilterName, setLocalFilterName] = useState('');
    const appContext = useContext(AppContext);
    const [date, setDate] = useState('');
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [multiDays, setMultiDays] = useState('');
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('07:00');
    const [notes, setNotes] = useState('');
    const [onCallType, setOnCallType] = useState<OnCallType>('Feriale');
    const [timeError, setTimeError] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadInfo, setUploadInfo] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const totalValue = entries.reduce((sum: number, entry: OnCallEntry) => sum + entry.value, 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!appContext || !appContext.handleSaveEvent) {
            alert('Impossibile salvare globalmente. Ricarica la pagina.');
            return;
        }

    if (multiDays.trim()) {
            const days = multiDays.split(/\s+/).map(d => parseInt(d, 10)).filter(d => !isNaN(d) && d >= 1 && d <= 31);
            if (days.length === 0) return;

            const newEntries = days.flatMap(day => {
                // Evento 1: giorno selezionato, 22:00-00:00
                const d1 = new Date(year, month - 1, day, 22, 0, 0); // 22:00 locale
                const dateStr1 = d1.toISOString().slice(0, 10);
                console.log(`DEBUG: Giorno selezionato: ${day}, Mese: ${month}, Anno: ${year} -> Data generata:`, d1.toString());
                const entry1: OnCallEntry = {
                    id: `${dateStr1}-22:00-00:00-${Math.random()}`,
                    date: dateStr1,
                    value: calculateHours(dateStr1, '22:00', '00:00'),
                    notes: 'Reperibilità (Parte 1)',
                    onCallType,
                    startTime: '22:00',
                    endTime: '00:00',
                    type: 'reperibilita',
                };
                // Evento 2: giorno successivo, 00:00-07:00
                const d2 = new Date(d1);
                d2.setDate(d1.getDate() + 1); // giorno successivo
                const dateStr2 = d2.toISOString().slice(0, 10);
                console.log(`DEBUG: Giorno successivo: ${day + 1}, Mese: ${d2.getMonth() + 1}, Anno: ${d2.getFullYear()} -> Data generata:`, d2.toString());
                const entry2: OnCallEntry = {
                    id: `${dateStr2}-00:00-07:00-${Math.random()}`,
                    date: dateStr2,
                    value: calculateHours(dateStr2, '00:00', '07:00'),
                    notes: 'Reperibilità (Parte 2)',
                    onCallType,
                    startTime: '00:00',
                    endTime: '07:00',
                    type: 'reperibilita',
                };
                return [entry1, entry2];
            });

            const updated = [...entries, ...newEntries].sort((a, b) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime());
            setEntries(updated);
            if (setOnCall) setOnCall(updated);
            console.log('DEBUG OnCallCard - Array completo:', updated);

            if (appContext?.handleSaveEvent) {
                console.log('Salvo eventi multipli:', newEntries);
                appContext.handleSaveEvent?.(newEntries);
            }

            setMultiDays('');
            setDate('');
            setStartTime('');
            setEndTime('');
            setNotes('');
            setTimeError('');
            return;
        }

        if (!date || !startTime || !endTime) return;
        
        // Suddivisione evento singolo in due parti come per i giorni multipli
        const d1 = new Date(date + 'T22:00:00'); // giorno selezionato, 22:00
        const dateStr1 = d1.toISOString().slice(0, 10);
        const entry1: OnCallEntry = {
            id: `${dateStr1}-22:00-00:00-${Math.random()}`,
            date: dateStr1,
            value: calculateHours(dateStr1, '22:00', '00:00'),
            notes: notes ? notes + ' (Parte 1)' : 'Reperibilità (Parte 1)',
            onCallType,
            startTime: '22:00',
            endTime: '00:00',
            type: 'reperibilita',
        };
        // Parte 2: giorno successivo, 00:00-07:00
        const d2 = new Date(d1);
        d2.setDate(d1.getDate() + 1);
        const dateStr2 = d2.toISOString().slice(0, 10);
        const entry2: OnCallEntry = {
            id: `${dateStr2}-00:00-07:00-${Math.random()}`,
            date: dateStr2,
            value: calculateHours(dateStr2, '00:00', '07:00'),
            notes: notes ? notes + ' (Parte 2)' : 'Reperibilità (Parte 2)',
            onCallType,
            startTime: '00:00',
            endTime: '07:00',
            type: 'reperibilita',
        };
        const updated = [...entries, entry1, entry2].sort((a: OnCallEntry, b: OnCallEntry) => 
            parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()
        );
        setEntries(updated);
        if (setOnCall) setOnCall(updated);
        console.log('DEBUG OnCallCard - Array completo:', updated);
        appContext.handleSaveEvent?.([entry1, entry2]);
        setDate('');
        setStartTime('22:00');
        setEndTime('07:00');
        setNotes('');
        setTimeError('');
    };

    const handleDelete = (id: string) => {
        const updated = entries.filter((entry: OnCallEntry) => entry.id !== id);
        setEntries(updated);
        if (setOnCall) setOnCall(updated);
    };

    const handleDownloadTemplate = () => {
        const ws_data = [
            ["Nome", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
            ["DIBENEDETTO MARIO", "", "", "R", "", "", "", "", "", "", "", "R", "", "", "", "", "", "", "", "R", "", "", "", "", "", "", "", "R", "", "", "R"],
            ["ALTRO NOME", "R", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        if (!ws["A1"].c) ws["A1"].c = [];
        ws["A1"].c.push({
            a: "Istruzioni",
            t: "Inserisci la 'R' nelle celle corrispondenti ai giorni di reperibilità per ogni nominativo. Nomina il file con formato 'turni_mese_anno.xlsx' (es: turni_ottobre_2024.xlsx)"
        });
        XLSX.utils.book_append_sheet(wb, ws, "Template Turni");
        XLSX.writeFile(wb, "template_reperibilita.xlsx");
    };

    const extractMonthYearFromFilename = (filename: string): { month: number; year: number } | null => {
        const mesiItaliani: { [key: string]: number } = {
            'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4, 'maggio': 5, 'giugno': 6,
            'luglio': 7, 'agosto': 8, 'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12
        };

        const lowerFilename = filename.toLowerCase();
        const yearMatch = lowerFilename.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

        for (const [nome, num] of Object.entries(mesiItaliani)) {
            if (lowerFilename.includes(nome)) {
                return { month: num, year };
            }
        }

        const monthMatch = lowerFilename.match(/\b(0?[1-9]|1[0-2])\b/);
        if (monthMatch) {
            return { month: parseInt(monthMatch[1]), year };
        }

        return null;
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError('');
        setUploadInfo('');

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
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        try {
            const fileMonthYear = extractMonthYearFromFilename(file.name);
            const targetMonth = fileMonthYear?.month || month;
            const targetYear = fileMonthYear?.year || year;

            console.log(`📅 Importazione per ${targetMonth}/${targetYear} (estratto da: ${file.name})`);

            const ai = new GoogleGenAI({ apiKey });
            let modelContents;
            let basePrompt = '';
            let csvData = '';

            if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                csvData = XLSX.utils.sheet_to_csv(worksheet);
                const arrayData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                console.log('📊 DEBUG CSV completo:', csvData);
                console.log('📊 DEBUG Array:', arrayData);

                basePrompt = `Analizza questo CSV di turni di reperibilità con MASSIMA PRECISIONE.

STRUTTURA ESATTA DEL CSV:
Riga 1 (intestazione): "Nome",1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31
Riga 2+: "NOME COGNOME","valore_col2","valore_col3",...,"valore_col32"

DOVE:
- Colonna 1 (indice 0): Nome della persona
- Colonne 2-32 (indici 1-31): Giorni del mese da 1 a 31

COMPITO STEP-BY-STEP:
1. Trova la riga che contiene "${localFilterName}" nella PRIMA colonna
   - Usa match case-insensitive
   - Può essere match parziale (es. "MARIO" matcha "MARIO ROSSI")

2. Una volta trovata la riga corretta, analizza SOLO quella riga:
   - Parti dalla seconda colonna (indice 1) fino alla 32esima colonna (indice 31)
   - Per ogni colonna che contiene esattamente la lettera "R" (maiuscola)
   - Annota il numero del giorno corrispondente all'intestazione di quella colonna

3. ESEMPIO PRATICO:
   Se l'intestazione è:    "Nome", 1,  2,  3,  4,  5, ...
   E la riga è:            "MARIO", "", "", "R", "", "R", ...
   Allora i giorni sono:   [3, 5]

REGOLE CRITICHE:
- Restituisci SOLO un array di numeri interi da 1 a 31
- Se una cella contiene "R" (maiuscola), aggiungi il numero del giorno
- Ignora celle vuote, celle con altri valori
- Se non trovi il nome, restituisci array vuoto: []
- Se trovi il nome ma nessuna "R", restituisci array vuoto: []

OUTPUT ATTESO: [3, 11, 19, 27, 31]

CSV DA ANALIZZARE:
${csvData}

Restituisci SOLO l'array JSON, nient'altro.`;

                modelContents = {
                    parts: [{ text: basePrompt }]
                };
            } else {
                const base64Data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = error => reject(error);
                });

                basePrompt = `Analizza questo PDF di turni di reperibilità.

COMPITO:
1. Cerca il nome "${localFilterName}" nella tabella
2. Identifica tutti i giorni (1-31) dove appare "R" per quella persona
3. Restituisci array di numeri interi

Esempio output: [5, 12, 19, 26]`;

                modelContents = {
                    parts: [
                        { text: basePrompt },
                        { inlineData: { mimeType: file.type, data: base64Data } }
                    ]
                };
            }

            const schema = {
                type: Type.ARRAY,
                items: {
                    type: Type.INTEGER
                }
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: modelContents,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                },
            });

            const jsonStr = response.text?.trim() || '';
            console.log('🤖 Risposta RAW dall\'AI:', jsonStr);

            const daysArray: number[] = JSON.parse(jsonStr);
            console.log('📋 Giorni estratti:', daysArray);
            console.log('📅 Mese target:', targetMonth, '| Anno target:', targetYear);

            if (!Array.isArray(daysArray) || daysArray.length === 0) {
                throw new Error("Nessun giorno di reperibilità trovato per il nome specificato.");
            }

            const validDays = daysArray.filter(day =>
                typeof day === 'number' && day >= 1 && day <= 31
            );

            if (validDays.length === 0) {
                throw new Error("I giorni estratti non sono validi.");
            }

            console.log('✅ Giorni validi:', validDays);

            const newEntries: OnCallEntry[] = validDays.flatMap(day => {
                console.log(`\n🔨 Creo eventi per giorno ${day} di ${targetMonth}/${targetYear}`);

                const d = new Date(Date.UTC(targetYear, targetMonth - 1, day));
                console.log(`   📆 Data UTC creata: ${d.toISOString()}`);

                if (d.getUTCMonth() + 1 !== targetMonth || d.getUTCFullYear() !== targetYear) {
                    console.warn(`   ⚠️ Giorno ${day} non valido per ${targetMonth}/${targetYear}`);
                    return [];
                }

                const dateStr = d.toISOString().slice(0, 10);
                console.log(`   ✓ Data string: ${dateStr}`);

                const entry1: OnCallEntry = {
                    id: `${dateStr}-22:00-00:00-${Math.random()}`,
                    date: dateStr,
                    value: calculateHours(dateStr, '22:00', '00:00'),
                    notes: `Reperibilità ${localFilterName} (Parte 1)`,
                    onCallType: 'Feriale',
                    startTime: '22:00',
                    endTime: '00:00',
                    type: 'reperibilita',
                };

                const nextDay = new Date(d);
                nextDay.setUTCDate(d.getUTCDate() + 1);
                const nextDateStr = nextDay.toISOString().slice(0, 10);
                console.log(`   ✓ Data giorno +1: ${nextDateStr}`);

                const entry2: OnCallEntry = {
                    id: `${nextDateStr}-00:01-07:00-${Math.random()}`,
                    date: nextDateStr,
                    value: calculateHours(nextDateStr, '00:01', '07:00'),
                    notes: `Reperibilità ${localFilterName} (Parte 2)`,
                    onCallType: 'Feriale',
                    startTime: '00:01',
                    endTime: '07:00',
                    type: 'reperibilita',
                };

                console.log(`   ✓ Entry1:`, entry1);
                console.log(`   ✓ Entry2:`, entry2);

                return [entry1, entry2];
            });

            const existingKeys = new Set(
                entries.map((e: OnCallEntry) => `${e.date}|${e.startTime}|${e.endTime}`)
            );

            const uniqueEntries = newEntries.filter((e: OnCallEntry) =>
                true // RIMOSSO controllo duplicati: aggiungi sempre
            );

            const addedCount = uniqueEntries.length;
            const skippedCount = 0; // Non ci sono più duplicati

            console.log(`\n📊 RIEPILOGO:`);
            console.log(`   ✅ Nuovi turni: ${addedCount}`);
            console.log(`   ⏭️ Duplicati saltati: ${skippedCount}`);

            if (addedCount > 0) {
                const updatedEntries = [...entries, ...uniqueEntries].sort(
                    (a: OnCallEntry, b: OnCallEntry) => parseDateAsUTC(b.date).getTime() - parseDateAsUTC(a.date).getTime()
                );
                setEntries(updatedEntries);

                if (typeof appContext?.handleSaveEvent === 'function') {
                    uniqueEntries.forEach((entry: OnCallEntry) => {
                        appContext.handleSaveEvent && appContext.handleSaveEvent(entry);
                    });
                }
            }

            setUploadInfo(
                `✅ Importazione completata per ${targetMonth}/${targetYear}!\n` +
                `📊 ${validDays.length} giorni trovati: ${validDays.sort((a, b) => a - b).join(', ')}\n` +
                `➕ ${addedCount} nuovi turni aggiunti (${addedCount / 2} giorni)\n` +
                (skippedCount > 0 ? `⏭️ ${skippedCount} turni duplicati ignorati` : '')
            );

        } catch (error) {
            console.error("❌ Errore durante l'analisi del file:", error);
            setUploadError(
                `Impossibile analizzare il file. Possibili cause:\n` +
                `• Il nome "${localFilterName}" non è stato trovato nel file\n` +
                `• La struttura del file non corrisponde al template\n` +
                `• Non ci sono "R" per la persona specificata\n\n` +
                `Suggerimento: usa il template Excel scaricabile per risultati garantiti.`
            );
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
                <button
                    onClick={onToggleCollapse}
                    className="btn-toggle-collapse"
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}
                >
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <div className="pdf-upload-section">
                        <h4>Importazione Automatica</h4>
                        <div className="upload-recommendation">
                            <p><strong>Consiglio:</strong> Per la massima precisione, usa il nostro template Excel. L'analisi dei PDF può essere imprecisa.</p>
                            <p style={{ fontSize: '0.9em', color: '#666', marginTop: '8px' }}>
                                📝 <strong>Importante:</strong> Nomina il file con mese e anno (es: "turni_ottobre_2024.xlsx" o "turni_10_2024.xlsx")
                            </p>
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
                            <input
                                type="text"
                                id="filter-name"
                                value={localFilterName}
                                onChange={(e) => setLocalFilterName(e.target.value)}
                                placeholder="Es. DIBENEDETTO MARIO"
                            />
                            <small style={{ color: '#666', fontSize: '0.85em' }}>
                                💡 Inserisci il nome ESATTAMENTE come appare nel file. Il mese/anno verranno estratti dal nome del file.
                            </small>
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
                        {uploadError && <p className="upload-error" style={{ whiteSpace: 'pre-line' }}>{uploadError}</p>}
                        {uploadInfo && <p className="upload-info" style={{ whiteSpace: 'pre-line' }}>{uploadInfo}</p>}
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="multi-days">Giorni multipli (es: 5 10 15 19 27)</label>
                            <input
                                type="text"
                                id="multi-days"
                                value={multiDays}
                                onChange={e => setMultiDays(e.target.value)}
                                placeholder="5 10 15 19 27"
                            />
                        </div>
                        <div className="form-group" style={{ display: multiDays.trim() ? 'flex' : 'none', gap: 8 }}>
                            <label>Mese</label>
                            <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                                {[...Array(12)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                            </select>
                            <label>Anno</label>
                            <input
                                type="number"
                                value={year}
                                onChange={e => setYear(Number(e.target.value))}
                                style={{ width: 80 }}
                            />
                        </div>
                        <div className="form-group" style={{ display: !multiDays.trim() ? 'block' : 'none' }}>
                            <label htmlFor="oncall-date">Data (usa mese/anno di riferimento)</label>
                            <input
                                type="date"
                                id="oncall-date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required={!multiDays.trim()}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="oncall-type">Tipologia</label>
                            <select
                                id="oncall-type"
                                value={onCallType}
                                onChange={e => setOnCallType(e.target.value as OnCallType)}
                            >
                                <option>Feriale</option>
                                <option>Festiva</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Orario (Inizio - Fine)</label>
                            <div className="time-range-group">
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => { setStartTime(e.target.value); setTimeError(''); }}
                                    required
                                />
                                <span>-</span>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => { setEndTime(e.target.value); setTimeError(''); }}
                                    required
                                />
                            </div>
                            {timeError && <small className="warning-text">{timeError}</small>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="oncall-notes">Note</label>
                            <input
                                type="text"
                                id="oncall-notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Dettagli aggiuntivi"
                            />
                        </div>
                        <button type="submit" className="btn-add">Aggiungi ➕</button>
                    </form>
                    <ul className="entry-list">
                        {entries.map((entry: OnCallEntry) => (
                            <li key={entry.id}>
                                <div className="entry-details">
                                    <span className="date">
                                        {new Date(entry.date).toLocaleDateString('it-IT', { timeZone: 'UTC' })} - [{entry.onCallType}]
                                    </span>
                                    <span className="value">
                                        {entry.startTime}-{entry.endTime} ({entry.value} ore) {entry.notes && `- ${entry.notes}`}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleDelete(entry.id)}
                                    className="btn-delete"
                                    aria-label={`Elimina voce del ${entry.date}`}
                                >
                                    🗑️
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};