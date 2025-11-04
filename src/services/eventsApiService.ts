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

export const eventsApiService = {
  async list(since?: string) {
    const url = new URL('/api/events', window.location.origin);
    if (since) url.searchParams.set('since', since);
    const resp = await fetch(url.toString(), { headers: authHeaders(), cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    return json.events as Array<any>;
  },

  async upsert(event: AnyEventPayload) {
    const resp = await fetch('/api/events', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(event),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()).event;
  },

  async update(event: AnyEventPayload) {
    const resp = await fetch('/api/events', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(event),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()).event;
  },

  async remove(id: string) {
    const url = new URL('/api/events', window.location.origin);
    url.searchParams.set('id', id);
    const resp = await fetch(url.toString(), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return true;
  },
};
