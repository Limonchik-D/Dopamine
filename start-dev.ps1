# Dopamine Fitness — локальная разработка
# Запускает: npm run dev:all (wrangler + npm run dev в web/)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$fitnessDir = Join-Path $root "dopamine-fitness"

Write-Host ""
Write-Host "  ⚡ Dopamine Fitness — Dev Mode" -ForegroundColor Green
Write-Host "  API  (wrangler) : http://localhost:8787" -ForegroundColor Cyan
Write-Host "  App  (npm dev)  : http://localhost:5173" -ForegroundColor Cyan
Write-Host ""

Set-Location $fitnessDir
npm run dev:all
