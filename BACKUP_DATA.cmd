@echo off
node "%~dp0scripts\database-transfer.mjs" backup %*
exit /b %errorlevel%
