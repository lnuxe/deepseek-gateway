@echo off
rem ============================================================
rem  DeepSeek gateway for Cursor  --  double-click friendly
rem  Cursor talks to it at http://127.0.0.1:8787/v1
rem  Keep this window open while you use Cursor.
rem ============================================================
setlocal enabledelayedexpansion
title DeepSeek gateway for Cursor (127.0.0.1:8787)
set "GW_PORT=8787"
set "GW_HOST=127.0.0.1"

rem --- already running? -------------------------------------------------
netstat -ano | findstr /r /c:"TCP.*127.0.0.1:%GW_PORT%.*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo   Gateway is ALREADY running on %GW_HOST%:%GW_PORT%
  echo   Cursor can use it right now. Nothing to do.
  echo.
  echo   Press any key to close this window.
  pause >nul
  exit /b 0
)

rem --- locate a node runtime --------------------------------------------
set "NODE="
for %%N in (node.exe) do if not defined NODE set "NODE=%%~$PATH:N"
if not defined NODE if exist "D:\Programs\cursor\resources\app\resources\helpers\node.exe" set "NODE=D:\Programs\cursor\resources\app\resources\helpers\node.exe"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE (
  echo   ERROR: no node.exe found. Install Node.js or edit this file.
  pause
  exit /b 1
)

echo.
echo   runtime : %NODE%
echo   listen  : http://%GW_HOST%:%GW_PORT%/v1
echo   log     : %~dp0gateway.log
echo   close this window (or press Ctrl+C) to stop the gateway.
echo.

"%NODE%" "%~dp0server.mjs"
set "RC=%ERRORLEVEL%"

echo.
echo   Gateway stopped (exit code %RC%). Last log lines:
powershell -NoProfile -Command "Get-Content '%~dp0gateway.log' -Tail 8 -ErrorAction SilentlyContinue"
echo.
echo   Press any key to close this window.
pause >nul
exit /b %RC%
