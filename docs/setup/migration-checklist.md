# Finance App Migration Checklist
## Quick Reference for Moving to a New Windows System

Print this checklist and check off each item as you complete it.

---

## Pre-Migration (On OLD System)

- [ ] **Backup your data folder**
  - Location: `C:\Backups\Finance\data\`
  - Copy to USB drive or cloud storage

- [ ] **Note your current Node.js version**
  ```powershell
  node --version  # Write it down: __________
  ```

- [ ] **Copy the entire application folder**
  - Source: `C:\Backups\Finance\`
  - Verify size: ~500 MB (before node_modules)

---

## New System Setup

### Phase 1: System Prerequisites

- [ ] **Install Node.js LTS version**
  - Download: https://nodejs.org/
  - Version installed: __________
  - Verify: `node --version` ✓
  - Verify: `npm --version` ✓
  - **Restart computer after installation**

### Phase 2: Copy Application Files

- [ ] **Create destination folder**
  ```powershell
  New-Item -ItemType Directory -Path "C:\Backups\Finance" -Force
  ```

- [ ] **Copy all files to C:\Backups\Finance\**
  - Method used: □ Network  □ USB  □ Cloud
  - Verify folder size matches original

- [ ] **Verify critical folders exist**
  - [ ] `app/`
  - [ ] `components/`
  - [ ] `data/` ← MOST IMPORTANT!
  - [ ] `lib/`
  - [ ] `scripts/`
  - [ ] `package.json`

### Phase 3: Install Dependencies

- [ ] **Open PowerShell as Administrator**

- [ ] **Navigate to app folder**
  ```powershell
  cd C:\Backups\Finance
  ```

- [ ] **Install dependencies**
  ```powershell
  npm install
  ```
  - Time started: __________
  - Time completed: __________
  - Any errors? □ Yes  □ No

- [ ] **Verify node_modules folder created**

### Phase 4: Run the Application

- [ ] **Start the app**
  ```powershell
  npm run dev
  ```

- [ ] **Open browser to http://localhost:3000**

- [ ] **Verify dashboard loads**

- [ ] **Check account balances match**
  - Expected total: $__________
  - Actual total: $__________
  - Match? □ Yes  □ No

- [ ] **Navigate to each page**
  - [ ] Dashboard
  - [ ] Accounts
  - [ ] Portfolio
  - [ ] Transactions
  - [ ] Reports
  - [ ] Categories
  - [ ] Settings

---

## Optional: Email Setup

Skip this section if you don't use email features.

- [ ] **Create .env.local file**

- [ ] **Get Gmail App Password**
  - URL: https://myaccount.google.com/security

- [ ] **Add credentials to .env.local**
  ```
  GMAIL_USER=your.email@gmail.com
  GMAIL_APP_PASSWORD=your-password-here
  ```

- [ ] **Restart app and test email feature**

---

## Optional: Windows Service Setup

Skip this section if you want to manually start the app each time.

- [ ] **Download NSSM**
  - URL: https://nssm.cc/download

- [ ] **Copy nssm.exe to C:\Windows\System32\**

- [ ] **Run setup script as Administrator**
  ```powershell
  cd C:\Backups\Finance\scripts
  .\setup-service.ps1
  ```

- [ ] **Verify service is running**
  ```powershell
  nssm status FinanceApp
  ```
  - Status: __________

- [ ] **Open Services (services.msc)**
  - Finding "Finance App" → Startup Type: Automatic ✓

- [ ] **Restart computer and verify auto-start**

---

## Final Verification

### Data Integrity Checks

- [ ] **Account count matches**
  - Expected: _____ accounts
  - Actual: _____ accounts

- [ ] **Transaction count matches**
  - Expected: _____ transactions
  - Actual: _____ transactions

- [ ] **Portfolio positions match**
  - Expected: _____ positions
  - Actual: _____ positions

- [ ] **Net worth history present**
  - Total snapshots: _____
  - Date range: __________ to __________

### Functionality Tests

- [ ] **Add a test transaction**
  - Account gets updated immediately: □ Yes  □ No

- [ ] **Upload a CSV file**
  - Import works: □ Yes  □ No

- [ ] **Check Settings → Automatic Price Updates**
  - Status: □ Active  □ Starting  □ Stopped

- [ ] **Check Settings → Net Worth Tracking**
  - Snapshot count: _____

- [ ] **Dark mode toggle works**

- [ ] **All navigation links work**

---

## Cleanup (On OLD System)

⚠️ Only do this AFTER verifying everything works on the new system!

- [ ] **Keep backup of data folder**
  - Don't delete the old system until you've used the new one for a week

- [ ] **Stop the service on old system (if applicable)**
  ```powershell
  nssm stop FinanceApp
  ```

---

## Post-Migration Tasks

- [ ] **Bookmark http://localhost:3000**

- [ ] **Create desktop shortcut** (optional)

- [ ] **Set up data backup schedule**
  - Plan: __________________________________

- [ ] **Document any customizations**

- [ ] **Update this checklist with notes**

---

## Troubleshooting Notes

Use this space to document any issues and solutions:

**Issue #1:**
_______________________________________________________________
_______________________________________________________________

**Solution:**
_______________________________________________________________
_______________________________________________________________

**Issue #2:**
_______________________________________________________________
_______________________________________________________________

**Solution:**
_______________________________________________________________
_______________________________________________________________

---

## Success Criteria

✅ **Migration is complete when:**

- [ ] App opens at http://localhost:3000
- [ ] All financial data is present and accurate
- [ ] All pages load without errors
- [ ] Can add/edit transactions
- [ ] Background services are active
- [ ] (Optional) Windows service runs on startup
- [ ] (Optional) Email features work

---

**Migration Started**: _____________ at _______  
**Migration Completed**: _____________ at _______  
**Total Time**: _______ hours/minutes  

**Migrated By**: _____________________  
**Notes**: ___________________________________________
_____________________________________________________
_____________________________________________________

---

**Keep this checklist for your records!**
