// CSV Parsers for different bank/brokerage formats
// 
// Naming Convention: {institution}{AccountType}Parser
// Examples:
//   - jdcuCheckingParser: Jeanne D'Arc Credit Union Checking/Savings accounts
//   - fidelityBrokerageActivityParser: Fidelity brokerage account transactions
//   - fidelityCreditCardParser: Fidelity credit card transactions
//   - fidelityBrokeragePositionsParser: Fidelity brokerage account positions
//
// Each parser is specific to an institution + account type combination

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  type: 'income' | 'expense' | 'transfer' | 'pending';
  category: string;
  merchant?: string;
  balance?: number;
  notes?: string;
  symbol?: string;
  quantity?: number;
  price?: number;
}

export interface ParsedPosition {
  symbol: string;
  description: string;
  quantity: number;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  lastPrice?: number;
  currentPrice?: number;
  dailyChange?: number;
  dailyChangeAmount?: number;
  assetType?: string;
}

export type ParsedData = ParsedTransaction | ParsedPosition;

export interface CsvParser {
  id: string;
  name: string;
  csvType: 'transaction' | 'position';
  detect: (headers: string[]) => boolean;
  parse: (headers: string[], values: string[]) => ParsedTransaction | ParsedPosition | null;
}

// Helper to parse CSV line with proper quote handling
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // CSV escapes embedded quotes as double quotes (""), not with backslashes.
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

// Helper to parse dates
function parseDate(dateStr: string): string {
  // Try MM/DD/YYYY format - validate all parts are numeric
  const slashParts = dateStr.trim().split('/');
  if (slashParts.length === 3) {
    const [rawMonth, rawDay, rawYear] = slashParts;
    if (/^\d{1,2}$/.test(rawMonth.trim()) && /^\d{1,2}$/.test(rawDay.trim()) && /^\d{4}$/.test(rawYear.trim())) {
      const month = rawMonth.trim().padStart(2, '0');
      const day = rawDay.trim().padStart(2, '0');
      const year = rawYear.trim();
      return `${year}-${month}-${day}`;
    }
  }
  
  // Already in YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date string: "${dateStr}"`);
  }
  return parsed.toISOString().split('T')[0];
}

// NOTE: Smart categorization function no longer used
// All categories are now determined by auto-categorization rules defined in categories.json
// CSV parsers only determine transaction type (income/expense/transfer)
/*
function categorizeTransaction(description: string, csvCategory?: string, symbol?: string): string {
  const desc = description.toLowerCase();
  const cat = (csvCategory || '').toLowerCase();
  
  // Investment transactions
  if (symbol || desc.includes('dividend') || desc.includes('reinvestment')) {
    return 'Investment Income';
  }
  
  if (desc.includes('you bought') || desc.includes('you sold')) {
    return 'Shopping'; // Or create an "Investments" category
  }
  
  // Income
  if (desc.includes('payroll') || desc.includes('salary') || cat === 'income') {
    return 'Salary';
  }
  
  if (desc.includes('direct deposit') || desc.includes('deposit')) {
    return 'Salary';
  }
  
  // Transfers
  if (desc.includes('transfer') || desc.includes('xfer to') || cat === 'transfer') {
    return 'Transfer';
  }
  
  // Bills
  if (cat.includes('bills') || cat.includes('utilities')) {
    return 'Utilities';
  }
  
  if (desc.includes('verizon') || desc.includes('comcast') || desc.includes('ngrid')) {
    return 'Utilities';
  }
  
  // Financial
  if (desc.includes('venmo') || desc.includes('cardmember') || desc.includes('barclaycard')) {
    return 'Shopping';
  }
  
  return 'Uncategorized';
}
*/

