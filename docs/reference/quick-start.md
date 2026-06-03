# Finance App - Quick Start Card
## Keep This Handy After Migration

---

## ⚡ Start the App

```powershell
cd C:\Backups\Finance
npm run dev
```

Then open: **http://localhost:3000**

---

## 📁 Important Locations

| What | Where |
|------|-------|
| App Files | `C:\Backups\Finance\` |
| Your Data | `C:\Backups\Finance\data\` |
| Logs | `C:\Backups\Finance\logs\` |
| Uploads | `C:\Backups\Finance\uploads\` |

---

## 🔧 Common Commands

### Application Control

```powershell
# Start app
npm run dev

# Stop app
Press Ctrl+C in PowerShell

# Build for production
npm run build

# Start production mode
npm start
```

### Service Control (if installed)

```powershell
# Check status
nssm status FinanceApp

# Start service
nssm start FinanceApp

# Stop service
nssm stop FinanceApp

# Restart service
nssm restart FinanceApp

# View logs
Get-Content C:\Backups\Finance\logs\service-output.log -Tail 50 -Wait
```

---

## 🐛 Quick Troubleshooting

### App won't start?

```powershell
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process using port 3000 (replace PID)
taskkill /PID <PID> /F

# Try again
npm run dev
```

### Dependencies broken?

```powershell
# Reinstall everything
Remove-Item -Recurse -Force .\node_modules
npm install
```

### App looks broken?

```powershell
# Clear cache and restart
npm cache clean --force
npm run dev

# Hard refresh browser
Press Ctrl+Shift+R
```

---

## 💾 Backup Your Data

**CRITICAL**: Back up this folder regularly!

```powershell
# Quick backup to another drive
Copy-Item "C:\Backups\Finance\data" -Destination "D:\Backups\Finance-Backup-$(Get-Date -Format 'yyyy-MM-dd')" -Recurse
```

**Recommended**: Back up weekly or before major changes.

---

## 🔐 Security Notes

- **DO NOT** commit `.env.local` to version control
- **DO NOT** share your `data/` folder publicly
- **KEEP** backups in a secure location
- **USE** strong Gmail app password for email features

---

## 📞 Need Help?

1. Check logs: `C:\Backups\Finance\logs\`
2. See full guide: `MIGRATION_GUIDE.md`
3. Review checklist: `MIGRATION_CHECKLIST.md`

---

## ✅ Daily Health Check

Run this to verify everything is working:

```powershell
# Navigate to app
cd C:\Backups\Finance

# Check Node.js
node --version    # Should be v20.x.x+

# Check app files
Test-Path .\data  # Should be True

# Check service (if installed)
nssm status FinanceApp  # Should be SERVICE_RUNNING
```

---

**Last Updated**: April 14, 2026  
**Support**: See MIGRATION_GUIDE.md for detailed help
