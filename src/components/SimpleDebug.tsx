import React from 'react';

interface SimpleDebugProps {
  onTestSystem: () => void;
  onTestRegistration: () => void;
  loading: boolean;
  debugInfo: any;
}

export const SimpleDebug: React.FC<SimpleDebugProps> = ({ 
  onTestSystem, 
  onTestRegistration, 
  loading, 
  debugInfo 
}) => {
  return (
    <div style={{ 
      background: '#f0f8ff', 
      border: '2px solid #4CAF50', 
      padding: '15px', 
      margin: '20px 0',
      borderRadius: '8px',
      textAlign: 'center'
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>🔧 Test Database</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={onTestSystem}
          disabled={loading}
          style={{ 
            background: '#4CAF50', 
            color: 'white', 
            border: 'none', 
            padding: '10px 20px', 
            margin: '0 5px',
            borderRadius: '5px',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? '⏳ Caricamento...' : '🔍 Test Sistema'}
        </button>
        
        <button 
          onClick={onTestRegistration}
          disabled={loading}
          style={{ 
            background: '#2196F3', 
            color: 'white', 
            border: 'none', 
            padding: '10px 20px', 
            margin: '0 5px',
            borderRadius: '5px',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? '⏳ Caricamento...' : '🧪 Test Registrazione'}
        </button>
      </div>
      
      {debugInfo && (
        <div style={{ 
          background: 'white', 
          padding: '10px', 
          borderRadius: '5px',
          fontSize: '14px',
          textAlign: 'left'
        }}>
          <strong>📊 Risultati Test ({debugInfo.timestamp})</strong>
          
          {debugInfo.error ? (
            <div style={{ color: 'red', margin: '5px 0' }}>
              ❌ Errore: {debugInfo.error}
            </div>
          ) : (
            <div style={{ margin: '5px 0' }}>
              <div style={{ color: debugInfo.health?.success ? 'green' : 'red' }}>
                🏥 API: {debugInfo.health?.success ? '✅ Connessa' : '❌ Non disponibile'}
                {debugInfo.health?.database?.userCount !== undefined && 
                  ` (${debugInfo.health.database.userCount} utenti totali)`
                }
              </div>
              
              <div style={{ color: debugInfo.users?.success ? 'green' : 'red' }}>
                👥 Database: {debugInfo.users?.success ? 
                  `✅ ${debugInfo.users.users?.length || 0} utenti trovati` : '❌ Errore'
                }
              </div>
              
              <div style={{ color: debugInfo.currentUser ? 'green' : 'orange' }}>
                👤 Sessione: {debugInfo.currentUser ? 
                  `✅ ${debugInfo.currentUser.email}` : '⚠️ Non loggato'
                }
              </div>
              
              {debugInfo.users?.users?.length > 0 && (
                <details style={{ marginTop: '10px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                    📋 Lista Utenti ({debugInfo.users.users.length})
                  </summary>
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>
                    {debugInfo.users.users.map((user: any, index: number) => (
                      <div key={index} style={{ margin: '2px 0', padding: '2px', background: '#f9f9f9' }}>
                        {index + 1}. {user.firstName} {user.lastName} ({user.email})
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
      
      <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
        💡 Usa questi pulsanti per verificare se gli account vengono salvati nel database
      </div>
    </div>
  );
};