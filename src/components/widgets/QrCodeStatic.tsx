import React, { useRef } from 'react';
import QrSvg from './QrSvg';

interface QrCodeStaticProps {
  type: 'entrata' | 'uscita';
}

export const QrCodeStatic: React.FC<QrCodeStaticProps> = ({ type }) => {
  const [ecLevel, setEcLevel] = React.useState<'L' | 'M' | 'Q' | 'H'>('M');
  const qrPayload = JSON.stringify({ type, ts: 'STATIC' });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ textAlign: 'center', margin: '2rem 0', background: '#f8f8f8', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.7rem', color: '#222' }}>QR Code per {type === 'entrata' ? 'Entrata' : 'Uscita'}</h3>
      <div style={{ marginBottom: '0.7rem' }}>
        <label style={{ fontWeight: 500, marginRight: 8 }}>Correzione errore:</label>
        <select value={ecLevel} onChange={e => setEcLevel(e.target.value as any)} style={{ fontSize: '1rem', padding: '0.2rem 0.5rem' }}>
          <option value="L">L (bassa, + dati)</option>
          <option value="M">M (media)</option>
          <option value="Q">Q (alta)</option>
          <option value="H">H (massima, - dati)</option>
        </select>
      </div>
      <QrSvg value={qrPayload} size={256} ecLevel={ecLevel} />
      <button onClick={handlePrint} style={{ marginTop: '1.2rem', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontSize: '1.08rem', cursor: 'pointer', fontWeight: 500 }}>
        Stampa QR
      </button>
      <div style={{ marginTop: '1.2rem', fontSize: '1.08rem', color: '#444', fontWeight: 500 }}>
        <span>Stampa questo QR code e posizionalo vicino al dispositivo di timbratura.<br />
        Gli agenti possono scansionarlo per registrare l'orario di <b>{type === 'entrata' ? 'entrata' : 'uscita'}</b>.<br />
        <span style={{ color: '#27ae60', fontWeight: 600 }}>Consiglio:</span> usa carta plastificata o adesiva per una maggiore durata.</span>
      </div>
      <div style={{ marginTop: '0.7rem', fontSize: '0.98rem', color: '#888' }}>
        <span>Per stampare: usa il pulsante sopra oppure clicca col tasto destro sull'immagine e scegli "Stampa".</span>
      </div>
    </div>
  );
};

export default QrCodeStatic;
