# Скрипт локальной разработки Dopamine Fitness
# Запускает Wrangler (Workers API) + Vite (React SPA) и открывает браузер

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$fitnessDir = Join-Path $root "dopamine-fitness"

Write-Host ""
Write-Host "  ⚡ Dopamine Fitness — Dev Mode" -ForegroundColor Green
Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Wrangler : http://localhost:8787" -ForegroundColor Cyan
Write-Host "  Vite     : http://localhost:5173" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

Set-Location $fitnessDir

# Запускаем Wrangler в отдельном окне
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$fitnessDir'; npx wrangler dev --local --persist" -WindowStyle Normal

# Небольшая пауза чтобы wrangler успел стартовать
Start-Sleep -Seconds 2

# Запускаем Vite в отдельном окне
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$fitnessDir\web'; npx vite" -WindowStyle Normal

# Ждём пока Vite поднимется (порт 5173)
Write-Host "  Ожидаем Vite на порту 5173..." -ForegroundColor Yellow
$attempts = 0
do {
    Start-Sleep -Seconds 1
    $attempts++
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", 5173)
        $tcp.Close()
        $ready = $true
    } catch {
        $ready = $false
        Write-Host "  ... попытка $attempts" -ForegroundColor DarkGray
    }
} while (-not $ready -and $attempts -lt 30)

if ($ready) {
    Write-Host "  ✅ Vite готов! Открываем браузер..." -ForegroundColor Green
    Start-Process "http://localhost:5173"
} else {
    Write-Host "  ⚠️  Vite не ответил за 30 сек. Открой http://localhost:5173 вручную." -ForegroundColor Red
}

Write-Host ""
Write-Host "  Нажми Ctrl+C для остановки скрипта (окна Vite/Wrangler закрой вручную)" -ForegroundColor DarkGray
# Держим окно открытым
Wait-Event
