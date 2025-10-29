// Servizio per invio check-in NFC/tag
export interface CheckInPayload {
  type: 'entrata' | 'uscita';
  timestamp?: string; // ISO
  serialNumber?: string;
}

export async function sendCheckIn(payload: CheckInPayload): Promise<{ success: boolean; checkIn?: any; message?: string }> {
  const token = localStorage.getItem('turni_pl_auth_token');
  const res = await fetch('/api/checkin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  try {
    const data = await res.json();
    return data;
  } catch {
    return { success: false, message: 'Errore di rete o risposta non valida' };
  }
}