// JDCU Checking/Savings CSV Parser
export const JDCUCheckingParser: CsvParser = {
  id: 'jdcu-checking',
  name: 'JDCU Checking',
  csvType: 'transaction',
  detect: (headers: string[]) => {
    return headers.includes('Transaction ID') && 
           headers.includes('Posting Date') && 
           headers.includes('Reference Number');
  },
  parse: (headers: string[], values: string[]) => {
    try {
      const dateIdx = headers.indexOf('Posting Date');
      const amountIdx = headers.indexOf('Amount');
      const descIdx = headers.indexOf('Description');
      const typeIdx = headers.indexOf('Type');
      const categoryIdx = headers.indexOf('Transaction Category');
      const balanceIdx = headers.indexOf('Balance');
      const transTypeIdx = headers.indexOf('Transaction Type');
      
      const date = parseDate(values[dateIdx]);
      let amount = parseFloat(values[amountIdx].replace(/,/g, ''));
      const description = values[descIdx];
      const typeValue = values[typeIdx] || '';
      const categoryValue = values[categoryIdx] || '';
      const balance = balanceIdx >= 0 ? parseFloat(values[balanceIdx].replace(/,/g, '')) : undefined;
      
      // Use sign as-is from CSV: negative = debit/charge (expense), positive = credit/deposit (income/refund)
      
      return {
        date,
        amount: amount,
        description,
        type: 'pending', // Auto-categorization will set correct type
        category: 'Uncategorized', // Auto-categorization rules will assign category
        merchant: description.split('-')[0].trim(),
        balance,
      };
    } catch (error) {
      console.error('Error parsing JDCU transaction:', error);
      return null;
    }
  }
};

// Fidelity Brokerage Activity CSV Parser
export const FidelityBrokerageActivityParser: CsvParser = {
  id: 'fidelity-brokerage',
  name: 'Fidelity Brokerage',
  csvType: 'transaction',
  detect: (headers: string[]) => {
    return headers.includes('Run Date') && 
           headers.includes('Action') && 
           headers.includes('Cash Balance ($)');
  },
  parse: (headers: string[], values: string[]) => {
    try {
      const dateIdx = headers.indexOf('Run Date');
      const actionIdx = headers.indexOf('Action');
      const symbolIdx = headers.indexOf('Symbol');
      const descIdx = headers.indexOf('Description');
      const amountIdx = headers.indexOf('Amount ($)');
      const balanceIdx = headers.indexOf('Cash Balance ($)');
      const quantityIdx = headers.indexOf('Quantity');
      const priceIdx = headers.indexOf('Price ($)');
      
      // Skip empty/footer rows (blank date or action)
      if (!values[dateIdx]?.trim() || !values[actionIdx]?.trim()) {
        return null;
      }

      const date = parseDate(values[dateIdx]);
      const action = values[actionIdx];
      const symbol = values[symbolIdx];
      const description = values[descIdx] || 'No Description';
      const amount = parseFloat(values[amountIdx]?.replace(/,/g, '') || '0');
      const balance = balanceIdx >= 0 ? parseFloat(values[balanceIdx]?.replace(/,/g, '') || '0') : undefined;
      const quantity = quantityIdx >= 0 ? parseFloat(values[quantityIdx] || '0') : undefined;
      const price = priceIdx >= 0 ? parseFloat(values[priceIdx] || '0') : undefined;
      
      // Determine transaction type based on action
      // Category will be determined by auto-categorization rules
      let type: 'income' | 'expense' | 'transfer';
      
      if (action.includes('REINVESTMENT')) {
        type = 'transfer';
      } else if (action.includes('YOU BOUGHT')) {
        type = 'transfer';
      } else if (action.includes('YOU SOLD')) {
        type = 'income';
      } else if (action.includes('DIVIDEND') || action.includes('INTEREST')) {
        type = 'income';
      } else if (action.includes('TRANSFER')) {
        type = 'transfer';
      } else if (action.includes('DEPOSIT')) {
        type = 'income';
      } else if (amount > 0) {
        type = 'income';
      } else {
        type = 'expense';
      }
      
      return {
        date,
        amount: amount, // Keep sign to preserve credits/debits
        description: `${action} - ${description}`,
        type: 'pending',
        category: 'Uncategorized', // Auto-categorization rules will assign category
        merchant: description,
        balance,
        symbol,
        quantity,
        price,
      };
    } catch (error) {
      console.error('Error parsing Fidelity transaction:', error);
      return null;
    }
  }
};

