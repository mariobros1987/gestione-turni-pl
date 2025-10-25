import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Nota: Web NFC è supportato principalmente su Chrome per Android. Forniamo tipizzazioni minime
// per evitare errori TypeScript quando l'API non è disponibile in ambienti desktop.
declare global {
  interface Window {
    NDEFReader?: {
      new (): NdefReader;
    };
  }
}

interface NdefReader {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((event: NdefReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
  addEventListener: (type: 'reading' | 'readingerror', listener: (event: any) => void) => void;
}

interface NdefReadingEvent extends Event {
  serialNumber?: string;
  message: {
    records: Array<{
      recordType: string;
      mediaType?: string;
      data?: BufferSource;
    }>;
  };
}

type CheckInType = 'entrata' | 'uscita';

type ScanStatus = 'idle' | 'scanning' | 'success' | 'error';

export interface NfcCheckInButtonProps {
  onRegister: (type: CheckInType, context?: { rawPayload?: string; serialNumber?: string; timestamp?: Date }) => void;
  lastEntryType?: CheckInType | null;
  onCreateEvent?: (type: CheckInType, timestamp: Date) => void; // Callback per creare evento calendario
  workLocation?: string; // Sede di lavoro da inserire nell'evento
}

const SUPPORTED_BROWSER_MESSAGE =
  'La scansione NFC funziona su Chrome per Android (versione 89+). Assicurati che NFC sia attivo sul telefono.';

const decodeRecordPayload = (record: { recordType: string; data?: BufferSource }): string | null => {
  if (!record?.data) {
    return null;
  }

  try {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(record.data);
  } catch (error) {
    console.warn('⚠️ Impossibile decodificare il payload NFC', error);
    return null;
  }
};

const extractCheckInType = (rawPayload: string): CheckInType | null => {
  const normalized = rawPayload.trim().toLowerCase();

  if (normalized.includes('uscita')) {
    return 'uscita';
  }
  if (normalized.includes('entrata')) {
    return 'entrata';
  }

  try {
    const maybeUrl = new URL(normalized);
    const typeParam = maybeUrl.searchParams.get('type');
    if (typeParam === 'entrata' || typeParam === 'uscita') {
      return typeParam;
    }
  } catch {
    // Ignora: il payload non è un URL valido
  }

  return null;
};

export const NfcCheckInButton: React.FC<NfcCheckInButtonProps> = ({ 
  onRegister, 
  lastEntryType,
  onCreateEvent,
  workLocation = 'Sede principale'
}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && typeof window.NDEFReader !== 'undefined');
  }, []);

  const canStartScan = useMemo(() => isSupported && status !== 'scanning', [isSupported, status]);

  const abortScan = useCallback((resetFeedback = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (resetFeedback) {
      setStatus('idle');
      setMessage('');
    }
  }, []);

  useEffect(() => () => abortScan(true), [abortScan]);

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = window.setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 4000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [status]);

  const handleScan = useCallback(async () => {
    if (!isSupported || !window.NDEFReader) {
      setStatus('error');
      setMessage('Web NFC non è supportato su questo dispositivo.');
      return;
    }

    if (status === 'scanning') {
      abortScan(true);
      return;
    }

    try {
      const reader = new window.NDEFReader();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const handleReading = (event: NdefReadingEvent) => {
        const [record] = event.message.records;
        const rawPayload = record ? decodeRecordPayload(record) : null;

        if (!rawPayload) {
          abortScan(false);
          setStatus('error');
          setMessage('Tag letto ma senza dati interpretabili.');
          return;
        }

        const detectedType = extractCheckInType(rawPayload);
        if (!detectedType) {
          abortScan(false);
          setStatus('error');
          setMessage('Contenuto tag non riconosciuto. Usa "entrata" o "uscita" nel payload.');
          return;
        }

        if (lastEntryType && lastEntryType === detectedType) {
          abortScan(false);
          setStatus('error');
          setMessage('Hai già registrato una ' + detectedType + ' come ultimo evento.');
          return;
        }

        const timestamp = new Date();
        
        // Registra check-in
        onRegister(detectedType, {
          rawPayload,
          serialNumber: event.serialNumber,
        });
        
        // Crea evento calendario se callback fornito
        if (onCreateEvent) {
          onCreateEvent(detectedType, timestamp);
        }
        
        abortScan(false);
        setStatus('success');
        setMessage(`✓ ${detectedType.charAt(0).toUpperCase() + detectedType.slice(1)} registrata presso ${workLocation}`);
      };

      const handleReadingError = () => {
        abortScan(false);
        setStatus('error');
        setMessage('Errore durante la lettura del tag. Riprova.');
      };

      reader.addEventListener('reading', handleReading);
      reader.addEventListener('readingerror', handleReadingError);

      setStatus('scanning');
      setMessage('Avvicina il telefono al tag NFC.');
      await reader.scan({ signal: controller.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('❌ Errore avvio scan NFC:', error);
      setStatus('error');
      setMessage('Impossibile avviare la scansione NFC. Controlla i permessi.');
      abortScan(true);
    }
  }, [abortScan, isSupported, lastEntryType, onRegister, onCreateEvent, workLocation, status]);

  // Funzione di simulazione per testing con timestamp realistico
  const handleSimulate = useCallback((type: CheckInType) => {
    if (lastEntryType && lastEntryType === type) {
      setStatus('error');
      setMessage('Hai già registrato una ' + type + ' come ultimo evento.');
      return;
    }

    // Recupera l'ultimo check-in di tipo "entrata" per calcolare le ore
    let timestamp = new Date();
    let lastEntrataTimestamp: Date | null = null;
    try {
      const checkIns = window.localStorage.getItem('turni_pl_profile_data');
      if (checkIns) {
        const profile = JSON.parse(checkIns);
        const lastEntrata = Array.isArray(profile.checkIns)
          ? profile.checkIns.filter((c: any) => c.type === 'entrata').slice(-1)[0]
          : null;
        if (lastEntrata && lastEntrata.timestamp) {
          lastEntrataTimestamp = new Date(lastEntrata.timestamp);
        }
      }
    } catch {}

    // Se "uscita" e c'è una "entrata" precedente, calcola le ore lavorate
    let oreLavorate = 0;
    let straordinario = 0;
    let permesso = 0;
    let eventoExtra = null;
    if (type === 'uscita' && lastEntrataTimestamp) {
      oreLavorate = (timestamp.getTime() - lastEntrataTimestamp.getTime()) / (1000 * 60 * 60);
      // Orario standard: 8 ore
      if (oreLavorate > 8) {
        straordinario = oreLavorate - 8;
        eventoExtra = {
          tipo: 'straordinario',
          value: straordinario,
          startTime: lastEntrataTimestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          endTime: timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        };
      } else if (oreLavorate < 8) {
        permesso = 8 - oreLavorate;
        eventoExtra = {
          tipo: 'permesso',
          value: permesso,
          startTime: lastEntrataTimestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          endTime: timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        };
      }
    }

    // Registra check-in con timestamp custom
    onRegister(type, {
      rawPayload: `SIMULAZIONE: ${type}`,
      serialNumber: `SIM-${Date.now()}`,
      timestamp,
    });

    // Crea evento calendario se callback fornito
    if (onCreateEvent) {
      onCreateEvent(type, timestamp);
      // Non chiamare onCreateEvent con tipi non previsti
    }

    setStatus('success');
    const timeStr = timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    let msg = `✓ Simulazione ${type.charAt(0).toUpperCase() + type.slice(1)} registrata alle ${timeStr} presso ${workLocation}`;
    if (type === 'uscita' && lastEntrataTimestamp) {
      msg += ` | Ore lavorate: ${oreLavorate.toFixed(2)}`;
      if (straordinario > 0) msg += ` | Straordinario: ${straordinario.toFixed(2)}`;
      if (permesso > 0) msg += ` | Permesso: ${permesso.toFixed(2)}`;
    }
    setMessage(msg);
  }, [lastEntryType, onRegister, onCreateEvent, workLocation]);

  return (
    <div className="nfc-check-in">
      {!isSupported && (
        <p className="nfc-check-in__hint" role="note">
          {SUPPORTED_BROWSER_MESSAGE}
        </p>
      )}
      
      {/* Pulsanti di simulazione */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => handleSimulate('entrata')}
          disabled={status === 'scanning'}
          style={{ flex: 1 }}
        >
          🟢 Simula Entrata
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={() => handleSimulate('uscita')}
          disabled={status === 'scanning'}
          style={{ flex: 1 }}
        >
          🔴 Simula Uscita
        </button>
      </div>
      
      <button
        type="button"
        className="btn-secondary"
        onClick={handleScan}
        disabled={!canStartScan}
      >
        {status === 'scanning' ? 'Annulla scansione NFC' : 'Scannerizza tag NFC'}
      </button>
      {message && (
        <p
          className={`nfc-check-in__status nfc-check-in__status--${status}`}
          role={status === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}
    </div>
  );
};
