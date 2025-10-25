import React from 'react';
import { authService as apiAuthService } from '../services/apiAuthService';

export const DebugPanel: React.FC = () => {
  const [debugInfo, setDebugInfo] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  const runTests = async () => {
    setLoading(true);
    try {
      console.log('🔍 Avvio diagnostica...');
      
      // Test 1: Health check
      const health = await apiAuthService.checkDatabaseStatus();
      console.log('Health check:', health);
      
      // Test 2: Lista utenti
      let users: { success: boolean; users?: any[]; message: string } = { success: false, users: [], message: '' };
      try {
        users = await apiAuthService.getAllUsers();
        console.log('Lista utenti:', users);
      } catch (err) {
        users = { success: false, users: [], message: 'Endpoint debug non disponibile' };
        console.warn('Endpoint debug non disponibile');
      }
      
      // Test 3: Utente corrente
      const currentUser = apiAuthService.getCurrentUser();
      console.log('Utente corrente:', currentUser);
      
      setDebugInfo({
        health,
        users,
        currentUser,
        timestamp: new Date().toLocaleString()
      });
    } catch (error) {
      console.error('Errore durante i test:', error);
      setDebugInfo({
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setLoading(false);
    }
  };

  const testRegistration = async () => {
    setLoading(true);
    try {
      const testUser = {
        email: `test.${Date.now()}@polizialocale.it`,
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
        firstName: 'Mario',
        lastName: 'Test',
        badgeNumber: `TEST${Date.now()}`,
        department: 'Test Department',
        rank: 'Test Rank'
      };

      console.log('🧪 Test registrazione con:', testUser);
      const result = await apiAuthService.register(testUser);
      console.log('Risultato registrazione:', result);
      
      // Dopo la registrazione, aggiorna la lista utenti
      await runTests();
    } catch (error) {
      console.error('Errore test registrazione:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '10px', 
      borderRadius: '5px',
      maxWidth: '300px',
      maxHeight: '400px',
      overflow: 'auto',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <h4>🔧 Debug Panel</h4>
      
      <button 
        onClick={runTests} 
        disabled={loading}
        style={{ marginRight: '5px', padding: '5px' }}
      >
        {loading ? '⏳' : '🔍'} Test Sistema
      </button>
      
      <button 
        onClick={testRegistration} 
        disabled={loading}
        style={{ padding: '5px' }}
      >
        {loading ? '⏳' : '🧪'} Test Registrazione
      </button>
      
      {debugInfo && (
        <div style={{ marginTop: '10px', fontSize: '10px' }}>
          <strong>Ultimo test: {debugInfo.timestamp}</strong>
          
          {debugInfo.error ? (
            <div style={{ color: 'red' }}>❌ {debugInfo.error}</div>
          ) : (
            <>
              <div>
                🏥 API: {debugInfo.health?.success ? '✅' : '❌'}
                {debugInfo.health?.database?.userCount !== undefined && 
                  ` (${debugInfo.health.database.userCount} utenti)`
                }
              </div>
              
              <div>
                👥 Utenti DB: {debugInfo.users?.success ? 
                  `✅ ${debugInfo.users.users?.length || 0}` : '❌'
                }
              </div>
              
              <div>
                👤 Login: {debugInfo.currentUser ? 
                  `✅ ${debugInfo.currentUser.email}` : '⚠️ Non loggato'
                }
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};