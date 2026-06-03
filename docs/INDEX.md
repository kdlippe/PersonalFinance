# Finance App Documentation

Welcome to the Finance App documentation! This guide will help you find the information you need.

---

## 📚 Documentation Structure

```
docs/
├── INDEX.md (you are here)
├── setup/          - Installation and migration guides
├── usage/          - How to use features
└── reference/      - Quick reference cards
```

---

## 🚀 Getting Started

**New to the app?** Start here:
1. [README.md](../README.md) - Overview of features and tech stack
2. [Quick Start Guide](reference/quick-start.md) - Common commands and daily use

---

## 📖 Documentation by Topic

### Setup & Installation

| Document | Description | Audience |
|----------|-------------|----------|
| [Migration Guide](setup/migration-guide.md) | Complete guide for moving the app to a new Windows system | Anyone migrating to a new PC |
| [Migration Checklist](setup/migration-checklist.md) | Printable step-by-step checklist for migration | Hands-on users who want to track progress |

### Using the App

| Document | Description | Audience |
|----------|-------------|----------|
| [CSV Import Setup](usage/csv-import-setup.md) | Configure CSV parsers for your bank | Users setting up transaction imports |
| [Import Guide](usage/import-guide.md) | How to import transactions and positions | Daily users importing data |

### Quick Reference

| Document | Description | Audience |
|----------|-------------|----------|
| [Quick Start](reference/quick-start.md) | Command cheat sheet and troubleshooting | Daily users needing quick answers |
| [Viewing Docs in Browser](reference/viewing-docs.md) | How to view documentation as a website | Anyone who wants to browse docs in browser |

### Data Documentation

Located in the `data/` folder alongside your financial data:

| Document | Location | Description |
|----------|----------|-------------|
| Data README | [data/README.md](../data/README.md) | Structure of data storage |
| Net Worth Tracking | [data/NET-WORTH-TRACKING.md](../data/NET-WORTH-TRACKING.md) | How net worth snapshots work |
| Transactions README | [data/transactions/README.md](../data/transactions/README.md) | Transaction file structure |

---

## 🎯 Common Tasks

### I want to...

**...move the app to a new computer**
→ Start with [Migration Guide](setup/migration-guide.md)

**...import transactions from my bank**
→ See [Import Guide](usage/import-guide.md) and [CSV Import Setup](usage/csv-import-setup.md)

**...find a command quickly**
→ Use the [Quick Start](reference/quick-start.md) reference card

**...start the app**
```powershell
cd C:\Backups\Finance
npm run dev
```
Then open: http://localhost:3000

**...check if the app is running**
```powershell
nssm status FinanceApp  # If installed as a service
```

**...back up my data**
```powershell
Copy-Item "C:\Backups\Finance\data" -Destination "D:\Backup\Finance-$(Get-Date -Format 'yyyy-MM-dd')" -Recurse
```

**...troubleshoot an issue**
→ See troubleshooting sections in each guide, or check [Quick Start](reference/quick-start.md)

---

## 📋 Documentation Formats

- **Guides** - Step-by-step instructions with explanations
- **Checklists** - Printable task lists to track progress
- **Reference Cards** - Quick lookup for commands and common tasks
- **READMEs** - Technical documentation about data structures

---

## 🔍 Document Search Tips

**Looking for specific topics?**

- **Installation/Setup** → `docs/setup/`
- **Daily Usage** → `docs/usage/`
- **Commands** → `docs/reference/`
- **Data Structure** → `data/*.md`
- **Feature Overview** → `README.md` (root)

**Use your editor's search** (Ctrl+Shift+F in VS Code) to search across all documentation.

---

## 📝 Documentation Maintenance

**Last Updated**: April 14, 2026  
**App Version**: 0.1.0

**Keeping docs current:**
- Update guides when features change
- Add new documents to this index
- Keep file paths consistent with actual structure
- Document breaking changes

---

## 💡 Contributing to Docs

When adding new documentation:

1. Choose the right folder:
   - Setup guides → `docs/setup/`
   - Usage guides → `docs/usage/`
   - Reference cards → `docs/reference/`
   - Data docs → `data/`

2. Use lowercase with dashes for filenames
   - ✅ `migration-guide.md`
   - ❌ `Migration Guide.md`

3. Add entry to this INDEX.md

4. Cross-reference related documents

---

**Need help?** All guides include troubleshooting sections and support information.
