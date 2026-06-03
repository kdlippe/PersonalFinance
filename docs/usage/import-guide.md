# CSV Import Guide

This guide explains how to import transactions from CSV files and how to use the import functionality.

## Importing Your Current CSV (One-Time)

Once Node.js is installed, you can import the `uploads/jdcu.csv` file:

```powershell
# Install dependencies (only needed once)
npm install

# Run the import script
npm run import-csv
```

This script will:
- Create a "JDCU Checking" account automatically if it doesn't exist
- Parse all transactions from the CSV
- Skip any duplicates
- Automatically categorize transactions
- Update your account balance

## Using the Web UI for Future Imports

After the initial setup, you can import CSVs directly from the web interface:

### Step 1: Access the Import Page
1. Open your browser to `http://localhost:3000`
2. Click "Import" in the navigation menu

### Step 2: Upload Your CSV
1. Select the account you want to import to
2. Click "Choose File" and select your CSV
3. Click "Import Transactions"

The system will:
- Automatically detect JDCU format
- Skip duplicate transactions
- Categorize transactions intelligently
- Update balances in real-time

## CSV Format

The import system supports multiple bank and brokerage CSV formats with automatic detection:

### Supported Formats

1. **JDCU (Jeanne D'Arc Credit Union) - Checking/Savings**
   - Transaction ID, Posting Date, Effective Date, Transaction Type, Amount, Description, etc.
   - Automatically detects debit/credit transactions
   
2. **Fidelity Brokerage** 
   - Run Date, Action, Symbol, Description, Amount ($), Cash Balance ($), Quantity, Price ($)
   - Supports buys, sells, dividends, interest, transfers
   - **Use for**: IRAs (Traditional, Roth, Rollover), individual brokerage accounts, taxable investment accounts
   - Example file: `History_for_Account_XXXXX.csv` (with "Run Date" and "Action" columns)
   
3. **Fidelity Credit Card**
   - Date, Name, Memo, Amount
   - Automatically categorizes card transactions
   
4. **JetBlue Credit Card** (Barclays)
   - Transaction Date, Description, Category, Amount, Card Last 4 Digits, Purchased by
   - Balance extracted from row 3 of CSV
   - Automatically handles charges and payments
   
5. **Fidelity Retirement** 
   - Date, Investment, Transaction Type, Shares/Unit, Amount ($)
   - Handles contributions, dividends, realized gain/loss, fees
   - **Use for**: Employer benefit accounts (401k, 403b, 457, etc.)
   - Example file: Similar structure but with "Investment" and "Transaction Type" columns
   
6. **Fidelity Brokerage - Positions**
   - For importing current holdings/positions
   - Symbol, Description, Quantity, Last Price, Current Value, etc.
   
> **📌 Important**: Fidelity IRA accounts (Traditional, Roth, Rollover, SEP) use the **Fidelity Brokerage** format, NOT the Fidelity Retirement format. The "Fidelity Retirement" format is specifically for employer-sponsored benefit accounts like 401k and 403b plans.

The system automatically detects which format your CSV is in and uses the appropriate parser.

### JDCU Format Details (Original Supported Format)
- Transaction ID
- Posting Date (M/D/YYYY format)
- Effective Date
- Transaction Type (Debit/Credit)
- Amount
- Description
- Transaction Category
- Type
- Balance

### Automatic Categorization

The system automatically maps transactions to categories:
- **Income**: Payroll deposits, investment income
- **Utilities**: Electric, phone, internet bills
- **Shopping**: General purchases, Venmo transactions
- **Entertainment**: Educational expenses, activities
- **Transfer**: Account transfers
- **Uncategorized**: Tax payments and unrecognized items

## Manual Adjustments

After importing:
1. Review the transactions in the Transactions page
2. Edit categories as needed
3. Add notes or tags for better organization
4. Delete any unwanted transactions

## Tips

- **Duplicate Prevention**: Don't worry about uploading the same file twice - duplicates are automatically skipped
- **Balance Updates**: Account balances are automatically recalculated after each import
- **Multiple Accounts**: You can import CSVs for different accounts - just select the right account before uploading
- **Regular Imports**: Export and import your bank CSVs weekly or monthly to keep your finances up to date

## Troubleshooting

**File not uploading?**
- Ensure the file is in CSV format
- Check file size (should be under 10MB)
- Verify you selected an account

**Transactions not categorized correctly?**
- Edit them manually after import
- Categories improve as you customize them

**Balance doesn't match?**
- The balance is calculated from imported transactions
- You may need to set an initial balance when creating the account
- Remember: The CSV might not include all historical transactions
