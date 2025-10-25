import React, { useState, useEffect } from 'react';

interface NfcManualClockWidgetProps {
  onCheckIn?: () => void;
  onCheckOut?: () => void;
}

const NfcManualClockWidget: React.FC<NfcManualClockWidgetProps> = ({ onCheckIn, onCheckOut }) => {
  const [time, setTime] = useState(new Date());
  const [feedback, setFeedback] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const handleCheckIn = () => {
    if (onCheckIn) onCheckIn();
    setFeedback('✅ Timbratura Entrata registrata!');
    setTimeout(() => setFeedback(''), 3000);
  };
  const handleCheckOut = () => {
    if (onCheckOut) onCheckOut();
    setFeedback('✅ Timbratura Uscita registrata!');
    setTimeout(() => setFeedback(''), 3000);
  };

  return (
    <div className="nfc-manual-clock-widget" style={{ padding: '1rem', borderRadius: '8px', background: '#222', color: '#fff', boxShadow: '0 2px 8px #0002' }}>
      <div style={{ fontSize: '2.2rem', fontWeight: 600, textAlign: 'center', marginBottom: '0.5rem' }}>
        {formatTime(time)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <button onClick={handleCheckIn} style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.7rem 1.2rem', fontSize: '1rem', cursor: 'pointer' }}>
          🟢 Timbratura Entrata
        </button>
        <button onClick={handleCheckOut} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.7rem 1.2rem', fontSize: '1rem', cursor: 'pointer' }}>
          🔴 Timbratura Uscita
        </button>
      </div>
      {feedback && (
        <div style={{ textAlign: 'center', fontSize: '1.05rem', color: '#27ae60', marginBottom: '0.5rem', fontWeight: 500 }}>
          {feedback}
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: '0.95rem', color: '#bbb' }}>
        Timbratura manuale NFC
      </div>
    </div>
  );
};

export default NfcManualClockWidget;
