@echo off
setlocal

set BUILDER_PORT=7860
set BUILDER_DIR=C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server

set PORT=%~1
if "%PORT%"=="" set PORT=5174

cd /d "%~dp0"

REM --- Ensure builder server is running ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok = (Test-NetConnection -ComputerName localhost -Port %BUILDER_PORT%).TcpTestSucceeded; exit ([int](-not $ok))" >nul 2>nul
if errorlevel 1 (
  if not exist "%BUILDER_DIR%\\index.js" (
    echo [Theme Factory] Builder server not found: "%BUILDER_DIR%"
    echo [Theme Factory] Edit BUILDER_DIR in this .bat to your server path.
    pause
    exit /b 1
  )
  echo [Theme Factory] Starting builder server on http://localhost:%BUILDER_PORT% ...
  start "Theme Factory Builder" /min cmd /c "cd /d \"%BUILDER_DIR%\" && npm.cmd start"
)

REM Wait up to ~30s for /health to respond
set /a _tries=0
:wait_builder
set /a _tries+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-RestMethod -Uri 'http://localhost:%BUILDER_PORT%/health' -TimeoutSec 3; if ($r.status -eq 'ok') { exit 0 } } catch { } ; exit 1" >nul 2>nul
if errorlevel 1 (
  if %_tries% GEQ 10 (
    echo [Theme Factory] Builder server did not come up. Check the Builder window/logs.
    pause
    exit /b 1
  )
  timeout /t 3 /nobreak >nul
  goto wait_builder
)
echo [Theme Factory] Builder server OK.

echo [Theme Factory] Starting UI on http://localhost:%PORT% ...
call npm.cmd run dev -- --port %PORT%
