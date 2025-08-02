@echo off
echo ============================================
echo Steam Review Analyser - Development Mode
echo ============================================
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

:: Check backend dependencies
if not exist "..\backend\venv" (
    echo Warning: Backend virtual environment not found
    echo Please run the backend setup first
)

echo.
echo Starting development environment...
echo - Frontend will start on http://localhost:5173
echo - Backend will start on http://localhost:8000
echo - Electron app will launch automatically
echo.
echo Press Ctrl+C to stop all processes
echo.

:: Start development server
call start-electron-dev.bat

pause