# Setup Daily Net Worth Update Task
# This script creates a Windows Task Scheduler task to update net worth daily at 6 AM

Write-Host "Setting up daily net worth update task..." -ForegroundColor Cyan
Write-Host ""

$taskName = "Finance App - Daily Net Worth Update"
$scriptPath = "c:\Backups\Finance\scripts\daily-net-worth-update.bat"
$time = "06:00"

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task already exists. Removing old task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action
$action = New-ScheduledTaskAction -Execute $scriptPath

# Create the trigger (daily at 6 AM)
$trigger = New-ScheduledTaskTrigger -Daily -At $time

# Create the principal (run whether user is logged on or not)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U

# Create the settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Register the task
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Updates net worth snapshot daily at 6 AM by calculating aggregate value of all accounts"

Write-Host "✅ Scheduled task created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Task details:" -ForegroundColor Cyan
Write-Host "  Name: $taskName"
Write-Host "  Schedule: Daily at $time"
Write-Host "  Script: $scriptPath"
Write-Host ""
Write-Host "Note: Make sure your Finance app is running on localhost:3000 at 6 AM for the update to work." -ForegroundColor Yellow
Write-Host ""
Write-Host "To view the task:" -ForegroundColor Cyan
Write-Host "  Get-ScheduledTask -TaskName '$taskName'"
Write-Host ""
Write-Host "To run the task manually:" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName '$taskName'"
Write-Host ""
Write-Host "To remove the task:" -ForegroundColor Cyan
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
