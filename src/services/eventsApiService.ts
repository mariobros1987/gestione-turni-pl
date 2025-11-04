export type AnyEventPayload = {
  id?: string;
  date: string; // YYYY-MM-DD
  type: string; // ferie | permessi | straordinario | reperibilita | progetto | appuntamento
  title?: string;
  status?: string;
  extra?: Record<string, any>; // event-specific fields (value, time slots, etc.)
};

function authHeaders() {
  const token = localStorage.getItem('turni_pl_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as HeadersInit;
}

// Helper per gestire errori offline
async function handleOfflineError(
  operation: 'upsert' | 'update' | 'delete',
  payload: any,
  error: Error
): Promise<void> {
  // Se siamo offline o errore di rete, accoda per retry
  if (!navigator.onLine || error.message.includes('fetch') || error.message.includes('NetworkError')) {
    console.log('📴 Offline rilevato, accodo operazione per retry...');
    const { offlineQueue } = await import('./offlineQueue');
    await offlineQueue.enqueue(operation, payload);
  } else {
    // Altri errori (401, 500, etc.) non accodare
    throw error;
  }
}

export const eventsApiService = {
  async list(since?: string, limit?: number, offset?: number, month?: string, year?: string) {
    const url = new URL('/api/events', window.location.origin);
    if (since) url.searchParams.set('since', since);
    if (limit) url.searchParams.set('limit', limit.toString());
    if (offset) url.searchParams.set('offset', offset.toString());
    if (month) url.searchParams.set('month', month); // formato: YYYY-MM
    if (year) url.searchParams.set('year', year);    // formato: YYYY
    const resp = await fetch(url.toString(), { headers: authHeaders(), cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    return json.events as Array<any>;
  },

  async upsert(event: AnyEventPayload) {
    try {
      const resp = await fetch('/api/events', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(event),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.json()).event;
    } catch (error) {
      await handleOfflineError('upsert', event, error as Error);
      throw error;
    }
  },

  async update(event: AnyEventPayload) {
    try {
      const resp = await fetch('/api/events', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(event),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.json()).event;
    } catch (error) {
      await handleOfflineError('update', event, error as Error);
      throw error;
    }
  },

  async remove(id: string) {
    try {
      const url = new URL('/api/events', window.location.origin);
      url.searchParams.set('id', id);
      const resp = await fetch(url.toString(), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return true;
    } catch (error) {
      await handleOfflineError('delete', { id }, error as Error);
      throw error;
    }
  },
};
