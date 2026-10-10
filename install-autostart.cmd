@echo off
rem Register (or remove) a logon task so the gateway is always up for Cursor.
rem   install-autostart.cmd            -> create / refresh the task
rem   install-autostart.cmd remove     -> delete it
setlocal
set "TASK=deepseek-gateway-for-cursor"

if /I "%~1"=="remove" (
  schtasks /delete /tn "%TASK%" /f
  exit /b %errorlevel%
)

schtasks /create /tn "%TASK%" /sc onlogon /rl limited /f ^
  /tr "\"%~dp0start-gateway.cmd\""
echo.
echo Task "%TASK%" registered. Check it with:
echo   schtasks /query /tn "%TASK%" /v /fo list
