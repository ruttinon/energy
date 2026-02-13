Write-Host "Restarting EnergyLink Backend..." -ForegroundColor Cyan

# Kill existing python processes
try {
    # Force kill any process on port 5000 (Python or Uvicorn)
    $port5000 = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
    if ($port5000) {
        $pid5000 = $port5000.OwningProcess
        Stop-Process -Id $pid5000 -Force -ErrorAction SilentlyContinue
        Write-Host "Killed process $pid5000 on port 5000." -ForegroundColor Yellow
    }

    Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "Stopped existing Python processes." -ForegroundColor Green
}
catch {
    Write-Host "No Python processes to stop." -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# Start Backend
Write-Host "Starting API..." -ForegroundColor Cyan
python -m uvicorn services.backend.fastapi_app:app --host 0.0.0.0 --port 5000
