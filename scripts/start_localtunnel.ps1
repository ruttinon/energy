Param(
  [string]$Port = "5000",
  [string]$BindHost = "0.0.0.0",
  [string]$Subdomain = "energylink-bot"
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $MyInvocation.MyCommand.Path)
try {
  $server = Start-Process -FilePath "python" -ArgumentList "-m","uvicorn","services.backend.fastapi_app:app","--host",$BindHost,"--port",$Port -PassThru
} catch {}
Start-Sleep -Seconds 3
$url = ""
$ltStarted = $true
try {
  $lt = Start-Process -FilePath "npx" -ArgumentList "localtunnel","--port",$Port,"--subdomain",$Subdomain -RedirectStandardOutput ".\lt.log" -PassThru
} catch {
  Write-Output "npx/localtunnel not available. Checking cloudflared.exe..."
  $ltStarted = $false
}
Start-Sleep -Seconds 3
if ($ltStarted) {
  for ($i=0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path ".\lt.log") {
      $lines = Get-Content ".\lt.log" -ErrorAction SilentlyContinue
      foreach ($line in $lines) {
        if ($line -match "https://[^\s]+") {
          $url = ($line | Select-String -Pattern "https://[^\s]+" | ForEach-Object { $_.Matches[0].Value })
          break
        }
      }
      if ($url) { break }
    }
  }
  if (-not $url -and $Subdomain) {
    $url = "https://$Subdomain.loca.lt"
  }
} else {
  if (Test-Path ".\cloudflared.exe") {
    try {
      $cf = Start-Process -FilePath ".\cloudflared.exe" -ArgumentList "tunnel","--url","http://$BindHost`:$Port" -RedirectStandardOutput ".\cloudflared.log" -PassThru
      Start-Sleep -Seconds 3
      for ($i=0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path ".\cloudflared.log") {
          $lines = Get-Content ".\cloudflared.log" -ErrorAction SilentlyContinue
          foreach ($line in $lines) {
            if ($line -match "https://[^\s]+") {
              $url = ($line | Select-String -Pattern "https://[^\s]+" | ForEach-Object { $_.Matches[0].Value })
              break
            }
          }
          if ($url) { break }
        }
      }
    } catch {
      Write-Output "Failed to start cloudflared tunnel."
    }
  } else {
    Write-Output "cloudflared.exe not found."
  }
}
if ($url) {
  Write-Output ("Webhook: {0}/api/line/webhook" -f $url)
  Write-Output ("Status:  {0}/api/line/status" -f $url)
} else {
  $localUrl = "http://127.0.0.1:$Port"
  Write-Output "No tunnel detected. Backend is running locally."
  Write-Output ("Local Webhook: {0}/api/line/webhook" -f $localUrl)
  Write-Output ("Local Status:  {0}/api/line/status" -f $localUrl)
}
