@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://github.com/Dielldev/genpact-ag-hack/releases/latest/download/install.ps1 | iex"
echo.
pause
