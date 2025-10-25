import React, { useState } from 'react';
// RIMOSSO: import { QrReader } from 'react-qr-reader';

interface QrCodeScannerWidgetProps {
  onScan: (type: 'entrata' | 'uscita', timestamp: Date) => void;
}

const QrCodeScannerWidget: React.FC<QrCodeScannerWidgetProps> = ({ onScan }) => {
  const [scanResult, setScanResult] = useState('');
  const [feedback, setFeedback] = useState('');

  // Funzionalità disabilitata: react-qr-reader non compatibile con Vercel
  // Puoi integrare una soluzione alternativa browser-only o fornire istruzioni per usare un'app QR esterna

  return (
    <div style={{ padding: '1rem', borderRadius: '8px', background: '#222', color: '#fff', boxShadow: '0 2px 8px #0002' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem', color: '#bbb', fontSize: '1.1rem' }}>
        <b>Scansione QR Code</b> non disponibile su questa piattaforma.<br />
        Usa una app QR esterna e inserisci manualmente la timbratura.<br />
        (Motivo tecnico: react-qr-reader non compatibile con Vercel)
      </div>
    </div>
  );
};

export default QrCodeScannerWidget;
