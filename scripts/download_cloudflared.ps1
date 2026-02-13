$ErrorActionPreference = "Stop"
Set-Location (Split-Path $MyInvocation.MyCommand.Path)
$dst = ".\cloudflared.exe"
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $dst
Write-Output ("Downloaded: {0}" -f (Resolve-Path $dst))
