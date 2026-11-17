@echo off
setlocal enabledelayedexpansion
title ProxiPilot - Redis 7 Manager
color 0B

echo ======================================================================
echo   ProxiPilot - Modern Redis 7 Engine Controller
echo ======================================================================
echo.

if "%1"=="stop" goto do_stop
if "%1"=="restart" goto do_restart
if "%1"=="status" goto do_status

:do_start
echo [*] Checking Docker daemon status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Docker is not currently running.
    echo [*] Attempting to launch Docker Desktop...
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        echo [*] Waiting for Docker to start (up to 30s)...
        for /L %%i in (1,1,15) do (
            docker info >nul 2>&1
            if !errorlevel! equ 0 goto docker_ready
            timeout /t 2 /nobreak >nul
            echo | set /p=.
        )
        echo.
    )
    echo [!] Could not verify Docker daemon.
    echo [*] Attempting fallback to local Windows Redis...
    goto fallback_local
)

:docker_ready
echo [+] Docker daemon is active.
echo.

echo [*] Checking port 6379 availability...
netstat -ano | findstr /R ":6379 .*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    :: Port 6379 is occupied. Let's see if proxipilot-redis already has it.
    docker ps --filter "name=^proxipilot-redis$" --format "{{.Status}}" | findstr /I "Up" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [+] Container 'proxipilot-redis' is already running on port 6379.
        goto verify_redis
    ) else (
        echo [!] Port 6379 is occupied by another process (e.g. legacy Redis 3.0 service).
        echo [*] Gracefully freeing port 6379...
        if exist "C:\Program Files\Redis\redis-cli.exe" (
            "C:\Program Files\Redis\redis-cli.exe" -p 6379 shutdown nosave >nul 2>&1
            timeout /t 2 /nobreak >nul
        )
    )
)

echo [*] Starting Redis 7 container (proxipilot-redis)...
docker ps -a --filter "name=^proxipilot-redis$" --format "{{.Names}}" | findstr /X "proxipilot-redis" >nul 2>&1
if %errorlevel% equ 0 (
    docker start proxipilot-redis >nul 2>&1
) else (
    docker run -d --name proxipilot-redis --restart unless-stopped -p 6379:6379 -v proxipilot-redis-data:/data redis:7-alpine redis-server --appendonly yes >nul 2>&1
)

:verify_redis
echo [*] Testing Redis 7 health and Redis Streams capability...
timeout /t 1 /nobreak >nul
docker exec proxipilot-redis redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    color 0A
    echo ======================================================================
    echo   [SUCCESS] Redis 7 is online and operational!
    echo ======================================================================
    echo   - Host URL    : redis://localhost:6379/0
    echo   - Port        : 6379
    echo   - Engine      : Redis 7.x (Alpine) via Docker
    echo   - Features    : Full Redis Streams (XADD, XGROUP) + RESP3
    echo   - Persistence : Docker Volume (proxipilot-redis-data)
    echo   - Auto-Restart: unless-stopped
    echo ======================================================================
    echo.
    goto end
)

:fallback_local
if exist "C:\Program Files\Redis\redis-server.exe" (
    echo [*] Checking Windows Redis service...
    netstat -ano | findstr /R ":6379 .*LISTENING" >nul 2>&1
    if !errorlevel! neq 0 (
        start "" "C:\Program Files\Redis\redis-server.exe" "C:\Program Files\Redis\redis.windows.conf"
        timeout /t 2 /nobreak >nul
    )
    "C:\Program Files\Redis\redis-cli.exe" ping >nul 2>&1
    if !errorlevel! equ 0 (
        echo.
        color 0E
        echo ======================================================================
        echo   [WARNING] Running on legacy Windows Redis 3.0 (port 6379)
        echo ======================================================================
        echo   Note: For complete Redis Streams (XADD) support, start Docker
        echo   and run this script again to use Redis 7.
        echo ======================================================================
        echo.
        goto end
    )
)

color 0C
echo [ERROR] Failed to start Redis. Please ensure Docker is running.
goto end

:do_stop
echo [*] Stopping Redis container...
docker stop proxipilot-redis >nul 2>&1
if exist "C:\Program Files\Redis\redis-cli.exe" (
    "C:\Program Files\Redis\redis-cli.exe" -p 6379 shutdown nosave >nul 2>&1
)
echo [+] Redis has been stopped.
goto end

:do_restart
call :do_stop
timeout /t 2 /nobreak >nul
goto do_start

:do_status
echo [*] Checking Redis status on localhost:6379...
docker ps --filter "name=^proxipilot-redis$" --format "Container: {{.Names}} | Status: {{.Status}} | Ports: {{.Ports}}"
if exist "C:\Program Files\Redis\redis-cli.exe" (
    "C:\Program Files\Redis\redis-cli.exe" -p 6379 ping 2>nul
)
goto end

:end
echo Press any key to exit...
pause >nul
