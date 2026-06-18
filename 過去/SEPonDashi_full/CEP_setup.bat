@echo off
echo.
echo ========================================
echo  SEPonDashi Panel - Setup
echo ========================================
echo.

echo [1/2] Enabling CEP extension mode...
reg add "HKEY_CURRENT_USER\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add "HKEY_CURRENT_USER\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f

echo.
echo [2/2] Creating extensions folder...
if not exist "%APPDATA%\Adobe\CEP\extensions" (
    mkdir "%APPDATA%\Adobe\CEP\extensions"
    echo Created: %APPDATA%\Adobe\CEP\extensions
) else (
    echo Already exists: %APPDATA%\Adobe\CEP\extensions
)

echo.
echo Opening extensions folder...
explorer "%APPDATA%\Adobe\CEP\extensions"

echo.
echo ========================================
echo  Done!
echo  1. Copy SEPonDashi folder into the
echo     folder that just opened.
echo  2. Restart Premiere Pro.
echo ========================================
echo.
pause
