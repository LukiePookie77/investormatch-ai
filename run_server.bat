@echo off
REM InvestorMatch AI - start the Python backend and open the app.
cd /d "%~dp0"

REM Optional: set a live data key for real prices (uncomment + add your key)
REM set FINNHUB_API_KEY=your_key_here

where py >nul 2>nul
if %errorlevel%==0 (
  py server.py
) else (
  python server.py
)
pause
