@echo off
echo Starting development servers...

:: Start Vite in background
start /b npm run dev

:: Wait a bit for Vite to start
timeout /t 3 /nobreak >nul

:: Wait for server and start Electron
npx wait-on http://localhost:5173 && set NODE_ENV=development && electron .