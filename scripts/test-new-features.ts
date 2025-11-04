/**
 * Script di test per le nuove funzionalità:
 * 1. Offline Queue & Widget
 * 2. Sincronizzazione Incrementale
 * 3. Endpoint di Migrazione
 */

import { offlineQueue } from '../src/services/offlineQueue';

const API_BASE = 'http://localhost:3001';

// Colori per console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getAuthToken(): Promise<string> {
    log('\n📝 Login per ottenere token...', 'cyan');
    
    // Usa credenziali di test (modifica se necessario)
    const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@test.com',
            password: 'password123'
        })
    });

    if (!response.ok) {
        throw new Error('Login fallito. Verifica le credenziali.');
    }

    const data = await response.json();
    log('✅ Login riuscito!', 'green');
    return data.token;
}

async function test1_OfflineQueue() {
    log('\n' + '='.repeat(60), 'blue');
    log('TEST 1: Offline Queue & IndexedDB', 'blue');
    log('='.repeat(60), 'blue');

    try {
        // Test 1: Enqueue operation
        log('\n📥 Test enqueue operazione...', 'yellow');
        await offlineQueue.enqueue('upsert', {
            type: 'holiday',
            date: '2025-12-25',
            description: { reason: 'Test Holiday' }
        });
        log('✅ Operazione accodata con successo', 'green');

        // Test 2: Get queue size
        const size = await offlineQueue.getQueueSize();
        log(`📊 Dimensione coda: ${size}`, 'cyan');

        // Test 3: Process queue (simulato - senza token reale)
        log('\n⚙️ Test elaborazione coda...', 'yellow');
        // Non elaboriamo realmente per non creare dati spazzatura
        log('⚠️ Elaborazione coda saltata (test simulato)', 'yellow');

        // Test 4: Clear queue
        log('\n🗑️ Test pulizia coda...', 'yellow');
        await offlineQueue.clearQueue();
        const newSize = await offlineQueue.getQueueSize();
        log(`✅ Coda svuotata. Nuova dimensione: ${newSize}`, 'green');

        log('\n✅ TEST 1 COMPLETATO', 'green');
    } catch (error) {
        log(`\n❌ TEST 1 FALLITO: ${error}`, 'red');
    }
}

async function test2_IncrementalSync(token: string) {
    log('\n' + '='.repeat(60), 'blue');
    log('TEST 2: Sincronizzazione Incrementale', 'blue');
    log('='.repeat(60), 'blue');

    try {
        // Test 1: Full sync
        log('\n🔄 Test sync completo...', 'yellow');
        const fullResponse = await fetch(`${API_BASE}/api/events`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!fullResponse.ok) {
            throw new Error(`Full sync fallito: ${fullResponse.status}`);
        }

        const fullData = await fullResponse.json();
        log(`✅ Sync completo: ${fullData.events.length} eventi`, 'green');

        // Test 2: Incremental sync (ultimi 5 minuti)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        log(`\n📅 Test sync incrementale (da ${fiveMinutesAgo})...`, 'yellow');
        
        const incrementalResponse = await fetch(
            `${API_BASE}/api/events?since=${encodeURIComponent(fiveMinutesAgo)}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!incrementalResponse.ok) {
            throw new Error(`Incremental sync fallito: ${incrementalResponse.status}`);
        }

        const incrementalData = await incrementalResponse.json();
        log(`✅ Sync incrementale: ${incrementalData.events.length} eventi modificati`, 'green');

        // Test 3: Pagination
        log('\n📄 Test paginazione...', 'yellow');
        const paginatedResponse = await fetch(
            `${API_BASE}/api/events?limit=5&offset=0`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!paginatedResponse.ok) {
            throw new Error(`Paginazione fallita: ${paginatedResponse.status}`);
        }

        const paginatedData = await paginatedResponse.json();
        log(`✅ Paginazione: ${paginatedData.events.length} eventi (limit=5)`, 'green');
        log(`   Totale disponibili: ${paginatedData.count}`, 'cyan');

        log('\n✅ TEST 2 COMPLETATO', 'green');
    } catch (error) {
        log(`\n❌ TEST 2 FALLITO: ${error}`, 'red');
    }
}

async function test3_MigrationEndpoint(token: string) {
    log('\n' + '='.repeat(60), 'blue');
    log('TEST 3: Endpoint di Migrazione', 'blue');
    log('='.repeat(60), 'blue');

    try {
        // Test 1: Dry run (anteprima senza modifiche)
        log('\n🔍 Test dry run migrazione...', 'yellow');
        const dryRunResponse = await fetch(`${API_BASE}/api/events/migrate`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dryRun: true })
        });

        if (!dryRunResponse.ok) {
            const errorText = await dryRunResponse.text();
            log(`⚠️ Dry run response: ${dryRunResponse.status}`, 'yellow');
            log(`   ${errorText}`, 'yellow');
        } else {
            const dryRunData = await dryRunResponse.json();
            log('✅ Dry run completato:', 'green');
            log(`   Eventi da migrare: ${JSON.stringify(dryRunData, null, 2)}`, 'cyan');
        }

        // Test 2: Check endpoint availability
        log('\n🔍 Verifica disponibilità endpoint...', 'yellow');
        const healthResponse = await fetch(`${API_BASE}/api/events/migrate`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (healthResponse.status === 405) {
            log('✅ Endpoint risponde (405 = Method Not Allowed per GET, OK)', 'green');
        } else if (healthResponse.ok) {
            log('✅ Endpoint disponibile', 'green');
        } else {
            log(`⚠️ Status: ${healthResponse.status}`, 'yellow');
        }

        log('\n⚠️ Migrazione reale NON eseguita (usa force=true per eseguire)', 'yellow');
        log('✅ TEST 3 COMPLETATO', 'green');
    } catch (error) {
        log(`\n❌ TEST 3 FALLITO: ${error}`, 'red');
    }
}

async function main() {
    log('\n🚀 INIZIO TEST NUOVE FUNZIONALITÀ', 'cyan');
    log('='.repeat(60), 'cyan');

    try {
        // Test offline queue (non richiede autenticazione)
        await test1_OfflineQueue();

        // Ottieni token per i test successivi
        const token = await getAuthToken();

        // Test sincronizzazione incrementale
        await test2_IncrementalSync(token);

        // Test endpoint migrazione
        await test3_MigrationEndpoint(token);

        log('\n' + '='.repeat(60), 'green');
        log('🎉 TUTTI I TEST COMPLETATI!', 'green');
        log('='.repeat(60), 'green');

    } catch (error) {
        log(`\n💥 ERRORE GENERALE: ${error}`, 'red');
        process.exit(1);
    }
}

// Esegui i test
main();
