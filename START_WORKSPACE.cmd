@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-workspace.ps1" %*
exit /b %errorlevel%
