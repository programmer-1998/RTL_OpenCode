@echo off
rem opencode Desktop RTL/bidi patch — Windows (double-click launcher)
rem Powers off the Execution Policy for this script only, then runs it.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0desktop-rtl.ps1" %*
echo.
pause