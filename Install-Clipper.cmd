@echo off
setlocal
if "%~1"=="" (
    powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0Install-Clipper-Wizard.ps1"
    if errorlevel 1 pause
    exit /b
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Clipper.ps1" %*
set "CLIPPER_EXIT=%ERRORLEVEL%"
if not "%CLIPPER_EXIT%"=="0" pause
exit /b %CLIPPER_EXIT%
