import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Usa la service role key per bypassare RLS
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env vars:', { url: !!supabaseUrl, key: !!serviceRoleKey })
    return res.status(500).json({ success: false, message: 'Configurazione Supabase mancante' })
  }
  
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey)

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Supabase error:', error)
        return res.status(500).json({ success: false, message: error.message, details: error })
      }

      res.status(200).json({ success: true, data })
    } catch (error: any) {
      console.error('Unhandled error:', error)
      res.status(500).json({ success: false, message: error.message, details: error })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}
