# Finance App Migration Guide
## Moving Your App to a New Windows System

This guide provides step-by-step instructions for migrating your Personal Finance App to a fresh Windows installation.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Step-by-Step Migration](#step-by-step-migration)
4. [Optional: Email Features Setup](#optional-email-features-setup)
5. [Optional: Windows Service Setup](#optional-windows-service-setup)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### What You Need Before Starting

1. **Access to your current system** - To copy files
2. **Administrator access** on the new Windows system
3. **Internet connection** - To download Node.js and dependencies
4. **30 minutes** - Estimated setup time

---

## System Requirements

### Minimum Requirements
- **OS**: Windows 10 or Windows 11
- **RAM**: 4 GB (8 GB recommended)
- **Disk Space**: 500 MB for application + space for your data
- **Browser**: Modern web browser (Chrome, Edge, Firefox)

---

## Step-by-Step Migration

### Step 1: Install Node.js

Node.js is required to run the application.

1. **Download Node.js**
   - Go to: https://nodejs.org/
   - Download the **LTS (Long Term Support)** version
   - Choose "Windows Installer (.msi)" for 64-bit

2. **Install Node.js**
   - Run the downloaded installer
   - Accept the license agreement
   - Use default installation path: `C:\Program Files\nodejs\`
   - ✅ **IMPORTANT**: Check the box "Automatically install necessary tools"
   - Complete the installation
   - Restart your computer

3. **Verify Installation**
   - Open PowerShell (Windows + X → Windows PowerShell)
   - Run these commands:
   ```powershell
   node --version
   # Should show: v20.x.x or similar
   
   npm --version
   # Should show: 10.x.x or similar
   ```

### Step 2: Copy Application Files

You need to copy your entire application folder to the new system.

#### Option A: Network Copy (If Both Systems Are On)

1. **On the OLD system:**
   ```powershell
   # Share the Finance folder (or use an existing network share)
   ```

2. **On the NEW system:**
   ```powershell
   # Create the destination folder
   New-Item -ItemType Directory -Path "C:\Backups\Finance" -Force
   
   # Copy files from old system (replace OLD-PC-NAME)
   Copy-Item "\\OLD-PC-NAME\C$\Backups\Finance\*" -Destination "C:\Backups\Finance\" -Recurse
   ```

#### Option B: USB Drive or External Hard Drive

1. **On the OLD system:**
   - Copy the entire folder: `C:\Backups\Finance`
   - Paste to USB drive or external hard drive

2. **On the NEW system:**
   - Copy from USB/external drive to: `C:\Backups\Finance`

#### Option C: Cloud Storage (OneDrive, Google Drive, Dropbox)

1. **On the OLD system:**
   - Upload the folder `C:\Backups\Finance` to your cloud storage

2. **On the NEW system:**
   - Download to: `C:\Backups\Finance`

#### What Files/Folders You Must Copy

Make sure these are all present in `C:\Backups\Finance\`:

```
C:\Backups\Finance\
├── app/                    ← React components & pages
├── components/             ← Reusable UI components
├── data/                   ← YOUR FINANCIAL DATA (CRITICAL!)
│   ├── accounts.json
│   ├── categories.json
│   ├── net-worth-history.json
│   ├── transactions/
│   └── ...
├── lib/                    ← Backend services & utilities
├── logs/                   ← Application logs (optional)
├── public/                 ← Static assets
├── scripts/                ← PowerShell scripts
├── uploads/                ← CSV uploads (optional)
├── package.json            ← Dependencies list
├── next.config.js          ← Next.js configuration
├── tsconfig.json           ← TypeScript configuration
└── tailwind.config.js      ← Styling configuration
```

### Step 3: Install Application Dependencies

Now install all the required Node.js packages.

1. **Open PowerShell as Administrator**
   - Windows + X → Windows PowerShell (Admin)

2. **Navigate to the application folder**
   ```powershell
   cd C:\Backups\Finance
   ```

3. **Install dependencies**
   ```powershell
   npm install
   ```
   
   This will:
   - Read `package.json`
   - Download all required packages into `node_modules/`
   - Take 2-5 minutes depending on your internet speed
   - Download ~200 MB of dependencies

4. **Verify installation succeeded**
   ```powershell
   # Check if node_modules folder exists
   Test-Path .\node_modules
   # Should output: True
   ```

### Step 4: Run the Application

1. **Start the development server**
   ```powershell
   cd C:\Backups\Finance
   npm run dev
   ```

2. **Wait for startup**
   - You should see output like:
   ```
   ▲ Next.js 14.2.0
   - Local:        http://localhost:3000
   - ready started server on [::]:3000, url: http://localhost:3000
   ```

3. **Open in your browser**
   - Navigate to: http://localhost:3000
   - You should see your Finance Dashboard

4. **Verify your data**
   - Check that all your accounts appear
   - Check that transactions are present
   - Verify the dashboard shows correct balances

5. **Test functionality**
   - Navigate to different pages (Accounts, Transactions, Settings)
   - Try adding a test transaction
   - Check that auto-updates are working (Settings → Automatic Price Updates)

### Step 5: Verify Data Files

Ensure all your financial data transferred correctly:

```powershell
# Check if data files exist
Get-ChildItem C:\Backups\Finance\data\

# You should see:
# - accounts.json
# - categories.json
# - import-history.json
# - net-worth-history.json
# - positions.json
# - price-update-history.json
# - transactions/ (folder)
```

---

## Optional: Email Features Setup

If you want to use the email features (send CSV instructions, categorization emails), you need to configure Gmail credentials.

### Step 1: Create Environment Variables File

1. **Create `.env.local` file**
   ```powershell
   cd C:\Backups\Finance
   New-Item -ItemType File -Name ".env.local"
   ```

2. **Add your Gmail credentials**
   - Open `.env.local` in Notepad
   - Add these lines (replace with your info):
   ```
   GMAIL_USER=your.email@gmail.com
   GMAIL_APP_PASSWORD=your-app-specific-password
   ```

### Step 2: Get Gmail App Password

1. **Go to Google Account Settings**
   - https://myaccount.google.com/security

2. **Enable 2-Step Verification** (if not already enabled)

3. **Generate App Password**
   - Search for "App passwords"
   - Select app: "Mail"
   - Select device: "Windows Computer"
   - Click Generate
   - Copy the 16-character password

4. **Add to `.env.local`**
   ```
   GMAIL_USER=your.email@gmail.com
   GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
   ```

5. **Restart the app**
   ```powershell
   # Press Ctrl+C to stop the app
   npm run dev
   ```

**Note**: Email features are optional. The app works fine without them.

---

## Optional: Windows Service Setup

To run the app automatically on startup (so it's always available without manually starting it):

### Step 1: Install NSSM (Non-Sucking Service Manager)

1. **Download NSSM**
   - Go to: https://nssm.cc/download
   - Download the latest version (nssm-2.24.zip)

2. **Extract NSSM**
   - Extract the zip file
   - Copy `nssm.exe` from the `win64` folder to: `C:\Windows\System32\`

3. **Verify installation**
   ```powershell
   nssm --version
   # Should show version number
   ```

### Step 2: Run the Setup Script

1. **Open PowerShell as Administrator**

2. **Run the service setup script**
   ```powershell
   cd C:\Backups\Finance\scripts
   .\setup-service.ps1
   ```

3. **Verify the service**
   ```powershell
   nssm status FinanceApp
   # Should show: SERVICE_RUNNING
   ```

### Step 3: Configure Service to Auto-Start

The script already configured auto-start, but you can verify:

1. **Open Services**
   - Press Windows + R
   - Type: `services.msc`
   - Press Enter

2. **Find "Finance App"**
   - Verify Startup Type: "Automatic"
   - Verify Status: "Running"

### Service Management Commands

```powershell
# Check status
nssm status FinanceApp

# Stop service
nssm stop FinanceApp

# Start service
nssm start FinanceApp

# Restart service
nssm restart FinanceApp

# View logs
Get-Content C:\Backups\Finance\logs\service-output.log -Tail 50 -Wait

# Remove service (if needed)
nssm remove FinanceApp confirm
```

---

## Verification

### Checklist: Is Everything Working?

Run through this checklist to ensure successful migration:

#### ✅ Basic Functionality
- [ ] App opens at http://localhost:3000
- [ ] Dashboard displays correctly
- [ ] All accounts are visible with correct balances
- [ ] Transactions page shows all historical transactions
- [ ] Portfolio page shows investment positions
- [ ] Settings page loads

#### ✅ Data Verification
- [ ] Account balances match your records
- [ ] Transaction count is correct
- [ ] Net worth history chart shows historical data
- [ ] Categories are all present

#### ✅ Interactive Features
- [ ] Can add a new transaction
- [ ] Can edit an account
- [ ] Can upload a CSV file
- [ ] Can navigate between pages
- [ ] Dark mode toggle works

#### ✅ Background Services
- [ ] Automatic price updates show "Active" in Settings
- [ ] Net worth tracking shows correct snapshot count
- [ ] Recent update history is visible

#### ✅ Optional Features
- [ ] (If configured) Email features work
- [ ] (If configured) Windows service runs on startup

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "node is not recognized as a command"

**Solution:**
- Node.js not installed or not in PATH
- Reinstall Node.js and restart your computer
- Verify installation: `node --version`

---

#### Issue: "npm install" fails with EACCES or permission errors

**Solution:**
```powershell
# Run PowerShell as Administrator
# Clear npm cache
npm cache clean --force

# Try installing again
npm install
```

---

#### Issue: App won't start - "Port 3000 already in use"

**Solution:**
```powershell
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or run on a different port
npm run dev -- -p 3001
```

---

#### Issue: Data files are missing or empty

**Solution:**
- Verify you copied the entire `data/` folder
- Check file permissions (you should have read/write access)
- The app creates empty files if they don't exist, so ensure you copied your actual data

---

#### Issue: "Cannot find module" errors

**Solution:**
```powershell
# Delete node_modules and reinstall
Remove-Item -Recurse -Force .\node_modules
Remove-Item package-lock.json
npm install
```

---

#### Issue: Background services not running

**Solution:**
- Check Settings → Automatic Price Updates
- If showing "Starting..." restart the app:
  ```powershell
  # Press Ctrl+C to stop
  npm run dev
  ```

---

#### Issue: Dark mode or styling looks broken

**Solution:**
```powershell
# Rebuild Tailwind CSS
npm run dev
# Refresh browser (Ctrl+Shift+R for hard refresh)
```

---

#### Issue: Windows service won't start

**Solution:**
```powershell
# Check service status
nssm status FinanceApp

# Check error log
Get-Content C:\Backups\Finance\logs\service-error.log -Tail 50

# Reinstall service
cd C:\Backups\Finance\scripts
.\setup-service.ps1
```

---

## Quick Reference

### Essential Commands

```powershell
# Navigate to app folder
cd C:\Backups\Finance

# Start the app (development mode)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Check service status
nssm status FinanceApp

# View real-time logs
Get-Content C:\Backups\Finance\logs\service-output.log -Tail 50 -Wait
```

### Important Locations

| Item | Path |
|------|------|
| Application | `C:\Backups\Finance\` |
| Financial Data | `C:\Backups\Finance\data\` |
| Logs | `C:\Backups\Finance\logs\` |
| Uploads | `C:\Backups\Finance\uploads\` |
| Config | `C:\Backups\Finance\.env.local` (optional) |

### Port Information

- **Development**: http://localhost:3000
- **Production**: http://localhost:3000 (configurable)

---

## Migration Complete!

Once you've completed all steps and verified everything works, your Finance App is successfully migrated to the new system.

### Next Steps

1. **Bookmark**: http://localhost:3000 in your browser
2. **Create shortcut**: Add desktop shortcut to the app URL
3. **Test backup**: Ensure your data is backed up (copy `data/` folder regularly)
4. **Update documentation**: Note any customizations you made

### Regular Maintenance

- **Backup your data**: Copy `C:\Backups\Finance\data\` folder weekly
- **Update dependencies**: Run `npm update` monthly (optional)
- **Check logs**: Review logs if issues arise
- **Monitor disk space**: Ensure adequate space for logs and data

---

## Support

If you encounter issues not covered in this guide:

1. Check the logs: `C:\Backups\Finance\logs\`
2. Review error messages in PowerShell
3. Ensure Node.js version is 20.x or higher
4. Verify all files copied correctly
5. Try stopping and restarting the app

---

**Last Updated**: April 14, 2026  
**App Version**: 0.1.0  
**Node.js Required**: 20.12.0 or higher
