@echo off
node "%~dp0scripts\database-transfer.mjs" restore %*
exit /b %errorlevel%
