// ...riga rimossa, il resto del file rimane invariato
import React, { useMemo } from 'react';
import { AppointmentEntry } from '../types/types';

interface NfcReportCardProps {
  appointments: AppointmentEntry[];
  monthDate?: Date;
}

const formatHours = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};

const monthName = (date: Date) => date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

const NfcReportCard: React.FC<NfcReportCardProps> = ({ appointments, monthDate = new Date() }) => {
  const isFestivo = (date: Date) => {
    // Solo Domenica (0) come festivo + festività nazionali
    const day = date.getDay();
    const y = date.getFullYear();
    // Festività fisse
    const festeFisse = [
      `01-01`, // Capodanno
      `06-01`, // Epifania
      `25-04`, // Liberazione
      `01-05`, // Lavoro
      `05-05`, // Festa Patronale
      `02-06`, // Repubblica
      `15-08`, // Ferragosto
      `01-11`, // Ognissanti
      `08-12`, // Immacolata
      `25-12`, // Natale
      `26-12`, // Santo Stefano
    ];
    // Festività mobili: Pasqua e Lunedì dell'Angelo
    function getPasqua(year: number) {
      // Algoritmo di Meeus
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      return new Date(year, month - 1, day);
    }
    const pasqua = getPasqua(y);
    const pasquetta = new Date(pasqua);
    pasquetta.setDate(pasqua.getDate() + 1);
    const mmdd = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }).replace('/', '-');
    const isFestaFissa = festeFisse.includes(mmdd);
    const isPasqua = date.getDate() === pasqua.getDate() && date.getMonth() === pasqua.getMonth();
    const isPasquetta = date.getDate() === pasquetta.getDate() && date.getMonth() === pasquetta.getMonth();
    return day === 0 || isFestaFissa || isPasqua || isPasquetta;
  };

    // Funzione esterna per suddividere le ore
