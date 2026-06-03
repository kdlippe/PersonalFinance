@echo off
REM Daily Net Worth Update Script
REM Run this script at 6 AM daily using Windows Task Scheduler

echo Updating daily net worth snapshot...
echo.

curl -X POST http://localhost:3000/api/net-worth-history -H "Content-Type: application/json" -d "{\"force\":true}"

echo.
echo Net worth snapshot updated at %date% %time%
echo.

REM Log the update
echo %date% %time% - Net worth snapshot updated >> "c:\Backups\Finance\data\net-worth-update.log"
