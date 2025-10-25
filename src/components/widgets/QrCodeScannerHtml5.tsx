import React, { useEffect, useRef, useState } from 'react';


interface QrCodeScannerHtml5Props {
  onScan: (type: 'entrata' | 'uscita', timestamp: Date) => void;
}


const QrCodeScannerHtml5: React.FC<QrCodeScannerHtml5Props> = ({ onScan }) => {
  const [feedback, setFeedback] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5Qr = useRef<any>(null);

  useEffect(() => {
    if (!scanning) return;
    if (!scannerRef.current) return;
    // Carica html5-qrcode da CDN solo lato client
      // Carica html5-qrcode dal file locale public/html5-qrcode.min.js
      const script = document.createElement('script');
      script.src = '/html5-qrcode.min.js';
    script.async = true;
    script.onload = () => {
      // DEBUG: verifica caricamento script
      // @ts-ignore
      const Html5Qrcode = window.Html5Qrcode;
      if (!Html5Qrcode) {
        setCameraError('Modulo html5-qrcode non caricato. Problema di rete o CDN?');
        setScanning(false);
        console.error('window.Html5Qrcode non trovato dopo il caricamento script!');
        return;
      }
      if (!scannerRef.current) {
        setCameraError('Elemento scanner non trovato.');
        setScanning(false);
        return;
      }
      html5Qr.current = new Html5Qrcode(scannerRef.current.id);
      html5Qr.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText: string) => {
          try {
            const data = JSON.parse(decodedText);
            if (data.type === 'entrata' || data.type === 'uscita') {
              onScan(data.type, new Date(data.ts || Date.now()));
              setFeedback(`✅ Timbratura ${data.type} registrata!`);
              setTimeout(() => setFeedback(''), 3000);
              // La fotocamera resta aperta, chiusura manuale
            } else {
              setFeedback('❌ QR non valido');
            }
          } catch {
            setFeedback('❌ QR non valido');
          }
        },
        (error: any) => {
          // (Log rimosso per non intasare la console)
          // Se è solo un errore di parsing/nessun QR trovato, NON chiudere la fotocamera
          if (typeof error === 'string' && error.includes('No MultiFormat Readers')) {
            // Non fare nulla, lascia la fotocamera aperta
            return;
          }
          // Errori di scansione (es: nessuna fotocamera, permesso negato)
          if (typeof error === 'string' && error.toLowerCase().includes('permission')) {
            setCameraError('Permesso fotocamera negato. Consenti l\'accesso alla fotocamera nelle impostazioni del browser.');
            console.warn('setScanning(false) chiamato da: permesso negato');
            setScanning(false);
          } else if (typeof error === 'string' && error.toLowerCase().includes('not found')) {
            setCameraError('Nessuna fotocamera trovata.');
            console.warn('setScanning(false) chiamato da: nessuna fotocamera trovata');
            setScanning(false);
          } else if (typeof error === 'string' && error.includes('No MultiFormat Readers')) {
            // Non fare nulla, lascia la fotocamera aperta
            return;
          } else if (typeof error === 'string' && error.includes('No barcode or QR code detected')) {
            // Non fare nulla, lascia la fotocamera aperta
            return;
          } else {
            setCameraError('Errore generico: ' + error);
            // Non chiudere la fotocamera, solo mostra errore
            return;
          }
        }
      ).catch((err: any) => {
        console.error('Errore avvio fotocamera (catch dopo start):', err);
  setCameraError('Impossibile avviare la fotocamera: ' + (err?.message || err));
  console.warn('setScanning(false) chiamato da: errore catch dopo start');
  setScanning(false);
      });
    };
    script.onerror = () => {
      setCameraError('Errore nel caricamento del modulo di scansione QR (html5-qrcode). Controlla la connessione internet.');
      setScanning(false);
      console.error('Errore caricamento script html5-qrcode');
    };
    document.body.appendChild(script);
    return () => {
      if (html5Qr.current) {
        html5Qr.current.stop()
          .then(() => html5Qr.current.clear())
          .catch(() => {});
      }
      setCameraError(null);
      document.body.removeChild(script);
    };
  }, [onScan, scanning]);

  return (
    <div style={{ padding: '1rem', borderRadius: '8px', background: '#222', color: '#fff', boxShadow: '0 2px 8px #0002' }}>
      <button
  onClick={() => { console.warn('setScanning(true) chiamato da: click Avvia scansione QR'); setScanning(true); setCameraError(null); setFeedback(''); }}
        disabled={scanning}
        style={{
          display: 'block',
          margin: '0 auto 1rem auto',
          padding: '0.7rem 1.5rem',
          fontSize: '1.1rem',
          background: scanning ? '#888' : '#27ae60',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: scanning ? 'not-allowed' : 'pointer',
          fontWeight: 600
        }}
      >
        {scanning ? 'Scansione in corso...' : 'Avvia scansione QR'}
      </button>
      {scanning && (
        <button
          onClick={() => { console.warn('setScanning(false) chiamato da: click Chiudi fotocamera'); setScanning(false); }}
          style={{
            display: 'block',
            margin: '0 auto 1rem auto',
            padding: '0.5rem 1.2rem',
            fontSize: '1rem',
            background: '#e74c3c',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          Chiudi fotocamera
        </button>
      )}
      <div ref={scannerRef} id="qr-html5-scanner" style={{ width: 260, height: 260, margin: '0 auto', background: '#111', borderRadius: 8, opacity: scanning ? 1 : 0.5, pointerEvents: scanning ? 'auto' : 'none' }} />
      {cameraError && (
        <div style={{ textAlign: 'center', fontSize: '1.05rem', color: '#e74c3c', marginTop: '0.7rem', fontWeight: 500 }}>
          {cameraError}
        </div>
      )}
      {feedback && !cameraError && (
        <div style={{ textAlign: 'center', fontSize: '1.05rem', color: '#27ae60', marginTop: '0.7rem', fontWeight: 500 }}>
          {feedback}
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: '0.95rem', color: '#bbb', marginTop: '0.5rem' }}>
        Premi il pulsante per attivare la fotocamera e scansionare il QR Code delle presenze
      </div>
    </div>
  );
};

export default QrCodeScannerHtml5;
