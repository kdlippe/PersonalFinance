# Data Directory Structure

This directory contains all application data in separate JSON files for better organization and maintainability.

## Files

### Core Data Files

- **accounts.json** - Financial accounts (checking, savings, brokerage, retirement, etc.)
  - Contains: account list and next ID counter
  
- **positions.json** - Investment positions/holdings
  - Contains: stock/fund positions and next ID counter
  
- **categories.json** - Transaction categories
  - Contains: income/expense categories and next ID counter

### Historical Data

- **net-worth-history.json** - Net worth snapshots over time
  - Contains: historical net worth data points
  - Managed separately via `/api/net-worth-history`

### Transaction Data

- **transactions/** - Directory containing transaction files
  - Each account has its own file: `account-{id}.json`
  - Example: `account-1.json`, `account-5.json`
  - Transactions are kept separate for better performance

### Import Files

- **nwot.csv** - Net worth over time CSV import file
- **NET-WORTH-TRACKING.md** - Documentation for net worth tracking

### Backups

- **finance.json.backup** - Backup of the original unified data file
  - Created during migration to split file structure
  - Can be used for recovery if needed

## Data Architecture

The application uses a split-file architecture where each data type is stored in its own file:

1. **accounts.json** - Account information
2. **positions.json** - Investment positions  
3. **categories.json** - Transaction categories
4. **transactions/account-{id}.json** - Transactions for each account
5. **net-worth-history.json** - Historical snapshots

This structure provides:
- Better organization and clarity
- Improved performance (load only what you need)
- Reduced risk of data corruption
- Easier backups and management
- Clear separation of concerns

## Migration History

- **April 12, 2026** - Split `finance.json` into separate files for accounts, positions, and categories