// Fidelity Credit Card CSV Parser
export const FidelityCreditCardParser: CsvParser = {
  id: 'fidelity-credit-card',
  name: 'Fidelity Credit Card',
  csvType: 'transaction',
  detect: (headers: string[]) => {
    // Fidelity Visa CSVs typically have Date, Name, Memo, Amount columns
    const hasDate = headers.some(h => h.toLowerCase().includes('date'));
    const hasName = headers.some(h => h.toLowerCase() === 'name');
    const hasMemo = headers.some(h => h.toLowerCase() === 'memo');
    const hasAmount = headers.some(h => h.toLowerCase().includes('amount'));
    
    return hasDate && hasName && hasMemo && hasAmount;
  },
  parse: (headers: string[], values: string[]) => {
    try {
      const dateIdx = headers.findIndex(h => h.toLowerCase().includes('date'));
      const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name');
      const memoIdx = headers.findIndex(h => h.toLowerCase() === 'memo');
      const amountIdx = headers.findIndex(h => h.toLowerCase().includes('amount'));
      
      if (dateIdx < 0 || nameIdx < 0 || amountIdx < 0) {
        return null;
      }
      
      const date = parseDate(values[dateIdx]);
      const name = values[nameIdx] || 'Transaction';
      const memo = memoIdx >= 0 ? values[memoIdx] : undefined;
      const rawAmount = parseFloat(values[amountIdx].replace(/[^0-9.-]/g, ''));
      
      // Use sign as-is from CSV: negative = charge (expense), positive = refund/credit
      const amount = rawAmount;
      
      return {
        date,
        amount,
        description: name,
        type: 'pending',
        category: 'Uncategorized', // Auto-categorization rules will assign category
        merchant: name,
        notes: memo,
      };
    } catch (error) {
      console.error('Error parsing Fidelity Visa transaction:', error);
      return null;
    }
  }
};

// JetBlue Credit Card CSV Parser (Barclays)
export const JetBlueCreditCardParser: CsvParser = {
  id: 'jetblue-credit-card',
  name: 'JetBlue Credit Card',
  csvType: 'transaction',
  detect: (headers: string[]) => {
    // JetBlue CSVs have: Transaction Date, Description, Category, Amount, Card Last 4 Digits, Purchased by
    return headers.includes('Transaction Date') && 
           headers.includes('Description') && 
           headers.includes('Category') &&
           headers.includes('Card Last 4 Digits') &&
           headers.includes('Purchased by');
  },
  parse: (headers: string[], values: string[]) => {
    try {
      const dateIdx = headers.indexOf('Transaction Date');
      const descIdx = headers.indexOf('Description');
      const categoryIdx = headers.indexOf('Category');
      const amountIdx = headers.indexOf('Amount');
      const purchasedByIdx = headers.indexOf('Purchased by');
      
      if (dateIdx < 0 || descIdx < 0 || amountIdx < 0) {
        return null;
      }
      
      const date = parseDate(values[dateIdx]);
      const description = values[descIdx] || 'Transaction';
      const categoryValue = values[categoryIdx] || '';
      const rawAmount = parseFloat(values[amountIdx]?.replace(/[^0-9.-]/g, '') || '0');
      const purchasedBy = purchasedByIdx >= 0 ? values[purchasedByIdx] : '';
      
      // Use sign as-is from CSV: negative = charge (expense), positive = payment/refund
      const amount = rawAmount;
      
      // JetBlue credit card CSV format:
      // - DEBIT category with negative amount = charge (expense)
      // - CREDIT category with positive amount = payment/refund
      let type: 'income' | 'expense' | 'transfer';
      
      if (categoryValue === 'CREDIT') {
        // Payments are transfers, refunds would be negative expenses
        if (description.toLowerCase().includes('payment')) {
          type = 'transfer';
        } else {
          type = 'income'; // Refund/credit
        }
      } else {
        type = 'expense';
      }
      
      // Preserve sign exactly as-is from the CSV
      return {
        date,
        amount,

        description,
        type: 'pending',
        category: 'Uncategorized', // Auto-categorization rules will assign category
        merchant: description,
        notes: purchasedBy ? `Purchased by: ${purchasedBy}` : undefined,
      };
    } catch (error: any) {
      console.error('Error parsing JetBlue Credit Card transaction:', error);
      return null;
    }
  }
};

