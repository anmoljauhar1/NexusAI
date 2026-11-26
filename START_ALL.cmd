@echo off
if /i "%~1"=="--remote" goto remote
if /i "%~1"=="--app-only" goto app_only
call "%~dp0START_WORKSPACE.cmd" %*
exit /b %errorlevel%

:remote
node "%~dp0scripts\nexusai.mjs" start %*
exit /b %errorlevel%

:app_only
node "%~dp0scripts\nexusai.mjs" start
exit /b %errorlevel%
