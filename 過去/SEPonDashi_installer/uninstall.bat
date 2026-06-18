@echo off
setlocal enabledelayedexpansion
cls

echo.
echo  ================================================================
echo    SEPonDashi  ^|  Uninstaller
echo  ================================================================
echo.

set "DEST=%APPDATA%\Adobe\CEP\extensions\SEPonDashi"
set "BACKUP=%USERPROFILE%\Desktop\SEPonDashi_backup"

REM --- Check install ---
if not exist "%DEST%\" (
    echo  SEPonDashi is not installed.
    echo  Folder not found: %DEST%
    echo.
    pause
    exit /b 0
)

echo  Installed at: %DEST%
echo.
echo  ----------------------------------------------------------------
echo   What would you like to do with your SE data?
echo  ----------------------------------------------------------------
echo.
echo    1  Keep data  ( backup to Desktop )  Recommended
echo    2  Full delete  ( cannot be undone )
echo    3  Cancel
echo.
set /p "CHOICE=Enter number (1 / 2 / 3): "
echo.

if "%CHOICE%"=="1" goto :KEEP_DATA
if "%CHOICE%"=="2" goto :FULL_DELETE
goto :CANCEL

REM ================================================================
REM  Option 1 : Keep data
REM ================================================================
:KEEP_DATA
echo  Backing up SE data to Desktop before uninstall...
echo.

if exist "%BACKUP%\" rd /s /q "%BACKUP%"
mkdir "%BACKUP%"

REM New config location takes priority (main.js v5+)
set "NEW_CONFIG=%APPDATA%\SEPonDashi\config.json"
if exist "%NEW_CONFIG%" (
    copy /Y "%NEW_CONFIG%" "%BACKUP%\config.json" > nul 2>&1
    echo  [1/3] config.json backed up (from user data)
) else if exist "%DEST%\config\config.json" (
    copy /Y "%DEST%\config\config.json" "%BACKUP%\config.json" > nul 2>&1
    echo  [1/3] config.json backed up (from extension folder)
) else (
    echo  [1/3] config.json not found, skipped
)

if exist "%DEST%\assets\audio\" (
    robocopy "%DEST%\assets\audio" "%BACKUP%\audio" /E /NFL /NDL /NJH /NJS /NP > nul
    echo  [2/3] Audio files backed up
) else (
    echo  [2/3] No audio files found, skipped
)

rd /s /q "%DEST%"
if exist "%DEST%\" (
    echo.
    echo  [ERROR] Delete failed.
    echo  Please close Premiere Pro and try again.
    echo.
    pause
    exit /b 1
)

echo  [3/3] SEPonDashi removed.
echo.
echo  ================================================================
echo    Uninstall complete.
echo.
echo    Backup saved to: %BACKUP%
echo.
echo    To restore after reinstall:
echo      Run install.bat, then copy
echo      %BACKUP%\config.json
echo      to %DEST%\config\config.json
echo.
echo    Restart Premiere Pro.
echo  ================================================================
echo.
pause
exit /b 0

REM ================================================================
REM  Option 2 : Full delete
REM ================================================================
:FULL_DELETE
echo  WARNING: All SE data will be permanently deleted.
echo.
set /p "CONFIRM=Type  yes  to confirm: "
if /i "%CONFIRM%" neq "yes" goto :CANCEL

echo.
rd /s /q "%DEST%"
if exist "%DEST%\" (
    echo  [ERROR] Delete failed.
    echo  Please close Premiere Pro and try again.
    echo.
    pause
    exit /b 1
)

echo  SEPonDashi fully removed.
echo.
echo  ================================================================
echo    Uninstall complete.  Restart Premiere Pro.
echo  ================================================================
echo.
pause
exit /b 0

REM ================================================================
REM  Option 3 : Cancel
REM ================================================================
:CANCEL
echo  Cancelled. Nothing was changed.
echo.
pause
exit /b 0
