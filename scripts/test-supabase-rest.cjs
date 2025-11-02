require('dotenv').config({ override: true });
const { createClient } = require('@supabase/supabase-js');

(async () => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Env mancanti SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    console.log('URL:', url, 'KEY length:', key.length);

    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('checkin').select('id').limit(1);
    if (error) throw error;
    console.log('OK select checkin:', data);
    process.exit(0);
  } catch (e) {
    console.error('Errore supabase REST:', e.message || e);
    process.exit(1);
  }
})();
