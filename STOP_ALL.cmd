@echo off
node "%~dp0scripts\nexusai.mjs" stop %*
exit /b %errorlevel%
