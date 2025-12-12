@echo off
setlocal

rem ===== Admin check =====
net session >nul 2>&1
if not %errorlevel%==0 (
  echo [ERROR] Please run this installer as Administrator.
  exit /b 1
)

rem ===== Configuration =====
set "BACKEND=http://127.0.0.1:8000"
set "USERNAME=AGENT_USER"
set "PASSWORD=SECRET"
set "PROJECT=CPRAM-639ec8"

rem ===== Locate source EXE =====
set "EXE_NAME=EnergyLinkAgent.exe"
set "SCRIPT_DIR=%~dp0"
set "DIST_EXE=%SCRIPT_DIR%..\dist\%EXE_NAME%"
set "SRC_EXE=%SCRIPT_DIR%%EXE_NAME%"
if exist "%DIST_EXE%" (
  set "SRC_EXE=%DIST_EXE%"
)

rem ===== Destination =====
set "INSTALL_DIR=C:\Program Files\EnergyLinkAgent"
set "TASK_NAME=EnergyLinkAgent"

echo [INFO] Source: "%SRC_EXE%"
echo [INFO] Install dir: "%INSTALL_DIR%"
echo [INFO] Task name: "%TASK_NAME%"

if not exist "%SRC_EXE%" (
  echo [ERROR] %EXE_NAME% not found in dist or next to installer
  exit /b 1
)

mkdir "%INSTALL_DIR%" 2>nul
copy /Y "%SRC_EXE%" "%INSTALL_DIR%\%EXE_NAME%" >nul
if errorlevel 1 (
  echo [ERROR] Copy failed
  exit /b 1
)

set "TASK_EXE=%INSTALL_DIR%\%EXE_NAME%"
set "TASK_ARGS=--backend \"%BACKEND%\" --username \"%USERNAME%\" --password \"%PASSWORD%\" --project \"%PROJECT%\""
echo [INFO] Creating startup task as SYSTEM...
schtasks /Create /SC ONSTART /TN "%TASK_NAME%" /TR "\"%TASK_EXE%\" %TASK_ARGS%" /RL HIGHEST /RU "SYSTEM" /F
if errorlevel 1 (
  echo [ERROR] schtasks /Create failed
  exit /b 1
)

echo [INFO] Starting task...
schtasks /Run /TN "%TASK_NAME%" >nul 2>&1

echo [OK] Installed and started "%TASK_NAME%".
echo [HINT] Logs: "%INSTALL_DIR%\agent_local.log"
endlocal