// Fidelity IRA Parser - Used by all Fidelity-managed IRA accounts
// (Rollover IRA (Kris), Rollover IRA (Katie), Roth IRA (Kris))
export const FidelityIRAParser: CsvParser = {
  id: 'fidelity-ira',
  name: 'Fidelity IRA',
  csvType: 'transaction',
  detect: (headers: string[]) => {
    return headers.includes('Run Date') && 
           headers.includes('Action') && 
           headers.includes('Cash Balance ($)');
  },
  parse: (headers: string[], values: string[]) => {
    return FidelityBrokerageActivityParser.parse(headers, values);
  }
};

// Internal helper parser for 401k format (not exposed in parser list)
const Fidelity401kFormatParser: CsvParser = {
  id: 'fidelity-401k-format',
  name: 'Fidelity 401k Format',
  csvType: 'transaction',
  detect: (headers: string[]) => {
    return headers.includes('Date') && 
           headers.includes('Investment') && 
           headers.includes('Transaction Type') &&
           headers.includes('Shares/Unit') &&
           (headers.includes('Amount ($)') || headers.includes('Amount'));
  },
  parse: (headers: string[], values: string[]) => {
    try {
      const dateIdx = headers.indexOf('Date');
      const investmentIdx = headers.indexOf('Investment');
      const transactionTypeIdx = headers.indexOf('Transaction Type');
      const sharesIdx = headers.indexOf('Shares/Unit');
      let amountIdx = headers.indexOf('Amount ($)');
      if (amountIdx < 0) amountIdx = headers.indexOf('Amount');
      
      if (dateIdx < 0 || transactionTypeIdx < 0 || amountIdx < 0) {
        return null;
      }
      
      const date = parseDate(values[dateIdx]);
      const investment = values[investmentIdx] || 'Unknown Investment';
      const transactionType = values[transactionTypeIdx] || '';
      const shares = parseFloat(values[sharesIdx]?.replace(/,/g, '') || '0');
      
      const amountStr = values[amountIdx] || '0';
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
      
      const description = shares !== 0 
        ? `${transactionType} - ${investment} (${shares.toFixed(3)} shares)`
        : `${transactionType} - ${investment}`;
      
      return {
        date,
        amount,
        description,
        type: 'pending',
        category: 'Uncategorized',
        merchant: investment,
        symbol: investment,
        quantity: shares,
      };
    } catch (error: any) {
      console.error('Error parsing Fidelity 401k transaction:', error);
      return null;
    }
  }
};

// Fidelity 401k Parser - Used by all Fidelity-managed 401k accounts
// (Yahoo 401k, Microsoft 401k, Athena Health 401k)
export const Fidelity401kParser: CsvParser = {
  id: 'fidelity-401k',
  name: 'Fidelity 401k',
  csvType: 'transaction',
  detect: (headers: string[]) => {
    return headers.includes('Date') && 
           headers.includes('Investment') && 
           headers.includes('Transaction Type') &&
           headers.includes('Shares/Unit') &&
           (headers.includes('Amount ($)') || headers.includes('Amount'));
  },
  parse: (headers: string[], values: string[]) => {
    return Fidelity401kFormatParser.parse(headers, values);
  }
};

