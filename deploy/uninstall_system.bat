@echo off
setlocal
net session >nul 2>&1
if not %errorlevel%==0 (
  echo [ERROR] Please run this uninstaller as Administrator.
  exit /b 1
)

set "TASK_NAME=EnergyLinkAgent"
set "INSTALL_DIR=C:\Program Files\EnergyLinkAgent"

echo [INFO] Removing task "%TASK_NAME%"...
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1

echo [INFO] Removing files...
rmdir /S /Q "%INSTALL_DIR%" 2>nul

echo [OK] Uninstalled system task and removed "%INSTALL_DIR%".
endlocal

