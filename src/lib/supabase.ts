import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variabili Supabase mancanti:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  })
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'gestione-turni'
    }
  }
})

// Test connessione
supabase.from('users').select('count', { count: 'exact', head: true })
  .then((result: { count: number | null; error: any }) => {
    if (result.error) {
      console.error('❌ Errore connessione Supabase:', result.error.message)
    } else {
      console.log('✅ Supabase connesso, utenti:', result.count)
    }
  })
