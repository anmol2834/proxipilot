@echo off
title ProxiPilot Backend (FastAPI :8000)
rem Stop any stale/orphaned backend still holding :8000 (otherwise requests hang forever).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\free-port-8000.ps1"
cd /d "%~dp0server"
echo ========================================================
echo Starting ProxiPilot Backend (FastAPI) on port 8000...
echo Docs available at: http://localhost:8000/docs
echo ========================================================
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
