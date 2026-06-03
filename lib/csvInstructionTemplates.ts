export interface InstructionStep {
  text: string;
  details?: string;
}

export interface InstructionTemplate {
  institution: string;
  transactions: {
    steps: InstructionStep[];
    tips?: string[];
    fileFormat: string;
    downloadUrl?: string;
  };
  positions: {
    steps: InstructionStep[];
    tips?: string[];
    fileFormat: string;
    downloadUrl?: string;
  };
}

export const csvInstructionTemplates: Record<string, InstructionTemplate> = {
  fidelity: {
    institution: 'Fidelity',
    transactions: {
      steps: [
        { 
          text: '1. Go to Fidelity.com and log in',
          details: 'Use your Fidelity username and password'
        },
        { 
          text: '2. Select the specific account you want to download from',
          details: 'Click on the account name (e.g., "Rollover IRA" or "Athena Health 401k") from your account list on the main page'
        },
        { 
          text: '3. Click on the "Activity & Orders" tab',
          details: 'This tab is in the horizontal navigation menu below the account name'
        },
        { 
          text: '4. Look in the upper right area and click the download icon',
          details: 'The download icon looks like a down arrow and is located next to the printer icon'
        },
        { 
          text: '5. From the dropdown menu, select "Download as CSV"',
          details: 'Make sure to choose CSV format, not the other options'
        },
        { 
          text: '6. IMPORTANT: Change the date range to "Year to date"',
          details: 'By default it shows "Past 30 days" - click the "Year to date" radio button instead to get all 2026 transactions'
        },
        { 
          text: '7. Click the "Download" button',
          details: 'The CSV file will be saved to your Downloads folder'
        }
      ],
      tips: [
        'The downloaded file will be named something like "History_for_Account_XXXXX.csv"',
        'Always select "Year to date" to get the complete transaction history for 2026',
        'If you need earlier years, select "Custom date range" and set the dates',
        'Make sure you\'re downloading from the correct account - check the account name at the top!',
        'Don\'t worry about downloading the same file multiple times - duplicates are automatically skipped'
      ],
      fileFormat: 'CSV',
      downloadUrl: 'https://www.fidelity.com'
    },
    positions: {
      steps: [
        { 
          text: '1. Go to Fidelity.com and log in',
          details: 'Use your Fidelity username and password'
        },
        { 
          text: '2. Select the specific account you want to download from',
          details: 'Click on the account name (e.g., "Rollover IRA" or "Athena Health 401k") from your account list'
        },
        { 
          text: '3. Click on the "Positions" tab',
          details: 'This tab is in the horizontal navigation menu below the account name'
        },
        { 
          text: '4. Find and click the three dots (•••) menu',
          details: 'Look in the upper right corner of the Positions table for the three-dot menu icon'
        },
        { 
          text: '5. Click "Download" from the menu',
          details: 'This will immediately download the positions as a CSV file'
        },
        { 
          text: '6. Check your Downloads folder',
          details: 'The file will be saved to your Downloads folder'
        }
      ],
      tips: [
        'The file name will be "Portfolio_Positions_[Date].csv" with today\'s date',
        'This file contains ALL your current holdings: stocks, bonds, mutual funds, ETFs',
        'It includes: Symbol, Description, Quantity, Last Price, Current Value, Cost Basis, Gain/Loss',
        'Make sure you\'re downloading from the correct account - check the account name at the top!',
        'The positions file is a snapshot of your holdings as of today'
      ],
      fileFormat: 'CSV',
      downloadUrl: 'https://www.fidelity.com'
    }
  },
  
  vanguard: {
    institution: 'Vanguard',
    transactions: {
      steps: [
        { text: '1. Log in to your Vanguard account at Vanguard.com' },
        { text: '2. Select your account from the account list' },
        { text: '3. Click on "Account details"' },
        { text: '4. Select "Download transactions"' },
        { text: '5. Choose date range and CSV format' },
        { text: '6. Click "Download"' }
      ],
      tips: [
        'Select "All transactions" for the complete history',
        'CSV format is located in the download options'
      ],
      fileFormat: 'CSV',
      downloadUrl: 'https://www.vanguard.com'
    },
    positions: {
      steps: [
        { text: '1. Log in to your Vanguard account' },
        { text: '2. Go to "My Accounts"' },
        { text: '3. Select "Holdings"' },
        { text: '4. Click "Download" or "Export"' },
        { text: '5. Choose CSV format' }
      ],
      tips: ['Ensure all holdings are visible before downloading'],
      fileFormat: 'CSV',
      downloadUrl: 'https://www.vanguard.com'
    }
  },

  chase: {
    institution: 'Chase',
    transactions: {
      steps: [
        { text: '1. Log in to Chase.com' },
        { text: '2. Select your account' },
        { text: '3. Click "Download account activity"' },
        { text: '4. Select date range (recommend "Year to date")' },
        { text: '5. Choose ".CSV" as the file type' },
        { text: '6. Click "Download"' }
      ],
      tips: [
        'You can download up to 18 months of transactions at once',
        'CSV files work best with our import system'
      ],
      fileFormat: 'CSV',
      downloadUrl: 'https://www.chase.com'
    },
    positions: {
      steps: [
        { text: '1. Log in to Chase.com' },
        { text: '2. Navigate to "You Invest" section' },
        { text: '3. Select your investment account' },
        { text: '4. Go to "Holdings" tab' },
        { text: '5. Click "Download" or export button' },
        { text: '6. Select CSV format' }
      ],
      tips: ['Make sure to select CSV format for compatibility'],
      fileFormat: 'CSV',
      downloadUrl: 'https://www.chase.com'
    }
  },

  schwab: {
    institution: 'Charles Schwab',
    transactions: {
      steps: [
        { text: '1. Log in to Schwab.com' },
        { text: '2. Select your account' },
        { text: '3. Go to "History" tab' },
        { text: '4. Click "Export" button' },
        { text: '5. Select date range and CSV format' },
        { text: '6. Click "Export"' }
      ],
      tips: ['You can export up to 24 months of history'],
      fileFormat: 'CSV',
      downloadUrl: 'https://www.schwab.com'
    },
    positions: {
      steps: [
        { text: '1. Log in to Schwab.com' },
        { text: '2. Select your account' },
        { text: '3. Go to "Positions" tab' },
        { text: '4. Click "Export Positions"' },
        { text: '5. Save the CSV file' }
      ],
      tips: ['Export includes current market values and prices'],
      fileFormat: 'CSV',
      downloadUrl: 'https://www.schwab.com'
    }
  },

  default: {
    institution: 'Your Financial Institution',
    transactions: {
      steps: [
        { text: '1. Log in to your financial institution\'s website' },
        { text: '2. Navigate to your account details or transaction history' },
        { text: '3. Look for "Download", "Export", or "Download as CSV" option' },
        { text: '4. Select CSV format (not Excel or PDF)' },
        { text: '5. Choose an appropriate date range (recommend "Year to date")' },
        { text: '6. Download the file to your computer' }
      ],
      tips: [
        'Look for export options in Account Details, Transaction History, or Activity sections',
        'CSV format is required for import - Excel files may not work',
        'Larger date ranges are better - you can import the same file multiple times without creating duplicates'
      ],
      fileFormat: 'CSV'
    },
    positions: {
      steps: [
        { text: '1. Log in to your financial institution\'s website' },
        { text: '2. Navigate to your investment account' },
        { text: '3. Look for "Positions", "Holdings", or "Portfolio" tab' },
        { text: '4. Find the "Download", "Export", or three-dot menu option' },
        { text: '5. Select CSV format' },
        { text: '6. Download the file to your computer' }
      ],
      tips: [
        'Position files usually include Symbol, Quantity, Price, and Value',
        'Make sure to download from the specific account you want to import',
        'CSV format is required for successful import'
      ],
      fileFormat: 'CSV'
    }
  }
};

export function getInstructionTemplate(institutionKey?: string): InstructionTemplate {
  if (!institutionKey) {
    return csvInstructionTemplates.default;
  }
  
  const normalized = institutionKey.toLowerCase().trim();
  return csvInstructionTemplates[normalized] || csvInstructionTemplates.default;
}
