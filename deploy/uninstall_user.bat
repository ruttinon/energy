@echo off
setlocal
set "TASK_NAME=EnergyLinkAgent"
set "INSTALL_DIR=%LOCALAPPDATA%\EnergyLinkAgent"

echo [INFO] Removing task "%TASK_NAME%"...
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1

echo [INFO] Removing files...
rmdir /S /Q "%INSTALL_DIR%" 2>nul

echo [OK] Uninstalled user task and removed "%INSTALL_DIR%".
endlocal

