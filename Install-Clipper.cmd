@echo off
setlocal
if "%~1"=="" goto wizard
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Clipper.ps1" %*
goto finish

:wizard
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0Install-Clipper-Wizard.ps1"

:finish
set "CLIPPER_EXIT=%ERRORLEVEL%"
if not "%CLIPPER_EXIT%"=="0" pause
exit /b %CLIPPER_EXIT%
