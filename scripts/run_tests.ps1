# Run all backend and frontend test suites
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " 1. Running Backend Pytest Test Suite    " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
& $VenvPython -m pytest -v (Join-Path $ProjectRoot "backend\tests")
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Backend tests failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " 2. Running Backend Ruff Lint Suite      " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
& $VenvPython -m ruff check (Join-Path $ProjectRoot "backend")
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Backend lint failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host " 3. Running Frontend Vitest Suite        " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Push-Location (Join-Path $ProjectRoot "frontend")
npm test
$frontendExit = $LASTEXITCODE
Pop-Location
if ($frontendExit -ne 0) {
    Write-Host "[FAIL] Frontend tests failed!" -ForegroundColor Red
    exit $frontendExit
}

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host " ALL TEST SUITES PASSED SUCCESSFULLY!    " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
