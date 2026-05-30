@echo off
REM FinAI Edge - Windows Quick Start Script
REM Run from project root: FinTechAI-AntiGravity\

echo.
echo ============================================================
echo  FinAI Edge - Phase 1 Quick Start
echo ============================================================
echo.
echo This script opens 3 terminals:
echo   1. Express backend  (port 8080)
echo   2. FastAPI backend  (port 8000)
echo   3. Next.js frontend (port 9002)
echo.
echo Prerequisites:
echo   - Node.js 18+ installed
echo   - Python 3.11+ installed
echo   - MongoDB running locally (or Atlas URI in .env)
echo   - backend\.env configured
echo   - frontend\.env configured
echo.
pause

REM Terminal 1 - Express backend
start "FinAI Edge - Express" cmd /k "cd /d %~dp0backend && npm install && npm run dev"

REM Wait a moment then start FastAPI
timeout /t 3 /nobreak >nul

REM Terminal 2 - FastAPI backend
start "FinAI Edge - FastAPI" cmd /k "cd /d %~dp0backend\fastapi_app && (if exist .venv\ (.venv\Scripts\activate) else (python -m venv .venv && .venv\Scripts\activate)) && pip install -r requirements.txt -q && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

REM Wait then start frontend
timeout /t 5 /nobreak >nul

REM Terminal 3 - Next.js frontend
start "FinAI Edge - Frontend" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"

echo.
echo All three servers starting...
echo   Express:  http://localhost:8080/health
echo   FastAPI:  http://localhost:8000/health
echo   Frontend: http://localhost:9002
echo.
echo Wait about 30 seconds for all services to be ready.
