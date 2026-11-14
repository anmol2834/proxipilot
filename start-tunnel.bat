@echo off
setlocal EnableDelayedExpansion
title ProxiPilot — Cloudflare Tunnel (Gmail Pub/Sub)

:: ============================================================================
:: ProxiPilot — Cloudflare Quick Tunnel
:: Purpose  : Expose localhost:8000 to the internet temporarily so Gmail
::             Cloud Pub/Sub can POST webhook events to:
::             https://<tunnel>.trycloudflare.com/api/v1/webhooks/gmail/pubsub
::
:: Usage    : Double-click or run from project root.
::             After the tunnel URL appears, it is automatically written into
::             server\.env  (GMAIL_PUBSUB_WEBHOOK_URL and
::             GMAIL_PUBSUB_PUSH_AUDIENCE).
::
:: Note     : Each run generates a NEW random subdomain. You must re-register
::             the Gmail Push Subscription after every tunnel restart by calling:
::             POST /api/v1/integrations/gmail/setup-watch
::             (or restarting the backend — it re-registers on startup).
::
:: Future   : Replace with a named tunnel + custom domain when ready for prod.
:: ============================================================================

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║     ProxiPilot — Cloudflare Quick Tunnel                ║
echo  ║     Gmail Pub/Sub ^→ localhost:8000                      ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ── Locate cloudflared.exe ──────────────────────────────────────────────────
set "CLOUDFLARED=%~dp0server\cloudflared.exe"

if not exist "%CLOUDFLARED%" (
    echo  [ERROR] cloudflared.exe not found at:
    echo          %CLOUDFLARED%
    echo.
    echo  Download it from: https://github.com/cloudflare/cloudflared/releases
    echo  and place it at:  server\cloudflared.exe
    echo.
    pause
    exit /b 1
)

:: ── Create a temp log file to capture tunnel output ─────────────────────────
set "LOGFILE=%TEMP%\proxipilot_tunnel_%RANDOM%.log"

echo  [1/3] Starting Cloudflare Quick Tunnel on port 8000...
echo  [1/3] Tunnel log: %LOGFILE%
echo.

:: Start cloudflared in background, redirect output to log file
start /b "" "%CLOUDFLARED%" tunnel --url http://localhost:8000 > "%LOGFILE%" 2>&1

:: ── Wait for the tunnel URL to appear in the log (poll every 1s, max 30s) ───
echo  [2/3] Waiting for tunnel URL...
set "TUNNEL_URL="
set /a ATTEMPTS=0

:WAIT_LOOP
timeout /t 1 /nobreak >nul
set /a ATTEMPTS+=1

:: Read the log and look for the trycloudflare.com URL
for /f "tokens=*" %%L in ('findstr /i "trycloudflare.com" "%LOGFILE%" 2^>nul') do (
    :: Extract the https URL from the log line
    for /f "tokens=* delims= " %%U in ("%%L") do (
        set "RAW_LINE=%%U"
    )
    :: Parse: find the https:// token in the line
    for %%W in (!RAW_LINE!) do (
        set "WORD=%%W"
        if /i "!WORD:~0,8!"=="https://" (
            set "TUNNEL_URL=!WORD!"
        )
    )
)

if defined TUNNEL_URL goto :GOT_URL

if !ATTEMPTS! GEQ 30 (
    echo.
    echo  [ERROR] Timed out waiting for tunnel URL after 30 seconds.
    echo  Check log: %LOGFILE%
    echo.
    pause
    exit /b 1
)
goto :WAIT_LOOP

:GOT_URL
:: Strip any trailing characters (CR, spaces, pipe chars from log formatting)
set "TUNNEL_URL=!TUNNEL_URL: =!"
set "TUNNEL_URL=!TUNNEL_URL:|=!"

set "WEBHOOK_URL=!TUNNEL_URL!/api/v1/webhooks/gmail/pubsub"

echo.
echo  ┌─────────────────────────────────────────────────────────┐
echo  │  ✓ Tunnel is LIVE                                       │
echo  │                                                         │
echo  │  Public URL  : !TUNNEL_URL!
echo  │  Webhook URL : !WEBHOOK_URL!
echo  └─────────────────────────────────────────────────────────┘
echo.

:: ── Update server\.env with the new tunnel URL ───────────────────────────────
echo  [3/3] Updating server\.env ...

set "ENV_FILE=%~dp0server\.env"

if not exist "%ENV_FILE%" (
    echo  [WARN] server\.env not found at %ENV_FILE% — skipping auto-update.
    goto :DONE
)

:: Write updated .env by replacing the two Pub/Sub lines
set "TMPENV=%TEMP%\proxipilot_env_%RANDOM%.tmp"
set "UPDATED_WEBHOOK=0"
set "UPDATED_AUDIENCE=0"

(
    for /f "usebackq delims=" %%A in ("%ENV_FILE%") do (
        set "LINE=%%A"

        :: Replace GMAIL_PUBSUB_WEBHOOK_URL line
        echo !LINE! | findstr /b "GMAIL_PUBSUB_WEBHOOK_URL=" >nul 2>&1
        if !ERRORLEVEL!==0 (
            echo GMAIL_PUBSUB_WEBHOOK_URL=!WEBHOOK_URL!
            set "UPDATED_WEBHOOK=1"
        ) else (
            :: Replace GMAIL_PUBSUB_PUSH_AUDIENCE line
            echo !LINE! | findstr /b "GMAIL_PUBSUB_PUSH_AUDIENCE=" >nul 2>&1
            if !ERRORLEVEL!==0 (
                echo GMAIL_PUBSUB_PUSH_AUDIENCE=!WEBHOOK_URL!
                set "UPDATED_AUDIENCE=1"
            ) else (
                echo !LINE!
            )
        )
    )
) > "%TMPENV%"

:: Replace original .env with updated version
move /y "%TMPENV%" "%ENV_FILE%" >nul

echo  ✓ server\.env updated:
echo     GMAIL_PUBSUB_WEBHOOK_URL  = !WEBHOOK_URL!
echo     GMAIL_PUBSUB_PUSH_AUDIENCE = !WEBHOOK_URL!
echo.

:DONE
echo ════════════════════════════════════════════════════════════
echo   ACTION REQUIRED:
echo   Restart the backend (start-backend.bat) so it picks up
echo   the new tunnel URL and re-registers the Gmail Push Watch.
echo ════════════════════════════════════════════════════════════
echo.
echo   Tunnel is running. Press CTRL+C to stop.
echo   (Closing this window will kill the tunnel)
echo.

:: Keep the window alive — cloudflared is running in background
:: We need to watch it so closing this window signals the user
:KEEPALIVE
timeout /t 5 /nobreak >nul
:: Check if cloudflared is still running
tasklist /fi "imagename eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo  [WARN] cloudflared process has stopped unexpectedly.
    echo  Check log: %LOGFILE%
    pause
    exit /b 1
)
goto :KEEPALIVE