function getTimeType(start: string, end: string, date: Date, isFestivo: boolean) {
  // Diurno: 07:00-22:00
  // Notturno: 22:00-07:00 (almeno 7h tra 00:00 e 05:00)
  // Festivo: tutto il giorno festivo + 00:00-06:00 del giorno dopo
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let startMin = toMinutes(start);
  let endMin = toMinutes(end);
  if (endMin <= startMin) endMin += 1440; // attraversa la mezzanotte
  let diurno = 0, notturno = 0, festivo = 0, notturnoFestivo = 0;
  for (let min = startMin; min < endMin; min++) {
    const ora = (min % 1440) / 60;
    let isFestivoOra = false;
    if (isFestivo) isFestivoOra = true;
    if (!isFestivo && ora < 6) {
      const prevDay = new Date(date);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevFestivo = prevDay.getDay() === 0 || prevDay.getDay() === 6;
      if (prevFestivo) isFestivoOra = true;
    }
    if (ora >= 7 && ora < 22) {
      if (isFestivoOra) festivo++;
      else diurno++;
    } else {
      if (isFestivoOra) notturnoFestivo++;
      else notturno++;
    }
  }
  return {
    diurno: diurno / 60,
    notturno: notturno / 60,
    festivo: festivo / 60,
    notturnoFestivo: notturnoFestivo / 60
  };
}

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const presenzaEvents = appointments.filter(ev => {
    const evDate = new Date(ev.date);
    return ev.title === 'Presenza' && evDate >= monthStart && evDate <= monthEnd;
  });
  const oreLavorate = presenzaEvents.reduce((sum: number, ev: AppointmentEntry) => sum + (ev.value || 0), 0);
  const giorniLavorati = presenzaEvents.length;
  // Calcolo ore ordinarie, permessi, straordinario
  let oreOrdinarie = 0, orePermesso = 0;
  let straordDiurno = 0, straordDiurnoFestivo = 0, straordNotturno = 0, straordNotturnoFestivo = 0;
  presenzaEvents.forEach(ev => {
    let ord = 0, perm = 0, straord = 0;
    if (ev.value < 6) {
      ord = ev.value;
      perm = 6 - ev.value;
    } else {
      ord = 6;
      straord = ev.value - 6;
    }
    oreOrdinarie += ord;
    orePermesso += perm;
    // Suddivisione straordinario: ore dopo le 22 come notturno, senza proporzione
    if (straord > 0) {
      const festivoGiorno = isFestivo(new Date(ev.date));
      const startMin = parseInt(ev.startTime.split(':')[0]) * 60 + parseInt(ev.startTime.split(':')[1]);
      const endMin = parseInt(ev.endTime.split(':')[0]) * 60 + parseInt(ev.endTime.split(':')[1]);
      let straordNotturnoLocal = 0, straordDiurnoLocal = 0, straordDiurnoFestivoLocal = 0, straordNotturnoFestivoLocal = 0;
      for (let min = startMin + 360; min < endMin; min++) { // +360 per saltare le prime 6h ordinarie
        const ora = (min % 1440) / 60;
        if (festivoGiorno) {
          if (ora >= 7 && ora < 22) straordDiurnoFestivoLocal += 1;
          else straordNotturnoFestivoLocal += 1;
        } else {
          if (ora >= 7 && ora < 22) straordDiurnoLocal += 1;
          else straordNotturnoLocal += 1;
        }
      }
      straordDiurno += straordDiurnoLocal / 60;
      straordNotturno += straordNotturnoLocal / 60;
      straordDiurnoFestivo += straordDiurnoFestivoLocal / 60;
      straordNotturnoFestivo += straordNotturnoFestivoLocal / 60;
    }
  });
  const report = {
    totaleSessions: giorniLavorati,
    oreLavorate: Math.round(oreLavorate * 10) / 10,
    oreOrdinarie: Math.round(oreOrdinarie * 10) / 10,
    orePermesso: Math.round(orePermesso * 10) / 10,
    straordDiurno: Math.round(straordDiurno * 10) / 10,
    straordDiurnoFestivo: Math.round(straordDiurnoFestivo * 10) / 10,
    straordNotturno: Math.round(straordNotturno * 10) / 10,
    straordNotturnoFestivo: Math.round(straordNotturnoFestivo * 10) / 10,
    giorniLavorati,
    sessions: presenzaEvents
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>📊 Report NFC - {monthName(monthDate)}</h2>
          <p className="summary">Ore lavorate, straordinari e permessi</p>
        </div>
      </div>
      <div className="card-body nfc-report">
        {report.sessions.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px', marginBottom: '1rem', border: '2px dashed rgba(52, 152, 219, 0.3)' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              📱 Nessuna presenza registrata
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-color-light)' }}>
              Usa i pulsanti "🟢 Simula Entrata" e "🔴 Simula Uscita" nella card "Registro Presenze" per testare il sistema
            </p>
          </div>
        )}
        <div className="nfc-report-stats">
          <div className="stat-box stat-box--blue">
            <div className="stat-label">
              <span className="stat-icon">🕐</span>
              <span>Ore Totali</span>
            </div>
            <div className="stat-value">{report.oreLavorate}h</div>
          </div>
          <div className="stat-box stat-box--green">
            <div className="stat-label">
              <span className="stat-icon">✓</span>
              <span>Ore Ordinarie</span>
            </div>
            <div className="stat-value">{report.oreOrdinarie}h</div>
          </div>
          <div className="stat-box stat-box--orange">
            <div className="stat-label">
              <span className="stat-icon">📈</span>
              <span>Straordinario Diurno</span>
            </div>
            <div className="stat-value">{report.straordDiurno}h</div>
            <div className="stat-label" style={{marginTop:'0.5rem'}}>
              <span className="stat-icon">🌞</span>
              <span>Straordinario Diurno Festivo</span>
            </div>
            <div className="stat-value">{report.straordDiurnoFestivo}h</div>
            <div className="stat-label" style={{marginTop:'0.5rem'}}>
              <span className="stat-icon">🌙</span>
              <span>Straordinario Notturno</span>
            </div>
            <div className="stat-value">{report.straordNotturno}h</div>
            <div className="stat-label" style={{marginTop:'0.5rem'}}>
              <span className="stat-icon">🌙🎉</span>
              <span>Straordinario Notturno Festivo</span>
            </div>
            <div className="stat-value">{report.straordNotturnoFestivo}h</div>
          </div>
          <div className="stat-box stat-box--purple">
            <div className="stat-label">
              <span className="stat-icon">📅</span>
              <span>Permessi</span>
            </div>
            <div className="stat-value">{report.orePermesso}h</div>
          </div>
        </div>
        <div className="nfc-report-meta">
          <div>
            <span className="meta-label">Giorni lavorati:</span>
            <span className="meta-value">{report.giorniLavorati}</span>
          </div>
          <div>
            <span className="meta-label">Sessioni registrate:</span>
            <span className="meta-value">{report.totaleSessions}</span>
          </div>
        </div>
        <div className="nfc-report-sessions">
          <h3 className="session-title">Dettaglio Presenze</h3>
          <div className="session-list">
            {report.sessions.length === 0 ? (
              <p className="empty-state">
                Nessuna presenza registrata questo mese
              </p>
            ) : (
              report.sessions.map((ev: AppointmentEntry, idx: number) => {
                const evDate = new Date(ev.date);
                const entryTime = ev.startTime || '';
                const exitTime = ev.endTime || '';
                // Calcolo per la giornata
                let ord = 0, perm = 0, straord = 0;
                let straordDiurno = 0, straordDiurnoFestivo = 0, straordNotturno = 0, straordNotturnoFestivo = 0;
                if (ev.value < 6) {
                  ord = ev.value;
                  perm = 6 - ev.value;
                } else {
                  ord = 6;
                  straord = ev.value - 6;
                  // Suddivisione straordinario per giornata: ore dopo le 22 come notturno
                  const festivoGiorno = isFestivo(evDate);
                  const startMin = parseInt(ev.startTime.split(':')[0]) * 60 + parseInt(ev.startTime.split(':')[1]);
                  const endMin = parseInt(ev.endTime.split(':')[0]) * 60 + parseInt(ev.endTime.split(':')[1]);
                  let straordNotturnoLocal = 0, straordDiurnoLocal = 0, straordDiurnoFestivoLocal = 0, straordNotturnoFestivoLocal = 0;
                  for (let min = startMin + 360; min < endMin; min++) { // +360 per saltare le prime 6h ordinarie
                    const ora = (min % 1440) / 60;
                    if (festivoGiorno) {
                      if (ora >= 7 && ora < 22) straordDiurnoFestivoLocal += 1;
                      else straordNotturnoFestivoLocal += 1;
                    } else {
                      if (ora >= 7 && ora < 22) straordDiurnoLocal += 1;
                      else straordNotturnoLocal += 1;
                    }
                  }
                  straordDiurno = straordDiurnoLocal / 60;
                  straordNotturno = straordNotturnoLocal / 60;
                  straordDiurnoFestivo = straordDiurnoFestivoLocal / 60;
                  straordNotturnoFestivo = straordNotturnoFestivoLocal / 60;
                }
                return (
                  <div key={idx} className="session-item">
                    <div className="session-info">
                      <div className="session-date">
                        {evDate.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </div>
                    </div>
                    <div className="session-times">
                      <div className="time-entry">
                        <span className="time-label entry">↓ Entrata</span>
                        <span className="time-value">{entryTime}</span>
                      </div>
                      {exitTime && (
                        <div className="time-entry">
                          <span className="time-label exit">↑ Uscita</span>
                          <span className="time-value">{exitTime}</span>
                        </div>
                      )}
                      <div className="session-duration">
                        <span style={{ color: '#2980b9', fontWeight: 500 }}>🕐 Ord. {formatHours(ord)}</span>{' '}
                        {straordDiurno > 0 && <span style={{ color: '#f39c12', fontWeight: 500 }}>🌞 Str. Diurno {formatHours(straordDiurno)}</span>}{' '}
                        {straordDiurnoFestivo > 0 && <span style={{ color: '#e74c3c', fontWeight: 500 }}>🌞🎉 Str. Diurno Festivo {formatHours(straordDiurnoFestivo)}</span>}{' '}
                        {straordNotturno > 0 && <span style={{ color: '#34495e', fontWeight: 500 }}>🌙 Str. Notturno {formatHours(straordNotturno)}</span>}{' '}
                        {straordNotturnoFestivo > 0 && <span style={{ color: '#8e44ad', fontWeight: 500 }}>🌙🎉 Str. Notturno Festivo {formatHours(straordNotturnoFestivo)}</span>}{' '}
                        {perm > 0 && <span style={{ color: '#6c3483', fontWeight: 500 }}>🟣 Perm. {formatHours(perm)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NfcReportCard;
