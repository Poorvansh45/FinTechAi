@echo off
REM FinAI Edge — Git Tag Phase 1 Script
REM Run from the project root: FinTechAI-AntiGravity\

echo.
echo ============================================================
echo  FinAI Edge — Tagging Phase 1 Release
echo ============================================================
echo.

cd /d %~dp0

REM Check git is clean enough to tag
git status --short
echo.
echo Review any uncommitted changes above.
echo Press Ctrl+C to abort, or any key to continue tagging...
pause > nul

REM Stage and commit any pending changes
git add -A
git commit -m "phase1: production-ready - analytics, dashboard polish, timeout handling, validation suite" --allow-empty

REM Create annotated tag
git tag -a v1.0.0-phase1 -m "Phase 1 complete: portfolio analytics, AI portfolio gen, market data, dashboard polish, validation tests"

echo.
echo Tagged as v1.0.0-phase1
echo.
echo To push to remote:
echo   git push origin main
echo   git push origin v1.0.0-phase1
echo.
