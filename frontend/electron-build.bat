@echo off
echo Building Steam Review Analyser for Distribution...
echo.

:: Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Build for production
echo Building application...
call npm run electron-dist

if %errorlevel% EQU 0 (
    echo.
    echo Build completed successfully!
    echo Check the 'dist-electron' folder for the installer.
    echo.
    if exist "dist-electron" (
        echo Opening build directory...
        start "" "dist-electron"
    )
) else (
    echo.
    echo Build failed! Please check the error messages above.
)

:wait
echo Press Ctrl+C to close this window.
timeout /t 60 >nul
goto wait