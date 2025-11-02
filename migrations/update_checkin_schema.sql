-- Migrazione per aggiornare la tabella checkin
-- Esegui questo script su Supabase SQL Editor

-- Rinomina la colonna 'azione' in 'type'
ALTER TABLE checkin RENAME COLUMN azione TO type;

-- Rinomina la colonna 'tag_content' in 'rawPayload'
ALTER TABLE checkin RENAME COLUMN tag_content TO rawPayload;

-- Aggiungi la colonna 'serialNumber' se non esiste
ALTER TABLE checkin ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;

-- Verifica la struttura finale
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'checkin'
ORDER BY ordinal_position;
