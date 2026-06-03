@echo off
REM FinAI Edge — Windows One-Click Dev Starter
REM Run from project root: FinTechAI-AntiGravity\
REM
REM Opens three terminals:
REM   1. Express  (port 8080)
REM   2. FastAPI  (port 8000)
REM   3. Next.js  (port 9002)
REM
REM Prerequisites:
REM   - Node.js 18+ installed
REM   - Python 3.11+ installed
REM   - MongoDB running (local or Atlas URI in .env)
REM   - backend\.env configured (see README.md)
REM   - frontend\.env configured (see README.md)

setlocal
set "ROOT=%~dp0"

echo.
echo ============================================================
echo  FinAI Edge - Phase 1 Dev Starter
echo ============================================================
echo.
echo Ports:
echo   Express  : http://localhost:8080
echo   FastAPI  : http://localhost:8000/docs
echo   Frontend : http://localhost:9002
echo.
echo Prerequisites check:
where node >nul 2>&1 && echo   [OK] Node.js found || echo   [!!] Node.js NOT found - install from nodejs.org
where python >nul 2>&1 && echo   [OK] Python found  || echo   [!!] Python NOT found - install from python.org
echo.
if not exist "%ROOT%backend\.env" (
    echo   [!!] WARNING: backend\.env not found
    echo        Copy backend\.env.example to backend\.env and fill in your values.
    echo.
)
if not exist "%ROOT%frontend\.env" (
    echo   [!!] WARNING: frontend\.env not found
    echo        Copy frontend\.env.example to frontend\.env and fill in your values.
    echo.
)

echo Press any key to start all servers...
pause > nul

REM 1. Express backend
start "FinAI Edge: Express (8080)" cmd /k ^
  "cd /d "%ROOT%backend" && ^
   echo Starting Express backend on port 8080... && ^
   npm install --silent && ^
   npm run dev"

timeout /t 3 /nobreak > nul

REM 2. FastAPI backend
start "FinAI Edge: FastAPI (8000)" cmd /k ^
  "cd /d "%ROOT%backend\fastapi_app" && ^
   echo Setting up Python environment... && ^
   if not exist .venv python -m venv .venv && ^
   call .venv\Scripts\activate && ^
   pip install -r requirements.txt -q && ^
   echo Starting FastAPI on port 8000... && ^
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level info"

timeout /t 5 /nobreak > nul

REM 3. Next.js frontend
start "FinAI Edge: Frontend (9002)" cmd /k ^
  "cd /d "%ROOT%frontend" && ^
   echo Starting Next.js on port 9002... && ^
   npm install --silent && ^
   npm run dev"

echo.
echo All three servers starting...
echo.
echo Wait ~30 seconds, then open:
echo   http://localhost:9002
echo.
echo Health checks:
echo   curl http://localhost:8080/health
echo   curl http://localhost:8000/health
echo   curl http://localhost:8000/api/v2/status
echo.
