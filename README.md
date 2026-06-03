# Personal Finance Manager

A comprehensive web-based personal finance application built with Next.js, React, and TypeScript. Track your bank accounts, investments, credit cards, and spending all in one place.

## 📚 View Documentation

**Want to browse the full documentation in your browser?**

```powershell
npm run docs
```

Then open: **http://localhost:[PORT]**

You'll get a searchable documentation website with:
- 🔍 Full-text search across all docs
- 📱 Mobile-friendly interface
- 🎨 Beautiful sidebar navigation
- 📋 Copy code buttons
- 🔗 Quick links to all guides

**Documentation includes:**
- [Quick Start Guide](docs/reference/quick-start.md)
- [Migration Guide](docs/setup/migration-guide.md) (moving to a new computer)
- [Import Guide](docs/usage/import-guide.md) (CSV imports)
- [Complete Documentation Index](docs/INDEX.md)

---

## Features

### Current Features
- ✅ **Account Management**: Track multiple accounts (checking, savings, credit cards, brokerage, investments, loans)
- ✅ **Transaction Tracking**: Record income, expenses, and transfers
- ✅ **CSV Import**: Upload bank CSV files to automatically import transactions
- ✅ **Duplicate Detection**: Automatically skip duplicate transactions when importing
- ✅ **Auto-Categorization**: Smart categorization of imported transactions
- ✅ **Dashboard**: Visual overview of your financial health with charts
- ✅ **Categories**: Organize transactions with pre-defined categories
- ✅ **Real-time Balance Updates**: Automatic balance calculation as you add transactions
- ✅ **JSON Database**: Local, file-based database for complete privacy
- ✅ **Responsive Design**: Works on desktop, tablet, and mobile

### Planned Features
- 🔄 **Enhanced Bank Integration**: Support for more bank CSV formats
- 🔄 **Advanced Auto-categorization**: ML-powered transaction categorization with learning
- 🔄 **Budget Tracking**: Set and monitor budgets by category
- 🔄 **Investment Tracking**: Track stock positions and portfolio performance
- 🔄 **Reports & Analytics**: Detailed spending reports and trends
- 🔄 **Bill Reminders**: Never miss a payment
- 🔄 **Multi-currency Support**: Track accounts in different currencies
- 🔄 **Recurring Transactions**: Set up automatic recurring entries

## Technology Stack

- **Frontend**: React 18 with Next.js 14 (App Router)
- **Language**: TypeScript for type safety
- **Database**: JSON file storage (simple, portable, zero dependencies!)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (version 18 or later) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager (comes with Node.js)

**Note**: This app uses simple JSON file storage - absolutely ZERO dependencies beyond Node.js and npm!

## Installation & Setup

### 1. Install Dependencies

Open PowerShell or Command Prompt, navigate to this folder, and run:

```powershell
npm install
```

This will install all required packages.

### 2. Initialize the Database

The database will be created automatically when you first start the app. It will be stored in the `data/` folder.

### 3. Start the Development Server

**Finance Application:**
```powershell
npm run dev
```

The application will start on `http://localhost:3000`

**Documentation Website:** (Optional)
```powershell
npm run docs
```

The documentation will be available at `http://localhost:3000` (or use `-p 3001` for a different port)

### 4. Access the Application

**Finance App:**
Open your web browser and navigate to:
```
http://localhost:3000
```

**Documentation:**
If running the docs server, navigate to the same URL (or your custom port)

## Usage Guide

### Adding Your First Account

1. Click "Accounts" in the navigation menu
2. Click "Add Account" button
3. Fill in the account details:
   - **Name**: e.g., "Chase Checking"
   - **Type**: Select the account type
   - **Initial Balance**: Current account balance
   - **Institution**: Bank name (optional)
   - **Account Number**: Last 4 digits (optional)
4. Click "Add Account"

### Adding Transactions

1. Click "Transactions" in the navigation menu
2. Click "Add Transaction" button
3. Fill in the transaction details:
   - **Account**: Select which account
   - **Type**: Income, Expense, or Transfer
   - **Category**: Select from pre-defined categories
   - **Amount**: Transaction amount
   - **Date**: When it occurred
   - **Description**: Brief description
   - **Merchant**: Where you spent (optional)
   - **Notes**: Additional

### Importing Transactions from CSV

1. Click "Import" in the navigation menu
2. Select the account you want to import to
3. Click "Choose File" and select your bank's CSV export
4. Click "Import Transactions"
5. The system will automatically:
   - Parse all transactions
   - Skip duplicates
   - Categorize based on merchant names
   - Update account balances

**For one-time bulk import**, you can also use the command line:
```powershell
npm run import-csv
```

See [Import Guide](docs/usage/import-guide.md) for detailed instructions. details (optional)
4. Click "Add Transaction"

### Dashboard Overview

The dashboard shows:
- **Total Assets**: Sum of all checking, savings, and investment accounts
- **Total Liabilities**: Sum of credit cards and loans
- **Net Worth**: Assets minus liabilities
- **Account Distribution**: Pie chart showing balance by account type
- **Recent Transactions**: Last 10 transactions across all accounts

