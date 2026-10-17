@echo off
rem Double-click this file to play (Windows). It starts a tiny local web server and opens the game.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 goto usepy
where python >nul 2>nul
if %errorlevel%==0 goto usepython
echo.
echo Python was not found. Install it free from https://www.python.org/downloads/
echo (tick "Add python.exe to PATH"), then double-click start.bat again.
echo Or see README.md for other ways to run the game.
pause
goto :eof
:usepy
start "" http://localhost:8000
py -m http.server 8000
goto :eof
:usepython
start "" http://localhost:8000
python -m http.server 8000
