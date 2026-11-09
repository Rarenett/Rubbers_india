@echo off
TITLE Glenda ERP Desktop Screenshot Capture Agent
echo ===================================================================
echo  Starting Glenda ERP Desktop Screenshot Capture Agent (Windows)
echo ===================================================================
cd /d "%~dp0"
python desktop_capture_agent.py %*
pause
