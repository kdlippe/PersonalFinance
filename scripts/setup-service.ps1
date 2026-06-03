# Setup Finance App as Windows Service
# Run this script as Administrator

Write-Host "Setting up Finance App as Windows Service..." -ForegroundColor Cyan

# Remove existing service if it exists
Write-Host "`nRemoving existing service..." -ForegroundColor Yellow
nssm stop FinanceApp 2>$null
nssm remove FinanceApp confirm 2>$null

# Create logs directory
$logsPath = "C:\Backups\Finance\logs"
if (!(Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    Write-Host "Created logs directory: $logsPath" -ForegroundColor Green
}

# Install service with correct configuration
Write-Host "`nInstalling service with correct configuration..." -ForegroundColor Yellow

# Use npm.cmd to run the dev server
nssm install FinanceApp "C:\Program Files\nodejs\npm.cmd"
nssm set FinanceApp AppParameters "run dev"
nssm set FinanceApp AppDirectory "C:\Backups\Finance"
nssm set FinanceApp AppStdout "$logsPath\service-output.log"
nssm set FinanceApp AppStderr "$logsPath\service-error.log"
nssm set FinanceApp AppRotateFiles 1
nssm set FinanceApp AppRotateOnline 1
nssm set FinanceApp AppRotateBytes 1048576
nssm set FinanceApp DisplayName "Finance App"
nssm set FinanceApp Description "Personal Finance Tracking Application"
nssm set FinanceApp Start SERVICE_AUTO_START

Write-Host "`nService installed successfully!" -ForegroundColor Green

# Start the service
Write-Host "`nStarting service..." -ForegroundColor Yellow
nssm start FinanceApp

# Wait a moment for startup
Start-Sleep -Seconds 3

# Check status
Write-Host "`nService Status:" -ForegroundColor Cyan
nssm status FinanceApp

Write-Host "`nService Details:" -ForegroundColor Cyan
Write-Host "  Name: FinanceApp"
Write-Host "  App: http://localhost:3000"
Write-Host "  Logs: $logsPath"
Write-Host "  Output: $logsPath\service-output.log"
Write-Host "  Errors: $logsPath\service-error.log"

Write-Host "`nUseful Commands:" -ForegroundColor Cyan
Write-Host "  Check status:  nssm status FinanceApp"
Write-Host "  View config:   nssm dump FinanceApp"
Write-Host "  Stop service:  nssm stop FinanceApp"
Write-Host "  Start service: nssm start FinanceApp"
Write-Host "  Restart:       nssm restart FinanceApp"
Write-Host "  Remove:        nssm remove FinanceApp confirm"
Write-Host "  View logs:     Get-Content $logsPath\service-output.log -Tail 50 -Wait"

Write-Host "`nNOTE: After reboot, the service will start automatically." -ForegroundColor Yellow
Write-Host "      Check the app is accessible at http://localhost:3000" -ForegroundColor Yellow
