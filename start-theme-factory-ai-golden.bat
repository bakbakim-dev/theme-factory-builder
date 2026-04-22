@echo off
setlocal

set "APP_DIR=%~dp0"
set "BUILDER_DIR=C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
set "BUILDER_PORT=7860"
set "BUILDER_URL=http://localhost:%BUILDER_PORT%/health"
set "UI_PORT=%~1"
if "%UI_PORT%"=="" set "UI_PORT=5174"
set "UI_URL=http://localhost:%UI_PORT%"

cd /d "%APP_DIR%"

echo [Theme Factory] Starting services...
echo [Theme Factory] Builder: %BUILDER_URL%
echo [Theme Factory] UI: %UI_URL%

if not exist "%BUILDER_DIR%\index.js" (
  echo [Theme Factory] Builder server not found: "%BUILDER_DIR%"
  pause
  exit /b 1
)
if not exist "%NODE_EXE%" (
  echo [Theme Factory] Could not find node.exe at "%NODE_EXE%"
  pause
  exit /b 1
)
if not exist "%NPM_CMD%" (
  echo [Theme Factory] Could not find npm.cmd at "%NPM_CMD%"
  pause
  exit /b 1
)

REM --- Builder ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-RestMethod -Uri '%BUILDER_URL%' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 } } catch { exit 1 }"
if errorlevel 1 (
  echo [Theme Factory] Launching builder...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$c = Get-NetTCPConnection -LocalPort %BUILDER_PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c -and $c.OwningProcess) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }; [Environment]::SetEnvironmentVariable('PORT',$null,'Process'); [Environment]::SetEnvironmentVariable('THEME_FACTORY_APP_DIR','%APP_DIR%','Process'); Start-Process -FilePath '%NODE_EXE%' -ArgumentList 'index.js' -WorkingDirectory '%BUILDER_DIR%' -WindowStyle Hidden"
)

set /a BUILDER_TRIES=0
:wait_builder
set /a BUILDER_TRIES+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-RestMethod -Uri '%BUILDER_URL%' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  if %BUILDER_TRIES% GEQ 20 (
    echo [Theme Factory] Builder failed to start on localhost:%BUILDER_PORT%
    pause
    exit /b 1
  )
  timeout /t 1 /nobreak >nul
  goto wait_builder
)

echo [Theme Factory] Builder ready.

REM --- UI ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $resp = Invoke-WebRequest -Uri '%UI_URL%' -TimeoutSec 2 -UseBasicParsing; if ($resp.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  echo [Theme Factory] Launching UI...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$c = Get-NetTCPConnection -LocalPort %UI_PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c -and $c.OwningProcess) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }; [Environment]::SetEnvironmentVariable('PORT',$null,'Process'); Start-Process -FilePath '%NPM_CMD%' -ArgumentList 'run','dev','--','--port','%UI_PORT%','--host','127.0.0.1' -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden"
)

set /a UI_TRIES=0
:wait_ui
set /a UI_TRIES+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $resp = Invoke-WebRequest -Uri '%UI_URL%' -TimeoutSec 2 -UseBasicParsing; if ($resp.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  if %UI_TRIES% GEQ 25 (
    echo [Theme Factory] UI failed to start on localhost:%UI_PORT%
    pause
    exit /b 1
  )
  timeout /t 1 /nobreak >nul
  goto wait_ui
)

echo [Theme Factory] UI ready.
start "" "%UI_URL%"
echo [Theme Factory] All services started.
exit /b 0
