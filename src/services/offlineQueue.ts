// Offline Queue Manager - gestisce operazioni fallite da riprovare al ritorno online

interface QueuedOperation {
  id: string;
  timestamp: number;
  operation: 'upsert' | 'update' | 'delete';
  payload: any;
  retries: number;
}

const DB_NAME = 'TurniPL_OfflineQueue';
const DB_VERSION = 1;
const STORE_NAME = 'operations';
const MAX_RETRIES = 3;

class OfflineQueueService {
  private db: IDBDatabase | null = null;
  private isOnline = navigator.onLine;
  private processingQueue = false;

  constructor() {
    this.init();
    this.setupOnlineListener();
  }

  private async init() {
    try {
      this.db = await this.openDB();
      console.log('📦 IndexedDB offline queue inizializzato');
      
      // Se siamo online, prova a processare la coda all'avvio
      if (this.isOnline) {
        this.processQueue();
      }
    } catch (error) {
      console.error('❌ Errore inizializzazione IndexedDB:', error);
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('✅ IndexedDB store creato');
        }
      };
    });
  }

  private setupOnlineListener() {
    window.addEventListener('online', () => {
      console.log('🌐 Connessione ripristinata, processo coda offline...');
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Connessione persa, modalità offline attiva');
      this.isOnline = false;
    });
  }

  async enqueue(operation: 'upsert' | 'update' | 'delete', payload: any): Promise<void> {
    if (!this.db) {
      console.warn('⚠️ IndexedDB non disponibile, operazione persa');
      return;
    }

    const queuedOp: QueuedOperation = {
      id: `${operation}-${payload.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      operation,
      payload,
      retries: 0,
    };

    try {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await new Promise((resolve, reject) => {
        const req = store.add(queuedOp);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      
      console.log('📥 Operazione accodata per retry:', operation, payload.type || payload.id);
    } catch (error) {
      console.error('❌ Errore accodamento operazione:', error);
    }
  }

  async processQueue(): Promise<void> {
    if (!this.db || this.processingQueue || !this.isOnline) {
      return;
    }

    this.processingQueue = true;
    console.log('🔄 Processo coda offline...');

    try {
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const operations = await new Promise<QueuedOperation[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (operations.length === 0) {
        console.log('✅ Coda offline vuota');
        this.processingQueue = false;
        return;
      }

      console.log(`📊 Trovate ${operations.length} operazioni in coda`);

      // Ordina per timestamp (FIFO)
      operations.sort((a, b) => a.timestamp - b.timestamp);

      // Import dinamico per evitare circular dependency
      const { eventsApiService } = await import('./eventsApiService');

      for (const op of operations) {
        try {
          console.log(`🔄 Retry ${op.operation} per ${op.payload.type || op.payload.id}...`);

          switch (op.operation) {
            case 'upsert':
              await eventsApiService.upsert(op.payload);
              break;
            case 'update':
              await eventsApiService.update(op.payload);
              break;
            case 'delete':
              await eventsApiService.remove(op.payload.id);
              break;
          }

          // Successo: rimuovi dalla coda
          await this.removeFromQueue(op.id);
          console.log(`✅ Operazione completata: ${op.operation}`);
        } catch (error) {
          console.error(`❌ Retry fallito per ${op.id}:`, error);

          // Incrementa contatore retry
          op.retries++;
          if (op.retries >= MAX_RETRIES) {
            console.warn(`⚠️ Max retry raggiunto per ${op.id}, rimosso dalla coda`);
            await this.removeFromQueue(op.id);
          } else {
            await this.updateRetryCount(op.id, op.retries);
          }
        }
      }

      console.log('✅ Processo coda completato');
    } catch (error) {
      console.error('❌ Errore processando coda offline:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  private async removeFromQueue(id: string): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.error('❌ Errore rimozione da coda:', error);
    }
  }

  private async updateRetryCount(id: string, retries: number): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const op = await new Promise<QueuedOperation>((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (op) {
        op.retries = retries;
        await new Promise((resolve, reject) => {
          const req = store.put(op);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
    } catch (error) {
      console.error('❌ Errore aggiornamento retry count:', error);
    }
  }

  async getQueueSize(): Promise<number> {
    if (!this.db) return 0;

    try {
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      return await new Promise<number>((resolve, reject) => {
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return 0;
    }
  }

  async clearQueue(): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      console.log('🗑️ Coda offline svuotata');
    } catch (error) {
      console.error('❌ Errore svuotamento coda:', error);
    }
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueueService();
