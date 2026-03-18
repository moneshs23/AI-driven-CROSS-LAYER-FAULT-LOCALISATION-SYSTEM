# start.ps1
# Script to launch both the FastAPI backend and Vite React frontend

Write-Host "Starting Tanfinet Fault Finder Services..." -ForegroundColor Cyan

# 1. Start the FastAPI Backend in the background
Write-Host "Launching FastAPI Backend on port 8000..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m uvicorn api:app --reload --port 8000" -WorkingDirectory ".\backend"

# Wait a couple seconds to ensure backend starts
Start-Sleep -Seconds 2

# 2. Start the Vite React Frontend
Write-Host "Launching Vite Frontend on port 3000..." -ForegroundColor Green
Set-Location ".\frontend"
npm run dev
