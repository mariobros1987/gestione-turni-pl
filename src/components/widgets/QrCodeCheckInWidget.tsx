import React, { useState, useEffect } from 'react';
import QrSvg from './QrSvg';

interface QrCodeCheckInWidgetProps {
  onScan: (type: 'entrata' | 'uscita', timestamp: Date) => void;
}

const QrCodeCheckInWidget: React.FC<QrCodeCheckInWidgetProps> = ({ onScan }) => {
  const [scanType, setScanType] = useState<'entrata' | 'uscita'>('entrata');
  const [feedback, setFeedback] = useState('');

  // QR code payload: tipo + timestamp
  const [ecLevel, setEcLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const qrPayload = JSON.stringify({ type: scanType, ts: new Date().toISOString() });

  // Simulazione scansione QR
  const handleSimulateScan = () => {
    onScan(scanType, new Date());
    setFeedback(`✅ Timbratura ${scanType} registrata!`);
    setTimeout(() => setFeedback(''), 3000);
  };

  return (
    <div style={{ padding: '1rem', borderRadius: '8px', background: '#222', color: '#fff', boxShadow: '0 2px 8px #0002' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ fontWeight: 500, marginRight: 8 }}>Correzione errore:</label>
          <select value={ecLevel} onChange={e => setEcLevel(e.target.value as any)} style={{ fontSize: '1rem', padding: '0.2rem 0.5rem' }}>
            <option value="L">L (bassa, + dati)</option>
            <option value="M">M (media)</option>
            <option value="Q">Q (alta)</option>
            <option value="H">H (massima, - dati)</option>
          </select>
        </div>
        <QrSvg value={qrPayload} size={128} ecLevel={ecLevel} />
        <div style={{ marginTop: '0.5rem' }}>
          <select value={scanType} onChange={e => setScanType(e.target.value as 'entrata' | 'uscita')} style={{ fontSize: '1rem', padding: '0.3rem' }}>
            <option value="entrata">Entrata</option>
            <option value="uscita">Uscita</option>
          </select>
        </div>
      </div>
      <button onClick={handleSimulateScan} style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.7rem 1.2rem', fontSize: '1rem', cursor: 'pointer', width: '100%' }}>
        Simula scansione QR
      </button>
      {feedback && (
        <div style={{ textAlign: 'center', fontSize: '1.05rem', color: '#27ae60', marginTop: '0.7rem', fontWeight: 500 }}>
          {feedback}
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: '0.95rem', color: '#bbb', marginTop: '0.5rem' }}>
        Timbratura tramite QR Code
      </div>
    </div>
  );
};

export default QrCodeCheckInWidget;
