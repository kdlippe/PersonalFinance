# Net Worth Tracking System

## Overview

The net worth tracking system maintains a historical record of your net worth over time, stored in a dedicated data file and updated daily at 6 AM.

## Data Storage

### Primary File
- **Location**: `data/net-worth-history.json`
- **Format**: JSON with snapshots array
- **Updates**: Daily at 6:00 AM + manual updates

### Structure
```json
{
  "lastUpdated": "2026-04-12T11:36:13.354Z",
  "totalSnapshots": 778,
  "dateRange": {
    "start": "2024-02-25",
    "end": "2026-04-12"
  },
  "snapshots": [
    {
      "date": "2024-02-25",
      "netWorth": 2831194.45,
      "totalAssets": 1500000.00,
      "totalLiabilities": 250000.00,
      "retirementAssets": 1581194.45,
      "accountBalances": {
        "Account Name": 123456.78
      },
      "source": "csv_import | daily_update",
      "createdAt": "2026-04-12T11:36:13.354Z"
    }
  ]
}
```

## Historical Data Import

### CSV Format
The system imported historical data from `data/nwot.csv`:
- **Rows Imported**: 778 daily snapshots
- **Date Range**: February 25, 2024 → April 12, 2026
- **Account Columns**: 15 different accounts tracked

### Import Command
```powershell
# Run the import script (already completed)
# Historical data now in data/net-worth-history.json
```

## Daily Updates at 6 AM

### Setup Automated Updates

#### Option 1: Windows Task Scheduler (Recommended)
```powershell
# Run this script to set up the scheduled task
.\scripts\setup-daily-update.ps1
```

This creates a Windows scheduled task that:
- Runs daily at 6:00 AM
- Executes `scripts\daily-net-worth-update.bat`
- Calculates net worth from all accounts
- Saves snapshot to `net-worth-history.json`
- Logs updates to `data\net-worth-update.log`

#### Option 2: Manual Updates
Use the "Update Now" button in the dashboard or call the API:
```bash
curl -X POST http://localhost:3000/api/net-worth-history \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

### Requirements for Automatic Updates
- Finance app must be running on `localhost:3000` at 6 AM
- If the app isn't running, the update will be skipped
- Next manual update or app restart will create today's snapshot

## How It Works

### Net Worth Calculation
The system aggregates balances from all accounts:

```typescript
totalAssets = sum(checking, savings, brokerage, investment accounts)
retirementAssets = sum(retirement accounts)
totalLiabilities = sum(credit_card, loan accounts)

netWorth = totalAssets + retirementAssets - totalLiabilities
```

### Data Sources
1. **Historical**: CSV import (`nwot.csv`) - 778 snapshots
2. **Current**: Real-time calculation from account balances
3. **Future**: Daily automated snapshots at 6 AM

## API Endpoints

### GET `/api/net-worth-history`
Retrieve historical net worth data

**Query Parameters:**
- `days` - Filter to last N days (default: 365)

**Response:**
```json
{
  "lastUpdated": "2026-04-12T11:36:13.354Z",
  "totalSnapshots": 778,
  "dateRange": {
    "start": "2024-02-25",
    "end": "2026-04-12"
  },
  "snapshots": [...]
}
```

### POST `/api/net-worth-history`
Create or update today's snapshot

**Request Body:**
```json
{
  "force": true  // Update if snapshot exists for today
}
```

**Response:**
```json
{
  "success": true,
  "snapshot": {
    "date": "2026-04-12",
    "netWorth": 2900387.54,
    "totalAssets": 700000.00,
    "totalLiabilities": 50000.00,
    "retirementAssets": 2250387.54
  },
  "message": "Created new snapshot"
}
```

## Dashboard Integration

The dashboard displays:
- **Net Worth Trend Chart** - Historical visualization
- **Period Selector** - 7d, 30d, 90d, 1y, all time
- **Change Metrics** - Dollar and percentage changes
- **Update Button** - Manual snapshot creation
- **Auto-Update Status** - Shows 6 AM schedule

## Files Created

```
data/
  net-worth-history.json    # Historical snapshots
  net-worth-update.log      # Update log file
  nwot.csv                  # Original import file

scripts/
  import-net-worth-history.js    # Import script (Node.js)
  daily-net-worth-update.bat     # Daily update script
  setup-daily-update.ps1         # Scheduler setup

app/api/
  net-worth-history/route.ts     # API endpoint

components/
  NetWorthUpdate.tsx             # Dashboard widget
```

## Current Status

✅ **Historical data imported**: 778 snapshots (Feb 2024 - Apr 2026)  
✅ **Latest net worth**: $4,551,970.99 (as of 2026-04-12)  
✅ **Storage**: Dedicated `net-worth-history.json` file  
✅ **API**: Endpoints created and tested  
✅ **Dashboard**: Integrated with chart and controls  
⏳ **Auto-updates**: Run `setup-daily-update.ps1` to enable  

## Maintenance

### View Scheduled Task
```powershell
Get-ScheduledTask -TaskName "Finance App - Daily Net Worth Update"
```

### Run Manual Update
```powershell
Start-ScheduledTask -TaskName "Finance App - Daily Net Worth Update"
```

### Remove Scheduled Task
```powershell
Unregister-ScheduledTask -TaskName "Finance App - Daily Net Worth Update" -Confirm:$false
```

### Check Update Log
```powershell
Get-Content "c:\Backups\Finance\data\net-worth-update.log" -Tail 10
```

## Troubleshooting

**Q: Snapshot not created at 6 AM?**  
A: Ensure the app is running at 6 AM. Check the update log for errors.

**Q: How to backfill missing days?**  
A: No automated backfill. Each snapshot represents actual account balances on that date.

**Q: Can I edit historical snapshots?**  
A: Yes, manually edit `net-worth-history.json`, but be careful with the JSON structure.

**Q: How to re-import CSV?**  
A: Run the import script again. It will merge with existing data, preferring CSV values for duplicate dates.
