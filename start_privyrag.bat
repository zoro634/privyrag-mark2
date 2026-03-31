@echo off
title PrivyRAG Launcher
echo ===================================
echo    Starting PrivyRAG System...
echo ===================================
echo.

echo Starting Python API Server (Backend)...
cd "%~dp0\privyrag-backend\rag_system"
start cmd /k "title PrivyRAG Backend ^& echo Starting Backend on port 8001... ^& python api_server.py"

echo Starting Next.js UI (Frontend)...
cd "%~dp0\privyrag-ui"
start cmd /k "title PrivyRAG Frontend ^& echo Starting Frontend on port 3000... ^& npm run dev"

echo.
echo Both servers have been launched in separate terminal windows!
echo You can safely close this launcher window.
echo.
pause
