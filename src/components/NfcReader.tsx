import React, { useState } from 'react';

const NfcReader: React.FC = () => {
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagContent, setTagContent] = useState<string | null>(null);
  // Funzione per registrare su Supabase con logica alternata
  const registerCheckIn = async (tagContent: string) => {
    try {
      const { supabase } = await import('../lib/supabase');
      const userJson = localStorage.getItem('turni_pl_current_user');
      const user = userJson ? JSON.parse(userJson) : null;
      if (!user) {
        setError('Utente non autenticato.');
        return;
      }
      // Calcola la data locale (timezone utente)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayLocal = `${year}-${month}-${day}`;
      // Recupera i check-in di oggi (data locale)
      const { data, error: fetchError } = await supabase
        .from('checkin')
        .select('*')
        .eq('userId', user.id)
        .gte('timestamp', `${todayLocal}T00:00:00`)
        .lte('timestamp', `${todayLocal}T23:59:59`)
        .order('timestamp', { ascending: true });
      if (fetchError) {
        setError('Errore lettura check-in: ' + fetchError.message);
        return;
      }
      // Alterna tra entrata e uscita
      let azione: 'entrata' | 'uscita' = 'entrata';
      if (data && data.length % 2 === 1) {
        azione = 'uscita';
      }
      const timestamp = new Date().toISOString();
      const { error: dbError } = await supabase.from('checkin').insert([
        {
          userId: user.id,
          azione,
          timestamp,
          tag_content: tagContent
        }
      ]);
      if (dbError) {
        setError('Errore registrazione su Supabase: ' + dbError.message);
      } else {
        setTagContent(`Registrazione ${azione} salvata!`);
      }
    } catch (err: any) {
      setError('Errore registrazione: ' + err.message);
    }
  };

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleReadNfc = async () => {
    setError(null);
    setTagContent(null);
    if ('NDEFReader' in window) {
      setNfcSupported(true);
      try {
        const ndef = new (window as any).NDEFReader();
        setReading(true);
        await ndef.scan();
        ndef.onreading = (event: any) => {
          const decoder = new TextDecoder();
          let content = '';
          for (const record of event.message.records) {
            content += decoder.decode(record.data);
          }
          setReading(false);
          // Se l'URL letto contiene /nfc, registra alternando entrata/uscita
          if (
            content.includes('gestione-turni-pl.vercel.app') &&
            (content.includes('azione=entrata') || content.includes('azione=uscita'))
          ) {
            registerCheckIn(content);
          } else {
            setTagContent(content || 'Tag letto, ma nessun URL valido trovato.');
          }
        };
        ndef.onerror = () => {
          setError('Errore durante la lettura del tag NFC.');
          setReading(false);
        };
      } catch (err: any) {
        setError('Impossibile avviare la scansione NFC: ' + err.message);
        setReading(false);
      }
    } else {
      setNfcSupported(false);
      setError('NFC non supportato su questo dispositivo/browser.');
    }
  };

  return (
    <div style={{ padding: 16, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Lettura NFC automatica</h2>
      {isIos && (
        <div style={{ color: 'red' }}>
          La lettura NFC non è supportata su iOS/Safari. Usa un dispositivo Android con Chrome.
        </div>
      )}
      {!isIos && (
        <button onClick={handleReadNfc} disabled={reading}>
          {reading ? 'In attesa del tag NFC...' : 'Avvia lettura automatica NFC'}
        </button>
      )}
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      {tagContent && <div style={{ color: 'green', marginTop: 8 }}>{tagContent}</div>}
    </div>
  );
};

export default NfcReader;
