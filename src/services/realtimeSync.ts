/**
 * Real-time sync service usando Supabase Realtime
 * Sostituisce il polling con notifiche push istantanee
 */

import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type EventChangeCallback = (payload: any) => void;

class RealtimeSyncService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private channel: RealtimeChannel | null = null;
  private isActive = false;
  private userId: string | null = null;

  /**
   * Inizializza il servizio e sottoscrive agli eventi real-time
   */
  async start(userId: string, onChange: EventChangeCallback) {
    if (this.isActive) {
      console.warn('⚠️ Realtime sync già attivo');
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('⚠️ Supabase credentials non configurate, skip realtime sync');
      return;
    }

    try {
      this.userId = userId;
      
      // Crea client Supabase
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: {
          params: {
            eventsPerSecond: 10, // Throttle per evitare overhead
          },
        },
      });

      // Sottoscrivi a cambiamenti nella tabella events
      this.channel = this.supabase
        .channel(`events:userId=eq.${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'Event',
            filter: `userId=eq.${userId}`,
          },
          (payload) => {
            console.log('🔔 Realtime event ricevuto:', payload);
            this.handleChange(payload, onChange);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime sync attivo');
            this.isActive = true;
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Errore sottoscrizione realtime');
            this.isActive = false;
          } else if (status === 'TIMED_OUT') {
            console.warn('⏱️ Timeout sottoscrizione realtime, riprovo...');
            this.isActive = false;
            // Riprova dopo 5s
            setTimeout(() => this.start(userId, onChange), 5000);
          }
        });

      // Gestisci disconnessioni
      window.addEventListener('online', () => {
        if (!this.isActive && this.userId) {
          console.log('🔄 Riconnessione realtime dopo ritorno online');
          this.start(this.userId, onChange);
        }
      });

      window.addEventListener('beforeunload', () => {
        this.stop();
      });

    } catch (error) {
      console.error('❌ Errore inizializzazione realtime sync:', error);
    }
  }

  /**
   * Gestisce i cambiamenti ricevuti dal canale
   */
  private handleChange(payload: any, onChange: EventChangeCallback) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
        console.log('➕ Nuovo evento inserito:', newRecord);
        onChange({ type: 'insert', record: newRecord });
        break;

      case 'UPDATE':
        console.log('✏️ Evento aggiornato:', newRecord);
        onChange({ type: 'update', record: newRecord, old: oldRecord });
        break;

      case 'DELETE':
        console.log('🗑️ Evento eliminato:', oldRecord);
        onChange({ type: 'delete', record: oldRecord });
        break;
    }
  }

  /**
   * Ferma la sottoscrizione real-time
   */
  async stop() {
    if (this.channel) {
      await this.supabase?.removeChannel(this.channel);
      this.channel = null;
    }
    this.isActive = false;
    this.userId = null;
    console.log('🛑 Realtime sync fermato');
  }

  /**
   * Verifica se il servizio è attivo
   */
  getStatus() {
    return {
      isActive: this.isActive,
      userId: this.userId,
      hasChannel: !!this.channel,
    };
  }
}

// Singleton
export const realtimeSync = new RealtimeSyncService();
