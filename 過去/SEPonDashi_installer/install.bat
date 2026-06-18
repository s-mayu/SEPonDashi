@echo off
setlocal enabledelayedexpansion
cls

echo.
echo  ================================================================
echo    SEPonDashi  ^|  Installer
echo  ================================================================
echo.

set "SRC=%~dp0SEPonDashi"
set "DEST=%APPDATA%\Adobe\CEP\extensions\SEPonDashi"
set "IS_UPDATE=0"

REM --- Check source folder ---
if not exist "%SRC%\" (
    echo  [ERROR] SEPonDashi folder not found.
    echo  Make sure the SEPonDashi folder is next to this file.
    echo  Expected: %SRC%
    goto :FAILED
)

REM --- Check existing install ---
if exist "%DEST%\" (
    set "IS_UPDATE=1"
    echo  Existing install found. Running update...
    echo  Your registered SE data will be preserved.
) else (
    echo  Starting fresh installation...
)
echo.

REM ================================================================
REM  STEP 1 : PlayerDebugMode
REM ================================================================
echo  [1/3] Enabling Premiere Pro extension mode...

reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f > nul 2>&1
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f > nul 2>&1

echo         OK  ( CEP 11 + CEP 12 )

REM ================================================================
REM  STEP 2 : Copy files
REM ================================================================
echo  [2/3] Copying files...

if not exist "%DEST%\" (
    mkdir "%DEST%"
    if not exist "%DEST%\" (
        echo  [ERROR] Cannot create folder. Try "Run as administrator".
        goto :FAILED
    )
)

robocopy "%SRC%\CSXS" "%DEST%\CSXS" /E /IS /IT /NFL /NDL /NJH /NJS /NP > nul
if errorlevel 8 goto :FAILED

robocopy "%SRC%\js" "%DEST%\js" /E /IS /IT /NFL /NDL /NJH /NJS /NP > nul
if errorlevel 8 goto :FAILED

robocopy "%SRC%\jsx" "%DEST%\jsx" /E /IS /IT /NFL /NDL /NJH /NJS /NP > nul
if errorlevel 8 goto :FAILED

robocopy "%SRC%\css" "%DEST%\css" /E /IS /IT /NFL /NDL /NJH /NJS /NP > nul
if errorlevel 8 goto :FAILED

robocopy "%SRC%\lib" "%DEST%\lib" /E /IS /IT /NFL /NDL /NJH /NJS /NP > nul
if errorlevel 8 goto :FAILED

copy /Y "%SRC%\index.html" "%DEST%\index.html" > nul 2>&1
if errorlevel 1 goto :FAILED

REM config.json : copy only on fresh install (preserve user data on update)
if not exist "%DEST%\config\" mkdir "%DEST%\config"
if not exist "%DEST%\config\config.json" (
    copy /Y "%SRC%\config\config.json" "%DEST%\config\config.json" > nul 2>&1
)

REM assets/audio : create folder only, never overwrite audio files
if not exist "%DEST%\assets\"       mkdir "%DEST%\assets"
if not exist "%DEST%\assets\audio\" mkdir "%DEST%\assets\audio"

REM Verify
if not exist "%DEST%\index.html" goto :FAILED

echo         OK

REM ================================================================
REM  STEP 3 : Complete
REM ================================================================
echo  [3/3] Done!
echo.
echo  ================================================================
if !IS_UPDATE! == 1 (
    echo    UPDATED  -  SE data has been preserved.
) else (
    echo    INSTALLED
)
echo.
echo    Location : %DEST%
echo.
echo    Next steps:
echo      1. Restart Premiere Pro
echo      2. Window - Extensions - SE Pon-dashi
echo  ================================================================
echo.
pause
exit /b 0

REM ================================================================
REM  Error
REM ================================================================
:FAILED
echo.
echo  ================================================================
echo    INSTALLATION FAILED
echo.
echo    Try the following:
echo      1. Right-click install.bat - "Run as administrator"
echo      2. Close Premiere Pro and retry
echo      3. See README.txt for troubleshooting
echo  ================================================================
echo.
pause
exit /b 1
