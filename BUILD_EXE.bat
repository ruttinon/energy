@echo off
title EnergyLink - Build EXE for Windows 8
echo ============================================================
echo    ENERGYLINK - BUILD PORTABLE EXE
echo    สร้างไฟล์ .exe สำหรับ deploy บน Windows 8
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/4] Building Frontend...
if not exist "frontend\dist\index.html" (
    cd frontend
    call npm run build
    cd ..
) else (
    echo      Frontend dist already exists.
)

echo.
echo [2/4] Cleaning old build...
if exist "dist\EnergyLinkSystem" rd /s /q "dist\EnergyLinkSystem"
if exist "build\EnergyLinkSystem" rd /s /q "build\EnergyLinkSystem"

echo.
echo [3/4] Building EXE with PyInstaller...
python -m PyInstaller EnergyLinkSystem.spec --clean --noconfirm

echo.
echo [4/4] Checking output...
if exist "dist\EnergyLinkSystem.exe" (
    echo.
    echo ============================================================
    echo  ✅ BUILD SUCCESS!
    echo  Output: dist\EnergyLinkSystem.exe
    echo.
    echo  วิธีใช้: คัดลอกไฟล์ต่อไปนี้ไปยังเครื่อง Windows 8:
    echo    1. dist\EnergyLinkSystem.exe
    echo    2. cloudflared.exe (ถ้าต้องการ public URL)
    echo    3. .env (ตั้งค่า LINE token)
    echo.
    echo  แล้วดับเบิลคลิก EnergyLinkSystem.exe เพื่อเริ่มระบบ
    echo ============================================================
) else (
    echo.
    echo ❌ BUILD FAILED! Check errors above.
)

pause
