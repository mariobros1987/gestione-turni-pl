import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ success: false, message: 'Configurazione Supabase mancante' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const tokenHeader = req.headers.authorization?.replace('Bearer ', '');
  if (!tokenHeader) {
    return res.status(401).json({ success: false, message: 'Token mancante' });
  }

  // Decodifica userId dal JWT
  let userId: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(tokenHeader.split('.')[1], 'base64').toString());
    userId = payload.sub || payload.userId || payload.id || null;
  } catch {
    return res.status(401).json({ success: false, message: 'Token non valido' });
  }
  if (!userId) {
    return res.status(401).json({ success: false, message: 'UserId non trovato nel token' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('checkin')
      .select('*')
      .eq('userId', userId)
      .order('timestamp', { ascending: true });
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.status(200).json({ success: true, checkIns: data || [] });
  }

  if (req.method === 'DELETE') {
    // Cancella tutti i check-in della giornata indicata
    const date = (req.query.date as string) || (req.body && (req.body as any).date);
    if (!date) return res.status(400).json({ success: false, message: 'Parametro date mancante (YYYY-MM-DD)' });
    const from = `${date}T00:00:00`;
    const to = `${date}T23:59:59.999`;
    const { error } = await supabase
      .from('checkin')
      .delete()
      .eq('userId', userId)
      .gte('timestamp', from)
      .lte('timestamp', to);
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // POST

  const { type, timestamp, serialNumber } = req.body || {};
  if (!type || !['entrata', 'uscita'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Tipo di check-in non valido' });
  }

  const insertData = {
    userId: userId,  // ✅ Supabase usa userId (camelCase)
    azione: type,
    timestamp: timestamp || new Date().toISOString(),
    // La colonna corretta in DB è "tag_content" (non serial_number)
    tag_content: serialNumber || null
  } as const;

  const { data, error } = await supabase
    .from('checkin')
    .insert([insertData])
    .select();

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.status(200).json({ success: true, checkIn: data[0] });
}
