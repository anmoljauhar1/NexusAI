@echo off
node "%~dp0scripts\nexusai.mjs" status %*
exit /b %errorlevel%
