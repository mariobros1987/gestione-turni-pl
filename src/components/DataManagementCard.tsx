import React, { useRef, useState } from 'react';
import { AllEntryTypes, CollapsibleCardProps, ProfileData } from '../types/types';
import { generateIcsContent } from '../utils/icsUtils';

interface DataManagementCardProps extends CollapsibleCardProps {
    profileName: string;
    profileData: ProfileData;
    allEvents: AllEntryTypes[];
    onImportData: (data: ProfileData) => void;
}

export const DataManagementCard: React.FC<DataManagementCardProps> = ({ profileName, profileData, allEvents, onImportData, isCollapsed, onToggleCollapse }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importError, setImportError] = useState('');

    const handleExport = () => {
        try {
            const dataStr = JSON.stringify(profileData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `profilo_${profileName.replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Errore durante l'esportazione dei dati:", error);
            alert("Si è verificato un errore durante la creazione del file di backup.");
        }
    };
    
    const handleExportIcs = () => {
        try {
            const icsContent = generateIcsContent(profileName, profileData, allEvents);
            const blob = new Blob([icsContent], { type: 'text/calendar' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `calendario_${profileName.replace(/\s+/g, '_')}.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Errore durante l'esportazione del calendario:", error);
            alert("Si è verificato un errore durante la creazione del file del calendario.");
        }
    };


    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportError('');
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error('Il contenuto del file non è leggibile.');

                const importedData = JSON.parse(text);

                // Validazione di base per assicurarsi che sia un oggetto con almeno una chiave attesa
                if (!importedData || typeof importedData !== 'object' || !('holidays' in importedData && 'salarySettings' in importedData)) {
                    throw new Error('Il file non sembra essere un backup valido per questa applicazione.');
                }
                
                const confirmed = window.confirm(
                    `Stai per SOVRASCRIVERE tutti i dati del profilo "${profileName}" con il contenuto del file "${file.name}".\n\nQuesta azione è irreversibile. Sei assolutamente sicuro di voler continuare?`
                );

                if (confirmed) {
                    onImportData(importedData as ProfileData);
                }

            } catch (error) {
                console.error("Errore durante l'importazione:", error);
                const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto.';
                setImportError(`Errore: ${errorMessage}`);
            } finally {
                 if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        
        reader.onerror = () => {
             setImportError('Impossibile leggere il file.');
             if (fileInputRef.current) fileInputRef.current.value = '';
        };

        reader.readAsText(file);
    };

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <h2>Gestione Dati Profilo</h2>
                <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <div className="data-section">
                       <h4>Esporta Dati (Backup)</h4>
                       <p>Salva una copia di sicurezza di tutti i dati del tuo profilo (eventi, turni, impostazioni) in un file. Conserva questo file per ripristinare i tuoi dati in futuro o su un altro dispositivo.</p>
                       <button onClick={handleExport} className="btn-secondary">
                            📥 Esporta i Miei Dati
                       </button>
                    </div>
                     <div className="data-section">
                       <h4>Sincronizzazione Calendario</h4>
                       <p>Esporta i tuoi turni ed eventi in un file .ics compatibile con Google Calendar, Apple Calendar e altri calendari esterni. Verranno inclusi tutti gli eventi e i turni dell'anno corrente.</p>
                       <button onClick={handleExportIcs} className="btn-secondary">
                            🗓️ Esporta Calendario (.ics)
                       </button>
                    </div>
                    <div className="data-section">
                       <h4>Importa Dati (Ripristino)</h4>
                       <p>Ripristina i dati da un file di backup esportato in precedenza. <strong>Attenzione:</strong> questa operazione sovrascriverà irreversibilmente tutti i dati attualmente presenti in questo profilo.</p>
                       <input 
                            type="file" 
                            accept=".json" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="sr-only" 
                            aria-hidden="true" 
                        />
                       <button onClick={handleImportClick} className="btn-add">
                            📤 Importa da File
                       </button>
                       {importError && <p className="import-error">{importError}</p>}
                    </div>
                </div>
            )}
        </div>
    );
};