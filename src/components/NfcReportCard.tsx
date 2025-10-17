import React, { useMemo } from 'react';
import { CollapsibleCardProps, CheckInEntry } from '../types/types';

interface NfcReportCardProps extends CollapsibleCardProps {
  checkIns: CheckInEntry[];
  monthDate?: Date; // Mese da visualizzare, default = mese corrente
}

interface WorkSession {
  entrata: CheckInEntry;
  uscita?: CheckInEntry;
  minutiLavorati: number;
  data: string;
  sede: string;
}

interface MonthlyReport {
  totaleSessions: number;
  oreLavorate: number;
  oreOrdinarie: number;
  oreStraordinario: number;
  orePermesso: number;
  giorniLavorati: number;
  sessions: WorkSession[];
}

const NfcReportCard: React.FC<NfcReportCardProps> = ({ 
  checkIns, 
  monthDate = new Date(),
  isCollapsed,
  onToggleCollapse
}) => {
  const report: MonthlyReport = useMemo(() => {
    console.log('📊 NFC REPORT: Calcolo report con', checkIns.length, 'check-ins');
    
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    // Filtra check-in del mese corrente
    const monthCheckIns = checkIns.filter(ci => {
      const ciDate = new Date(ci.timestamp);
      return ciDate >= monthStart && ciDate <= monthEnd;
    });
    
    console.log('📊 NFC REPORT: Check-ins del mese corrente:', monthCheckIns.length);

    // Ordina per data
    const sorted = [...monthCheckIns].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    console.log('📊 NFC REPORT: Check-ins ordinati:', sorted.map(s => ({ type: s.type, time: new Date(s.timestamp).toLocaleTimeString() })));

    // Raggruppa per giorno e sede
    const sessionsByDay: Record<string, WorkSession[]> = {};
    
    sorted.forEach(ci => {
      const ciDate = new Date(ci.timestamp);
      const dayKey = ciDate.toISOString().split('T')[0];
      
      if (!sessionsByDay[dayKey]) {
        sessionsByDay[dayKey] = [];
      }

      const sede = 'Sede principale'; // TODO: Aggiungere location a CheckInEntry
      
      if (ci.type === 'entrata') {
        // Cerca se esiste già una sessione aperta per questa sede
        const openSession = sessionsByDay[dayKey].find(s => 
          s.sede === sede && !s.uscita
        );
        
        if (!openSession) {
          sessionsByDay[dayKey].push({
            entrata: ci,
            sede,
            minutiLavorati: 0,
            data: dayKey
          });
        }
      } else if (ci.type === 'uscita') {
        // Cerca la sessione aperta più recente per questa sede
        const openSession = [...sessionsByDay[dayKey]]
          .reverse()
          .find(s => s.sede === sede && !s.uscita);
        
        if (openSession) {
          openSession.uscita = ci;
          const entrata = new Date(openSession.entrata.timestamp);
          const uscita = new Date(ci.timestamp);
          openSession.minutiLavorati = Math.floor((uscita.getTime() - entrata.getTime()) / 1000 / 60);
        }
      }
    });

    // Calcola totali
    const allSessions = Object.values(sessionsByDay).flat();
    const completedSessions = allSessions.filter(s => s.uscita);
    
    console.log('📊 NFC REPORT: Sessioni totali:', allSessions.length, '- Complete:', completedSessions.length);
    console.log('📊 NFC REPORT: Dettaglio sessioni:', completedSessions.map(s => ({
      data: s.data,
      entrata: new Date(s.entrata.timestamp).toLocaleTimeString(),
      uscita: s.uscita ? new Date(s.uscita.timestamp).toLocaleTimeString() : 'N/A',
      minuti: s.minutiLavorati
    })));
    
    const totalMinutes = completedSessions.reduce((sum, s) => sum + s.minutiLavorati, 0);
    const oreLavorate = totalMinutes / 60;
    
    console.log('📊 NFC REPORT: Minuti totali:', totalMinutes, '- Ore:', oreLavorate);
    
    // Calcola ore ordinarie vs straordinario
    // Assumiamo 8 ore/giorno come ordinario
    const giorniLavorati = new Set(completedSessions.map(s => s.data)).size;
    const oreOrdinarie = Math.min(oreLavorate, giorniLavorati * 8);
    const oreStraordinario = Math.max(0, oreLavorate - oreOrdinarie);
    
    // Permessi: per ora 0, andrà integrato con il sistema permessi esistente
    const orePermesso = 0;

    return {
      totaleSessions: allSessions.length,
      oreLavorate: Math.round(oreLavorate * 10) / 10,
      oreOrdinarie: Math.round(oreOrdinarie * 10) / 10,
      oreStraordinario: Math.round(oreStraordinario * 10) / 10,
      orePermesso: Math.round(orePermesso * 10) / 10,
      giorniLavorati,
      sessions: completedSessions.sort((a, b) => b.data.localeCompare(a.data))
    };
  }, [checkIns, monthDate]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const monthName = monthDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  
  return (
    <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="card-header">
        <div>
          <h2>📊 Report NFC - {monthName}</h2>
          <p className="summary">Ore lavorate, straordinari e permessi</p>
        </div>
        <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
          {isCollapsed ? '⊕' : '⊖'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="card-body nfc-report">
          {/* Alert se non ci sono dati */}
          {checkIns.length === 0 && (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              background: 'rgba(52, 152, 219, 0.1)', 
              borderRadius: '8px',
              marginBottom: '1rem',
              border: '2px dashed rgba(52, 152, 219, 0.3)'
            }}>
              <p style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                📱 Nessun check-in registrato
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-color-light)' }}>
                Usa i pulsanti "🟢 Simula Entrata" e "🔴 Simula Uscita" nella card "Registro Presenze" per testare il sistema
              </p>
            </div>
          )}
          
          {/* Riepilogo ore */}
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
                <span>Straordinario</span>
              </div>
              <div className="stat-value">{report.oreStraordinario}h</div>
            </div>

            <div className="stat-box stat-box--purple">
              <div className="stat-label">
                <span className="stat-icon">📅</span>
                <span>Permessi</span>
              </div>
              <div className="stat-value">{report.orePermesso}h</div>
            </div>
          </div>

          {/* Statistiche */}
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

          {/* Lista sessioni */}
          <div className="nfc-report-sessions">
            <h3 className="session-title">Dettaglio Sessioni</h3>
            <div className="session-list">
              {report.sessions.length === 0 ? (
                <p className="empty-state">
                  Nessuna sessione completa registrata questo mese
                </p>
              ) : (
                report.sessions.map((session, idx) => {
                  const sessionDate = new Date(session.entrata.timestamp);
                  const entryTime = sessionDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                  const exitTime = session.uscita 
                    ? new Date(session.uscita.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                    : null;
                  
                  return (
                    <div key={idx} className="session-item">
                      <div className="session-info">
                        <div className="session-date">
                          {sessionDate.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
                        </div>
                        <div className="session-location">{session.sede}</div>
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
                        <div className="session-duration">{formatMinutes(session.minutiLavorati)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NfcReportCard;
