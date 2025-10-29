import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Usa la service role key per bypassare RLS
  const supabase: SupabaseClient = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )

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
