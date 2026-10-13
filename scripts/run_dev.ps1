# PowerShell launch script for RoutePlannerV1
# Launches backend FastAPI server and Vite frontend development server concurrently

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " MDP Autonomous Patrol Route Planner - Development Launcher" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Backend startup
$BackendDir = Join-Path $ProjectRoot "backend"
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[ERROR] Python virtual environment not found at $VenvPython" -ForegroundColor Red
    Write-Host "Please create the venv: py -3.14 -m venv .venv && .\.venv\Scripts\pip install -r backend\requirements.txt"
    exit 1
}

Write-Host "[1/2] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Green
$BackendProcess = Start-Process -FilePath $VenvPython -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory $BackendDir -PassThru

# 2. Frontend startup
$FrontendDir = Join-Path $ProjectRoot "frontend"
Write-Host "[2/2] Starting Vite Frontend on http://localhost:5173..." -ForegroundColor Green
$FrontendProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $FrontendDir -PassThru

Write-Host "`nAll servers running!" -ForegroundColor Cyan
Write-Host "  - Frontend UI:  http://localhost:5173" -ForegroundColor Yellow
Write-Host "  - API Swagger:  http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "`nPress Ctrl+C or enter 'stop' to terminate both servers." -ForegroundColor Gray

try {
    while ($true) {
        $input = Read-Host
        if ($input -eq "stop" -or $input -eq "exit") {
            break
        }
    }
}
finally {
    Write-Host "Terminating background processes..." -ForegroundColor DarkGray
    if ($BackendProcess -and -not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force
    }
    if ($FrontendProcess -and -not $FrontendProcess.HasExited) {
        Stop-Process -Id $FrontendProcess.Id -Force
    }
    Write-Host "Done." -ForegroundColor Green
}