// Fidelity Positions CSV Parser
// Used for: Personal Brokerage, Amazon Brokerage, Microsoft Brokerage, Fidelity HSA,
//           Rollover IRA (Kris), Rollover IRA (Katie), Roth IRA (Kris),
//           Yahoo 401k, Microsoft 401k (Kris)
export const FidelityPositionsParser: CsvParser = {
  id: 'fidelity-positions',
  name: 'Fidelity Positions',
  csvType: 'position',
  detect: (headers: string[]) => {
    const hasHeader = (headerName: string) =>
      headers.some(h => h.trim().toLowerCase() === headerName.toLowerCase());

    // Fidelity positions CSV has these key columns
    return hasHeader('Account Number') &&
           hasHeader('Symbol') &&
           hasHeader('Description') &&
           hasHeader('Quantity') &&
           hasHeader('Current Value') &&
           hasHeader('Cost Basis Total');
  },
  parse: (headers: string[], values: string[]): ParsedPosition | null => {
    try {
      const getHeaderIndex = (headerName: string): number =>
        headers.findIndex(h => h.trim().toLowerCase() === headerName.toLowerCase());

      const symbolIdx = getHeaderIndex('Symbol');
      const descIdx = getHeaderIndex('Description');
      const quantityIdx = getHeaderIndex('Quantity');
      const currentValueIdx = getHeaderIndex('Current Value');
      const costBasisIdx = getHeaderIndex('Cost Basis Total');
      const lastPriceIdx = getHeaderIndex('Last Price');
      const lastPriceChangeIdx = getHeaderIndex('Last Price Change');
      const gainLossDollarIdx = getHeaderIndex('Total Gain/Loss Dollar');
      const gainLossPercentIdx = getHeaderIndex('Total Gain/Loss Percent');
      const typeIdx = getHeaderIndex('Type');

      const symbol = values[symbolIdx]?.trim();
      const description = values[descIdx]?.trim();

      // Skip rows without a symbol (like cash balances or pending activity)
      if (!symbol || symbol === '' || symbol === 'Pending activity') {
        return null;
      }

      // Parse numeric values
      const parseNumeric = (str: string): number => {
        if (!str || str === '' || str === '--') return 0;
        // Remove $ and +/- signs, commas
        const cleaned = str.replace(/[\$,+]/g, '');
        return parseFloat(cleaned) || 0;
      };

      const parsePercent = (str: string): number => {
        if (!str || str === '' || str === '--') return 0;
        // Remove % and +/- signs
        const cleaned = str.replace(/[%+]/g, '');
        return parseFloat(cleaned) || 0;
      };

      const quantity = parseNumeric(values[quantityIdx]);
      const currentValue = parseNumeric(values[currentValueIdx]);
      const costBasis = parseNumeric(values[costBasisIdx]);
      const lastPrice = lastPriceIdx >= 0 ? parseNumeric(values[lastPriceIdx]) : undefined;
      const lastPriceChange = lastPriceChangeIdx >= 0 ? parseNumeric(values[lastPriceChangeIdx]) : undefined;
      const gainLossDollar = gainLossDollarIdx >= 0 ? parseNumeric(values[gainLossDollarIdx]) : 0;
      const gainLossPercent = gainLossPercentIdx >= 0 ? parsePercent(values[gainLossPercentIdx]) : 0;
      const assetType = typeIdx >= 0 ? values[typeIdx]?.trim() : undefined;

      return {
        symbol,
        description: description || symbol,
        quantity,
        costBasis,
        currentValue,
        gainLoss: gainLossDollar,
        gainLossPercent,
        lastPrice,
        currentPrice: lastPrice,
        dailyChange: lastPriceChange,
        assetType,
      };
    } catch (error) {
      console.error('Error parsing Fidelity position:', error);
      return null;
    }
  }
};

// Transaction Parsers
export const transactionParsers: CsvParser[] = [
  JDCUCheckingParser,              // Jeanne D'Arc Credit Union - Checking/Savings
  FidelityBrokerageActivityParser, // Fidelity - Brokerage Activity
  FidelityCreditCardParser,        // Fidelity - Credit Card (Visa)
  JetBlueCreditCardParser,         // JetBlue - Credit Card (Barclays)
  FidelityIRAParser,               // Fidelity IRA (Rollover IRA, Roth IRA)
  Fidelity401kParser,              // Fidelity 401k (Yahoo, Microsoft, Athena Health)
];

