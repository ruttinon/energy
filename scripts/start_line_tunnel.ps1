$ErrorActionPreference = "Stop"
Set-Location (Split-Path $MyInvocation.MyCommand.Path)
try {
  $server = Start-Process -FilePath "python" -ArgumentList "-m","uvicorn","services.backend.fastapi_app:app","--host","0.0.0.0","--port","5000" -PassThru
} catch {}
Start-Sleep -Seconds 3
if (Test-Path ".\cloudflared.exe") {
  $p = Start-Process -FilePath ".\cloudflared.exe" -ArgumentList "tunnel","--url","http://0.0.0.0:5000" -RedirectStandardOutput ".\cloudflared.log" -RedirectStandardError ".\cloudflared.err.log" -PassThru
  Start-Sleep -Seconds 3
  $url = ""
  for ($i=0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path ".\cloudflared.log") {
      $lines = Get-Content ".\cloudflared.log" -ErrorAction SilentlyContinue
      foreach ($line in $lines) {
        if ($line -match "https://[^\\s]*trycloudflare\\.com") {
          $url = ($line | Select-String -Pattern "https://[^\\s]*trycloudflare\\.com" | ForEach-Object { $_.Matches[0].Value })
          break
        }
      }
      if ($url) { break }
    }
    if (-not $url -and (Test-Path ".\cloudflared.err.log")) {
      $elines = Get-Content ".\cloudflared.err.log" -ErrorAction SilentlyContinue
      foreach ($line in $elines) {
        if ($line -match "https://[^\\s]*trycloudflare\\.com") {
          $url = ($line | Select-String -Pattern "https://[^\\s]*trycloudflare\\.com" | ForEach-Object { $_.Matches[0].Value })
          break
        }
      }
      if ($url) { break }
    }
  }
  if ($url) {
    Write-Output ("Webhook: {0}/api/line/webhook" -f $url)
    Write-Output ("Status:  {0}/api/line/status" -f $url)
  } else {
    Write-Output "Tunnel URL not detected. Open cloudflared.log to check."
  }
} else {
  Write-Output "cloudflared.exe not found. Download it and place in project root."
}
