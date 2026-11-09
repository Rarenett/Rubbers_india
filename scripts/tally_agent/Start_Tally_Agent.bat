@echo off
setlocal
title Glenda ERP - Tally Sync Agent
color 0A

:: ========================================================
:: CONFIGURATION (Edit this with your cPanel domain)
:: ========================================================
:: For local development/testing: http://localhost:8000
:: For production cPanel: https://glenda.campuzine.com
set "ERP_URL=http://localhost:8000"

:: Secret key matching your Glenda ERP settings
set "AGENT_KEY=glenda-tally-secret"

:: Local Tally Prime Port
set "TALLY_URL=http://localhost:9000"


:: How often to check for new vouchers (in seconds)
set "POLL_INTERVAL=3"
:: ========================================================

echo Starting Glenda Tally Sync Agent...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tally_agent.ps1" -ErpUrl "%ERP_URL%" -AgentKey "%AGENT_KEY%" -TallyUrl "%TALLY_URL%" -PollInterval %POLL_INTERVAL%

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Agent stopped or encountered an error.
    echo Press any key to exit...
    pause >nul
)