// Position Parsers
export const positionParsers: CsvParser[] = [
  FidelityPositionsParser,         // Fidelity - Positions (Brokerage, IRAs, 401k, HSA)
];

export function detectTransactionParser(headers: string[]): CsvParser {
  for (const parser of transactionParsers) {
    if (parser.detect(headers)) {
      return parser;
    }
  }
  // No parser matched - return the first one as fallback
  // Each account should have a specific parser assigned anyway
  return transactionParsers[0];
}

export function detectPositionParser(headers: string[]): CsvParser | null {
  for (const parser of positionParsers) {
    if (parser.detect(headers)) {
      return parser;
    }
  }
  return null;
}

export function detectParser(headers: string[]): CsvParser {
  // Try position parsers first
  const positionParser = detectPositionParser(headers);
  if (positionParser) {
    return positionParser;
  }
  
  // Fall back to transaction parsers
  return detectTransactionParser(headers);
}

// Helper to get required headers for a parser
export function getRequiredHeaders(parserName: string): string[] {
  const parser = transactionParsers.find(p => p.name === parserName) || 
                 positionParsers.find(p => p.name === parserName);
  if (!parser) return [];

  // Define required headers for each parser
  const requiredHeadersMap: Record<string, string[]> = {
    'JDCU Checking': ['Transaction ID', 'Posting Date', 'Amount', 'Description', 'Reference Number'],
    'Fidelity Brokerage': ['Run Date', 'Action', 'Cash Balance ($)'],
    'Fidelity Credit Card': ['Date', 'Name', 'Memo', 'Amount'],
    'JetBlue Credit Card': ['Transaction Date', 'Description', 'Category', 'Amount', 'Card Last 4 Digits', 'Purchased by'],
    'Fidelity IRA': ['Run Date', 'Action', 'Cash Balance ($)'],
    'Fidelity 401k': ['Date', 'Investment', 'Transaction Type', 'Shares/Unit', 'Amount ($)'],
    'Fidelity Positions': ['Account Number', 'Symbol', 'Description', 'Quantity', 'Current Value', 'Cost Basis Total'],
  };

  return requiredHeadersMap[parserName] || [];
}

// Validate if CSV headers match the expected parser format
export interface CsvValidationResult {
  isValid: boolean;
  csvHeaders: string[];
  requiredHeaders: string[];
  missingHeaders: string[];
  extraHeaders: string[];
  parserName: string;
  suggestions?: string[];
}

export function validateCsvFormat(headers: string[], parserName: string): CsvValidationResult {
  const requiredHeaders = getRequiredHeaders(parserName);
  
  if (requiredHeaders.length === 0) {
    return {
      isValid: true,
      csvHeaders: headers,
      requiredHeaders: [],
      missingHeaders: [],
      extraHeaders: [],
      parserName,
    };
  }

  // Check for missing headers (case-insensitive)
  const missingHeaders: string[] = [];
  for (const required of requiredHeaders) {
    const found = headers.some(h => h.toLowerCase() === required.toLowerCase());
    if (!found) {
      missingHeaders.push(required);
    }
  }

  // Find extra headers
  const extraHeaders = headers.filter(h => {
    return !requiredHeaders.some(req => req.toLowerCase() === h.toLowerCase());
  });

  const isValid = missingHeaders.length === 0;

  // Generate suggestions if validation failed
  let suggestions: string[] = [];
  if (!isValid) {
    // Find parsers that match the actual headers (check both transaction and position parsers)
    const allParsers = [...transactionParsers, ...positionParsers];
    const matchingParsers = allParsers.filter(parser => {
      return parser.detect(headers);
    });

    if (matchingParsers.length > 0) {
      suggestions = matchingParsers.map(p => p.name);
    }
  }

  return {
    isValid,
    csvHeaders: headers,
    requiredHeaders,
    missingHeaders,
    extraHeaders,
    parserName,
    suggestions,
  };
}
