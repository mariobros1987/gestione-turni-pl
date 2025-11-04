# Test Suite Funzionalita Nuove
Write-Host "INIZIO TEST" -ForegroundColor Cyan

$API_BASE = "http://localhost:3001"
$TEST_EMAIL = "mariobros1987@gmail.com"
$TEST_PASSWORD = "admin123"

# Test 1: Login
Write-Host "`nTEST 1: Autenticazione" -ForegroundColor Yellow

try {
    $loginBody = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$API_BASE/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -ErrorAction Stop

    $TOKEN = $loginResponse.token
    Write-Host "Login riuscito!" -ForegroundColor Green
} catch {
    Write-Host "Login fallito: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Sync Completo
Write-Host "`nTEST 2: Sincronizzazione Completa" -ForegroundColor Yellow

try {
    $headers = @{ Authorization = "Bearer $TOKEN" }
    $fullSync = Invoke-RestMethod -Uri "$API_BASE/api/events" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "Sync completo: $($fullSync.events.Count) eventi" -ForegroundColor Green
} catch {
    Write-Host "Sync fallito: $_" -ForegroundColor Red
}

# Test 3: Sync Incrementale
Write-Host "`nTEST 3: Sincronizzazione Incrementale" -ForegroundColor Yellow

try {
    $fiveMinutesAgo = (Get-Date).AddMinutes(-5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $encodedDate = [System.Web.HttpUtility]::UrlEncode($fiveMinutesAgo)
    $incrementalUrl = "$API_BASE/api/events?since=$encodedDate"
    $incrementalSync = Invoke-RestMethod -Uri $incrementalUrl -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "Eventi modificati (ultimi 5 min): $($incrementalSync.events.Count)" -ForegroundColor Green
} catch {
    Write-Host "Sync incrementale fallito: $_" -ForegroundColor Red
}

# Test 4: Paginazione
Write-Host "`nTEST 4: Paginazione" -ForegroundColor Yellow

try {
    $paginatedUrl = "$API_BASE/api/events" + "?limit=5" + "&offset=0"
    $paginatedSync = Invoke-RestMethod -Uri $paginatedUrl -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "Paginazione: $($paginatedSync.events.Count) eventi (limit=5)" -ForegroundColor Green
    Write-Host "Totale: $($paginatedSync.count)" -ForegroundColor Cyan
} catch {
    Write-Host "Paginazione fallita: $_" -ForegroundColor Red
}

# Test 5: Migrazione Dry Run
Write-Host "`nTEST 5: Migrazione Dry Run" -ForegroundColor Yellow

try {
    $migrateBody = @{ dryRun = $true } | ConvertTo-Json
    $migrationResponse = Invoke-RestMethod -Uri "$API_BASE/api/events/migrate" -Method POST -ContentType "application/json" -Headers $headers -Body $migrateBody -ErrorAction Stop
    Write-Host "Dry run completato!" -ForegroundColor Green
    Write-Host ($migrationResponse | ConvertTo-Json -Depth 3) -ForegroundColor White
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 400) {
        Write-Host "Nessun evento da migrare" -ForegroundColor Yellow
    } else {
        Write-Host "Migrazione fallita: $_" -ForegroundColor Red
    }
}

# Test 6: Health Check
Write-Host "`nTEST 6: Health Check" -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "$API_BASE/api/health" -Method GET -ErrorAction Stop
    Write-Host "Server OK: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "Health check fallito: $_" -ForegroundColor Red
}

Write-Host "`nTEST COMPLETATI!" -ForegroundColor Green
Write-Host "`nPer testare Offline Queue:" -ForegroundColor Cyan
Write-Host "1. Apri http://localhost:5173" -ForegroundColor White
Write-Host "2. Apri DevTools Console" -ForegroundColor White
Write-Host "3. Disconnetti rete" -ForegroundColor White
Write-Host "4. Crea evento (accodato)" -ForegroundColor White
Write-Host "5. Riconnetti rete" -ForegroundColor White
Write-Host "6. Verifica sync automatico" -ForegroundColor White
