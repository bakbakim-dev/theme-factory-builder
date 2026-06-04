@echo off
setlocal

set "APP_DIR=%~dp0"
set "BUILDER_DIR=C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"

set "BUILDER_PORT=7862"
set "ADMIN_PORT=8788"
set "UI_PORT=3005"

set "BUILDER_URL=http://127.0.0.1:%BUILDER_PORT%/health"
set "ADMIN_URL=http://127.0.0.1:%ADMIN_PORT%/api/admin/health"
set "UI_URL=http://127.0.0.1:%UI_PORT%"
set "ENV_FILE=%APP_DIR%.env.isolated"

cd /d "%APP_DIR%"

echo [Theme Factory Isolated] Starting isolated services...
echo [Theme Factory Isolated] Builder: %BUILDER_URL%
echo [Theme Factory Isolated] Admin Backend: %ADMIN_URL%
echo [Theme Factory Isolated] UI: %UI_URL%
echo [Theme Factory Isolated] Writing isolated build URL to .env.isolated...

(
  echo VITE_BUILD_SERVER_URL=http://127.0.0.1:%BUILDER_PORT%/build
  echo VITE_ADMIN_BACKEND_URL=http://127.0.0.1:%ADMIN_PORT%
) > "%ENV_FILE%"

if not exist "%BUILDER_DIR%\index.js" (
  echo [Theme Factory Isolated] Builder server not found at: "%BUILDER_DIR%"
  exit /b 1
)
if not exist "%NODE_EXE%" (
  echo [Theme Factory Isolated] Could not find node.exe at "%NODE_EXE%"
  exit /b 1
)
if not exist "%NPM_CMD%" (
  echo [Theme Factory Isolated] Could not find npm.cmd at "%NPM_CMD%"
  exit /b 1
)

echo [Theme Factory Isolated] Cleaning up any existing processes on target ports...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "foreach ($port in @(%BUILDER_PORT%, %ADMIN_PORT%, %UI_PORT%)) { $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c -and $c.OwningProcess) { echo ('Killing process ' + $c.OwningProcess + ' on port ' + $port); Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } }"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-RestMethod -Uri '%BUILDER_URL%' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 } } catch { exit 1 }"
if errorlevel 1 (
  echo [Theme Factory Isolated] Launching builder...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Environment]::SetEnvironmentVariable('PORT','%BUILDER_PORT%','Process'); [Environment]::SetEnvironmentVariable('THEME_FACTORY_APP_DIR','%APP_DIR%','Process'); Start-Process -FilePath '%NODE_EXE%' -ArgumentList 'index.js' -WorkingDirectory '%BUILDER_DIR%' -WindowStyle Hidden"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-RestMethod -Uri '%ADMIN_URL%' -TimeoutSec 2; if ($r.ok -eq $true) { exit 0 } } catch { exit 1 }"
if errorlevel 1 (
  echo [Theme Factory Isolated] Launching admin backend...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Environment]::SetEnvironmentVariable('WHIPIFY_ADMIN_PORT','%ADMIN_PORT%','Process'); [Environment]::SetEnvironmentVariable('WHIPIFY_ADMIN_STORAGE','%APP_DIR%storage\admin-backend-isolated','Process'); Start-Process -FilePath '%NODE_EXE%' -ArgumentList 'scripts/start-admin-backend.mjs' -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $resp = Invoke-WebRequest -Uri '%UI_URL%' -TimeoutSec 2 -UseBasicParsing; if ($resp.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  echo [Theme Factory Isolated] Launching UI in isolated mode...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Environment]::SetEnvironmentVariable('PORT','%UI_PORT%','Process'); Start-Process -FilePath '%NPM_CMD%' -ArgumentList 'run','dev','--','--port','%UI_PORT%','--host','127.0.0.1','--mode','isolated' -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden"
)

set /a BUILDER_TRIES=0
echo [Theme Factory Isolated] Waiting for Builder to respond...
:wait_builder
set /a BUILDER_TRIES+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-RestMethod -Uri '%BUILDER_URL%' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  if %BUILDER_TRIES% GEQ 20 (
    echo [Theme Factory Isolated] Builder failed to start on 127.0.0.1:%BUILDER_PORT%
    exit /b 1
  )
  ping 127.0.0.1 -n 2 >nul
  goto wait_builder
)
echo [Theme Factory Isolated] Builder ready.

set /a ADMIN_TRIES=0
echo [Theme Factory Isolated] Waiting for Admin Backend to respond...
:wait_admin
set /a ADMIN_TRIES+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-RestMethod -Uri '%ADMIN_URL%' -TimeoutSec 2; if ($r.ok -eq $true) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  if %ADMIN_TRIES% GEQ 20 (
    echo [Theme Factory Isolated] Admin Backend failed to start on port %ADMIN_PORT%
    exit /b 1
  )
  ping 127.0.0.1 -n 2 >nul
  goto wait_admin
)
echo [Theme Factory Isolated] Admin Backend ready.

set /a UI_TRIES=0
echo [Theme Factory Isolated] Waiting for UI to respond...
:wait_ui
set /a UI_TRIES+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $resp = Invoke-WebRequest -Uri '%UI_URL%' -TimeoutSec 2 -UseBasicParsing; if ($resp.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  if %UI_TRIES% GEQ 25 (
    echo [Theme Factory Isolated] UI failed to start on 127.0.0.1:%UI_PORT%
    exit /b 1
  )
  ping 127.0.0.1 -n 2 >nul
  goto wait_ui
)
echo [Theme Factory Isolated] UI ready.

start "" "%UI_URL%"
echo [Theme Factory Isolated] All services started successfully in isolated workspace mode!
exit /b 0
