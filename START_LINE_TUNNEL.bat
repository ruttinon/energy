@echo off
setlocal
echo ========================================================
echo   ENERGYLINK SERVER + WEBHOOK TUNNEL
echo ========================================================
echo.
echo 1) Starting FastAPI server (uvicorn) on port 5000...
start "EnergyLink Server" cmd /c python -m uvicorn services.backend.fastapi_app:app --host 0.0.0.0 --port 5000
echo    Waiting 5 seconds for server to initialize...
timeout /t 5 /nobreak >nul
echo.
echo 2) Starting HTTPS tunnel for LINE webhook...
echo    Preferred: Cloudflare Tunnel (no Node.js required)
echo    Fallback: LocalTunnel (requires Node.js)
echo.
if exist "%~dp0cloudflared.exe" (
  echo Detected cloudflared.exe — starting Cloudflare Tunnel...
  start "Cloudflare Tunnel" cmd /c "%~dp0cloudflared.exe" tunnel --url http://localhost:5000
  echo.
  echo When the HTTPS URL appears (https://***.trycloudflare.com), set LINE Webhook to:
  echo    https://YOUR_URL/api/line/webhook
) else (
  echo Cloudflared not found. Trying LocalTunnel (Node.js required)...
  echo If this fails, please download cloudflared.exe into this folder:
  echo    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  echo.
  call npx localtunnel --port 5000
  echo.
  echo When the HTTPS URL appears (https://***.loca.lt), set LINE Webhook to:
  echo    https://YOUR_URL/api/line/webhook
)
echo.
echo ========================================================
echo Press any key to close this window (server keeps running in separate window)...
pause >nul
endlocal
