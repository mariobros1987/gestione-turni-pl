import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token mancante' });
  }

  // Decodifica userId dal JWT
  let userId: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  userId = payload.sub || payload.userId || payload.id || null;
  } catch {
    return res.status(401).json({ success: false, message: 'Token non valido' });
  }
  if (!userId) {
    return res.status(401).json({ success: false, message: 'UserId non trovato nel token' });
  }

  const { type, timestamp, serialNumber } = req.body || {};
  if (!type || !['entrata', 'uscita'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Tipo di check-in non valido' });
  }

  const insertData = {
    userId: userId,
    azione: type,
    timestamp: timestamp || new Date().toISOString(),
    serial_number: serialNumber || null
  };

  const { data, error } = await supabase
    .from('checkin')
    .insert([insertData])
    .select();

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.status(200).json({ success: true, checkIn: data[0] });
}
