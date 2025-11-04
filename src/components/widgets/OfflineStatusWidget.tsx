import React, { useEffect, useState } from 'react';

// Lazy import to avoid circular dependency
let offlineQueueInstance: any = null;
async function getOfflineQueue() {
  if (!offlineQueueInstance) {
    const module = await import('../../services/offlineQueue');
    offlineQueueInstance = module.offlineQueue;
  }
  return offlineQueueInstance;
}

let realtimeSyncInstance: any = null;
async function getRealtimeSync() {
  if (!realtimeSyncInstance) {
    const module = await import('../../services/realtimeSync');
    realtimeSyncInstance = module.realtimeSync;
  }
  return realtimeSyncInstance;
}

export const OfflineStatusWidget: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(false);

  useEffect(() => {
    const updateQueueSize = async () => {
      const queue = await getOfflineQueue();
      const size = await queue.getQueueSize();
      setQueueSize(size);
    };

    const updateRealtimeStatus = async () => {
      const realtime = await getRealtimeSync();
      const status = realtime.getStatus();
      setRealtimeActive(status.isActive);
    };

    const handleOnline = () => {
      setIsOnline(true);
      updateQueueSize();
      updateRealtimeStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setRealtimeActive(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update queue size and realtime status periodically
    const interval = setInterval(() => {
      updateQueueSize();
      updateRealtimeStatus();
    }, 5000);
    updateQueueSize();
    updateRealtimeStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleRetryQueue = async () => {
    setProcessing(true);
    try {
      const queue = await getOfflineQueue();
      await queue.processQueue();
      const size = await queue.getQueueSize();
      setQueueSize(size);
    } catch (error) {
      console.error('Errore processando coda:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleClearQueue = async () => {
    if (!confirm('Sei sicuro di voler svuotare la coda offline? Le operazioni in attesa saranno perse.')) {
      return;
    }
    const queue = await getOfflineQueue();
    await queue.clearQueue();
    setQueueSize(0);
  };

  if (isOnline && queueSize === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#22c55e',
      }}>
        <span style={{ fontSize: '18px' }}>{realtimeActive ? '⚡' : '🌐'}</span>
        <span>{realtimeActive ? 'Realtime Attivo' : 'Online - Sincronizzato'}</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#ef4444',
      }}>
        <span style={{ fontSize: '18px' }}>📴</span>
        <span>Offline</span>
        {queueSize > 0 && (
          <span style={{
            marginLeft: '4px',
            padding: '2px 6px',
            background: 'rgba(239, 68, 68, 0.2)',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            {queueSize} in coda
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      background: 'rgba(249, 115, 22, 0.1)',
      border: '1px solid rgba(249, 115, 22, 0.3)',
      borderRadius: '8px',
      fontSize: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f97316' }}>
        <span style={{ fontSize: '18px' }}>⏳</span>
        <span>Sincronizzazione in attesa</span>
        <span style={{
          marginLeft: '4px',
          padding: '2px 6px',
          background: 'rgba(249, 115, 22, 0.2)',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {queueSize} {queueSize === 1 ? 'operazione' : 'operazioni'}
        </span>
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleRetryQueue}
          disabled={processing}
          style={{
            padding: '6px 12px',
            background: processing ? '#94a3b8' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.6 : 1,
          }}
        >
          {processing ? '⏳ Processando...' : '🔄 Riprova ora'}
        </button>
        
        <button
          onClick={handleClearQueue}
          disabled={processing}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            color: '#64748b',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.6 : 1,
          }}
        >
          🗑️ Svuota coda
        </button>
      </div>
    </div>
  );
};