## Project Structure

```
Finance/
├── app/                      # Next.js app directory
│   ├── api/                 # API routes
│   │   ├── accounts/       # Account CRUD operations
│   │   ├── transactions/   # Transaction CRUD operations
│   │   ├── import/         # CSV import endpoint
│   │   ├── positions/      # Investment positions
│   │   └── categories/     # Category management
│   ├── accounts/           # Accounts page
│   ├── transactions/       # Transactions page
│   ├── import/             # CSV upload page
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Dashboard page
│   └── globals.css         # Global styles
├── components/              # React components
│   ├── Navigation.tsx      # Main navigation
│   ├── AccountCard.tsx     # Account display card
│   ├── TransactionList.tsx # Transaction table
│   ├── CsvUpload.tsx       # CSV upload component
│   └── ...                 # Other components
├── scripts/                 # Utility scripts
│   └── import-csv.ts       # Bulk CSV import script
├── lib/                     # Utility libraries
│   ├── db.ts               # Database initialization
│   └── types.ts            # TypeScript type definitions
├── data/                    # Database storage (auto-created)
│   └── finance.json        # JSON database file
├── uploads/                 # CSV files for import
├── package.json            # Project dependencies
└── tsconfig.json           # TypeScript configuration
```

## Database Schema

The JSON database contains the following collections:

### Accounts
- id, name, type, balance, currency, institution, accountNumber, createdAt, updatedAt

### Transactions
- id, accountId, date, amount, type, category, description, merchant, tags, notes, isReconciled, createdAt

### Positions (for stocks)
- id, accountId, symbol, shares, averageCost, currentPrice, updatedAt

### Categories
- id, name, type, parent, color

## Development Commands

```powershell
# Start development server (Finance App)
npm run dev

# Start documentation server
npm run docs

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

## Backup Your Data

Your financial data is stored in `data/finance.json`. To backup:

1. Copy the `data/` folder to a safe location
2. Consider using cloud storage or external drives
3. Set up regular automated backups
4. The JSON file is human-readable and easy to import/export

## Privacy & Security

- **Local-first**: All data is stored locally on your computer
- **JSON storage**: Simple, human-readable file format
- **Easy backup**: Just copy the JSON file
- **Future**: We'll add encryption and optional cloud backup
- **Future**: We'll add encryption and cloud backup options

## Troubleshooting

### Port 3000 is already in use
If you see an error about port 3000, either:
- Stop other apps using port 3000, or
- Run `npm run dev -- -p 3001` to use a different port

### Database errors
If Backup `data/finance.json` if it exists
3. Delete the `data/` folder
4. Restart the server (a new database will be 
2. Delete the `data/` folder
3. Restart the server (database will be recreated)

### Package installation errors
Try:
```powershell
# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install
```

## Future Development Roadmap

### Phase 1: Bank Integration
- Connect to banks via Plaid or similar API
- Auto-import transactions
- Reconciliation tools

### Phase 2: Smart Categorization
- Machine learning categorization
- Custom rules engine
- Merchant recognition

### Phase 3: Advanced Analytics
- Spending trends over time
- Budget vs. actual comparisons
- Tax category reporting
- Investment performance tracking

### Phase 4: Multi-user & Cloud Sync
- User authentication
- Cloud database option
- Mobile apps (React Native)

## Documentation

Comprehensive documentation is available in the `docs/` folder:

### 📚 Quick Links

| Document | Description |
|----------|-------------|
| **[Documentation Index](docs/INDEX.md)** | Complete documentation guide |
| **[Quick Start](docs/reference/quick-start.md)** | Common commands and daily use |
| **[Migration Guide](docs/setup/migration-guide.md)** | Moving the app to a new system |
| **[Import Guide](docs/usage/import-guide.md)** | Importing transactions from CSV |

### 📖 Documentation Structure

```
docs/
├── INDEX.md              - Documentation overview and search guide
├── setup/                - Installation and migration guides
│   ├── migration-guide.md
│   └── migration-checklist.md
├── usage/                - Feature guides and how-tos
│   ├── import-guide.md
│   └── csv-import-setup.md
└── reference/            - Quick reference cards
    └── quick-start.md
```

### 🎯 Common Tasks

- **Moving to a new computer?** → [Migration Guide](docs/setup/migration-guide.md)
- **Importing transactions?** → [Import Guide](docs/usage/import-guide.md)
- **Need a quick command?** → [Quick Start](docs/reference/quick-start.md)
- **Looking for something specific?** → [Documentation Index](docs/INDEX.md)

## Contributing

This is a personal project, but suggestions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit improvements

## License

MIT License - Feel free to use and modify for your own needs.

## Support

For questions or issues:
1. Check the troubleshooting section above
2. Review the code comments
3. Check Next.js documentation: https://nextjs.org/docs

---

**Note**: This app is designed for personal use. Always backup your data regularly!
