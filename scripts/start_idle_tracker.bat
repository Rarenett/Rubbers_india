@echo off
:: Glenda ERP - Desktop Idle Status Tracker Agent Startup Script
:: Starts the Windows background agent to monitor keyboard and mouse inactivity
cd /d "%~dp0"
title Glenda ERP Idle Tracker Agent

python desktop_idle_tracker_agent.py --server http://127.0.0.1:8000 --username admin7@gmail.com --password admin123
if %ERRORLEVEL% NEQ 0 (
    echo [!] Idle Tracker Agent exited with error code %ERRORLEVEL%.
    pause
)
