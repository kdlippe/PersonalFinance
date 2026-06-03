import { NextRequest, NextResponse } from 'next/server';
import { reloadDatabase, saveDb, saveNetWorthSnapshot, logImportEvent, getLocalTimestamp } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';
import { 
  parseCsvLine, 
  detectParser, 
  ParsedTransaction, 
  ParsedPosition,
  transactionParsers,
  positionParsers
} from '@/lib/csvParsers';
import { autoCategorizeTransactions } from '@/lib/autoCategorize';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accountId = parseInt(formData.get('accountId') as string);
    const parserName = formData.get('parser') as string | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }
    
    // Read CSV file
    const csvContent = await file.text();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 });
    }
    
    // Check for special CSV formats with metadata rows
    let headerLineIndex = 0;
    let jetBlueBalance: number | null = null;
    
    // Check for JetBlue CSV format (has balance on row 3)
    if (lines[0].includes('Barclays Bank Delaware') || 
        (lines.length > 2 && lines[2].includes('Account Balance as of'))) {
      // JetBlue CSV format detected
      // Find balance line (contains "Account Balance as of")
      for (let i = 0; i < Math.min(6, lines.length); i++) {
        if (lines[i].includes('Account Balance as of')) {
          const balanceMatch = lines[i].match(/\$([0-9,]+\.?\d*)/);
          if (balanceMatch) {
            jetBlueBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
            logger.info(`Extracted JetBlue balance from CSV: $${jetBlueBalance.toFixed(2)}`);
          }
          break;
        }
      }
      // Scan for the actual header row (contains 'Transaction Date')
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const testHeaders = parseCsvLine(lines[i]);
        if (testHeaders.includes('Transaction Date') && testHeaders.includes('Description')) {
          headerLineIndex = i;
          logger.info(`Found JetBlue headers at line ${i + 1}`);
          break;
        }
      }
    }
    // Check for Fidelity Retirement CSV format (has Plan name, Date Range rows)
    else if (lines[0].includes('Plan name:') || lines[1].includes('Date Range')) {
      // Fidelity Retirement format has metadata on first 2-4 rows
      // Look for the header row that contains "Date" and "Investment"
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const testHeaders = parseCsvLine(lines[i]);
        if (testHeaders.includes('Date') && testHeaders.includes('Investment') && testHeaders.includes('Transaction Type')) {
          headerLineIndex = i;
          logger.info(`Found Fidelity Retirement headers at line ${i + 1}`);
          break;
        }
      }
    }
    
    const headers = parseCsvLine(lines[headerLineIndex]);
    
    // Determine parser - either specified by user or auto-detected
    let parser;
    if (parserName) {
      // User specified a parser - find it by name in both transaction and position parsers
      parser = transactionParsers.find(p => p.name === parserName) || 
               positionParsers.find(p => p.name === parserName);
      
      if (!parser) {
        return NextResponse.json({ 
          error: `Parser "${parserName}" not found` 
        }, { status: 400 });
      }
      
      logger.info(`Using manually selected parser: ${parser.name} (${parser.csvType})`);
    } else {
      // Auto-detect parser
      parser = detectParser(headers);
      logger.info(`Auto-detected CSV format: ${parser.name} (${parser.csvType})`);
    }

    // Validate CSV format matches expected parser
    const { validateCsvFormat } = await import('@/lib/csvParsers');
    const validation = validateCsvFormat(headers, parser.name);
    
    if (!validation.isValid) {
      logger.error(`CSV format validation failed for parser ${parser.name}`);
      logger.error(`Missing headers: ${validation.missingHeaders.join(', ')}`);
      
      return NextResponse.json({ 
        error: 'CSV format does not match expected parser format',
        formatMismatch: true,
        validation: {
          csvHeaders: validation.csvHeaders,
          requiredHeaders: validation.requiredHeaders,
          missingHeaders: validation.missingHeaders,
          extraHeaders: validation.extraHeaders,
          parserName: validation.parserName,
          suggestions: validation.suggestions,
        }
      }, { status: 400 });
    }
    
    // All awaits are complete. Reload db fresh from disk immediately before the
    // synchronous processing block. There are no await points between here and
    // saveDb() inside the handlers, so no concurrent request can replace the
    // module-level db pointer and cause imported data to be silently discarded.
    const db = reloadDatabase();
    const account = db.accounts.find(a => a.id === accountId);

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Route to appropriate handler based on CSV type
    if (parser.csvType === 'position') {
      return handlePositionImport(parser, headers, lines, accountId, db, file.name);
    } else {
      return handleTransactionImport(parser, headers, lines, accountId, account, db, file.name, headerLineIndex, jetBlueBalance);
    }
  } catch (error) {
    logger.error('Error uploading CSV:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Detailed error:', errorMessage, error);
    return NextResponse.json({ 
      error: `Failed to upload CSV: ${errorMessage}`,
      details: error instanceof Error ? error.stack : String(error)
    }, { status: 500 });
  }
}

// Helper function to recalculate account balance from positions
function updateAccountBalanceFromPositions(accountId: number, db: any) {
  const account = db.accounts.find((a: any) => a.id === accountId);
  if (!account) return;
  
  const accountPositions = db.positions.filter((p: any) => p.accountId === accountId);
  
  if (accountPositions.length > 0) {
    // Account has positions - calculate total from all position values
    const totalValue = accountPositions.reduce((sum: number, p: any) => sum + p.currentValue, 0);
    account.balance = totalValue;
    account.updatedAt = getLocalTimestamp();
    logger.info(`Recalculated account ${account.name} balance from ${accountPositions.length} positions: $${totalValue.toFixed(2)}`);
  }
}

interface RowResult {
  row: number;
  status: 'success' | 'updated' | 'skipped' | 'error';
  data?: {
    symbol?: string;
    description?: string;
    quantity?: number;
    value?: number;
    amount?: number;
    date?: string;
  };
  reason?: string;
}

function handlePositionImport(parser: any, headers: string[], lines: string[], accountId: number, db: any, fileName: string) {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let totalAccountValue = 0;
  const rowResults: RowResult[] = [];
  
  const account = db.accounts.find((a: any) => a.id === accountId);
  
  // First pass: calculate total account value from ALL positions (including cash)
  const currentValueIdx = headers.indexOf('Current Value');
  logger.info(`Starting position import. Current Value column index: ${currentValueIdx}`);
  logger.info(`Processing ${lines.length - 1} lines (excluding header)`);
  
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCsvLine(lines[i]);
      
      // Skip empty lines or lines with too few columns
      if (values.length < 5) {
        logger.info(`Skipping line ${i}: too few columns (${values.length})`);
        continue;
      }
      
      if (currentValueIdx >= 0 && values.length > currentValueIdx) {
        const currentValueStr = values[currentValueIdx]?.replace(/[$,]/g, '') || '0';
        const currentValue = parseFloat(currentValueStr);
        
        if (!isNaN(currentValue) && currentValue > 0) {
          totalAccountValue += currentValue;
          logger.info(`Line ${i}: Adding $${currentValue.toFixed(2)} (Symbol: ${values[2] || 'unknown'}). Running total: $${totalAccountValue.toFixed(2)}`);
        } else {
          logger.info(`Line ${i}: Skipping invalid value: "${currentValueStr}"`);
        }
      }
    } catch (error) {
      logger.error(`Error processing line ${i} for value calculation:`, error);
      // Continue even if parsing fails for account value calculation
    }
  }
  
  logger.info(`Final total account value: $${totalAccountValue.toFixed(2)}`);
  
  // Second pass: parse and store individual positions (excluding cash)
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCsvLine(lines[i]);
      
      if (values.length < 3) {
        errors++;
        rowResults.push({
          row: i + 1,
          status: 'error',
          reason: 'Too few columns in row'
        });
        continue;
      }
      
      const parsed = parser.parse(headers, values) as ParsedPosition | null;
      
      if (!parsed) {
        skipped++;
        rowResults.push({
          row: i + 1,
          status: 'skipped',
          reason: 'Could not parse row or empty position'
        });
        continue;
      }
      
      // Check if position already exists for this account and symbol
      const existingIdx = db.positions.findIndex((p: any) => 
        p.accountId === accountId && p.symbol === parsed.symbol
      );
      
      if (existingIdx >= 0) {
        // Update existing position
        db.positions[existingIdx] = {
          ...db.positions[existingIdx],
          quantity: parsed.quantity,
          costBasis: parsed.costBasis,
          currentValue: parsed.currentValue,
          currentPrice: parsed.currentPrice,
          dailyChange: parsed.dailyChange,
          dailyChangeAmount: parsed.dailyChangeAmount,
          updatedAt: getLocalTimestamp(),
        };
        updated++;
        rowResults.push({
          row: i + 1,
          status: 'updated',
          data: {
            symbol: parsed.symbol,
            description: parsed.description,
            quantity: parsed.quantity,
            value: parsed.currentValue
          }
        });
      } else {
        // Create new position
        const newPosition = {
          id: db.nextId.positions++,
          accountId: accountId,
          symbol: parsed.symbol,
          assetType: parsed.assetType || 'Stock',
          quantity: parsed.quantity,
          costBasis: parsed.costBasis,
          currentValue: parsed.currentValue,
          currentPrice: parsed.currentPrice,
          dailyChange: parsed.dailyChange,
          dailyChangeAmount: parsed.dailyChangeAmount,
          lastUpdated: getLocalTimestamp(),
          createdAt: getLocalTimestamp(),
          updatedAt: getLocalTimestamp(),
        };
        db.positions.push(newPosition);
        imported++;
        rowResults.push({
          row: i + 1,
          status: 'success',
          data: {
            symbol: parsed.symbol,
            description: parsed.description,
            quantity: parsed.quantity,
            value: parsed.currentValue
          }
        });
      }
    } catch (error) {
      logger.error(`Error processing position line ${i + 1}:`, error);
      errors++;
      rowResults.push({
        row: i + 1,
        status: 'error',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Recalculate account balance from all positions (ensures balance is always accurate)
  updateAccountBalanceFromPositions(accountId, db);
  
  saveDb();
  
  // Save net worth snapshot after position import
  try {
    saveNetWorthSnapshot();
  } catch (snapshotError) {
    logger.error('Error saving net worth snapshot:', snapshotError);
    // Continue even if snapshot fails
  }
  
  // Log import event
  logImportEvent({
    accountId,
    accountName: account?.name || 'Unknown Account',
    fileName,
    csvType: 'position',
    format: parser.name,
    imported,
    updated,
    skipped,
    errors,
    rowResults
  });
  
  return NextResponse.json({
    success: true,
    imported,
    updated,
    skipped,
    errors,
    format: parser.name,
    csvType: 'position',
    message: `Imported ${imported} new positions, updated ${updated} existing positions from ${parser.name} CSV (${skipped} skipped, ${errors} errors)`,
    rowResults,
  });
}

function handleTransactionImport(
  parser: any, 
  headers: string[], 
  lines: string[], 
  accountId: number, 
  account: any, 
  db: any, 
  fileName: string,
  headerLineIndex: number = 0,
  jetBlueBalance: number | null = null
) {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let accountBalance = account.balance;
  let balanceSet = false;
  let mostRecentDate: Date | null = null;
  let mostRecentBalance: number | null = null;
  const rowResults: RowResult[] = [];
  
  // For JetBlue, set balance immediately
  if (jetBlueBalance !== null && parser.name === 'JetBlue Credit Card') {
    accountBalance = jetBlueBalance;
    balanceSet = true;
    logger.info(`Using JetBlue balance from CSV header: $${jetBlueBalance.toFixed(2)}`);
  }
  
  // Parse transactions (skip header)
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    try {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        continue;
      }
      
      const values = parseCsvLine(lines[i]);
      
      if (values.length < 3) {
        errors++;
        rowResults.push({
          row: i + 1,
          status: 'error',
          reason: 'Too few columns in row'
        });
        continue;
      }
      
      // Use the detected parser
      const parsed = parser.parse(headers, values) as ParsedTransaction | null;
      
      if (!parsed) {
        // Don't count as error if it's likely footer/metadata
        // (parser returns null for lines it can't understand)
        continue;
      }
      
      // Set balance from CSV
      // For JDCU (and other CSVs with balance), track the most recent date's balance
      // For others, use the first balance found
      if (parsed.balance !== undefined && !isNaN(parsed.balance)) {
        if (parser.name === 'JDCU Checking') {
          // For JDCU, track balance from most recent date
          const txDate = new Date(parsed.date);
          if (!mostRecentDate || txDate > mostRecentDate) {
            mostRecentDate = txDate;
            mostRecentBalance = parsed.balance;
          }
        } else if (!balanceSet) {
          // For others, use first balance found
          accountBalance = parsed.balance;
          balanceSet = true;
          logger.info(`Setting balance from CSV: $${parsed.balance.toFixed(2)} for line ${i}`);
        }
      }
      
      // Check for duplicates - must match key fields (but NOT type, since that can change after categorization)
      const exists = db.transactions.some((t: any) => 
        t.accountId === accountId &&
        t.date === parsed.date &&
        Math.abs(t.amount - parsed.amount) < 0.01 &&
        t.description === parsed.description
      );
      
      if (exists) {
        skipped++;
        rowResults.push({
          row: i + 1,
          status: 'skipped',
          data: {
            date: parsed.date,
            amount: parsed.amount,
            description: parsed.description
          },
          reason: 'Duplicate transaction'
        });
        continue;
      }
      
      const newTransaction = {
        id: db.nextId.transactions++,
        accountId: accountId,
        date: parsed.date,
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        categoryId: db.categories.find((c: any) => c.name === parsed.category && c.type === parsed.type)?.id,
        description: parsed.description,
        merchant: parsed.merchant || parsed.description,
        tags: parsed.symbol || '',
        notes: parsed.notes || `Imported from ${parser.name} CSV${parsed.symbol ? `. Symbol: ${parsed.symbol}` : ''}${parsed.quantity ? `, Quantity: ${parsed.quantity}` : ''}`,
        isReconciled: false,
        createdAt: getLocalTimestamp(),
      };
      
      db.transactions.push(newTransaction);
      imported++;
      rowResults.push({
        row: i + 1,
        status: 'success',
        data: {
          date: parsed.date,
          amount: parsed.amount,
          description: parsed.description
        }
      });
    } catch (error) {
      logger.error(`Error processing line ${i + 1}:`, error);
      errors++;
      rowResults.push({
        row: i + 1,
        status: 'error',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // For checking, savings, and credit card accounts, never modify the balance during transaction import
  const isBalanceLockedAccount = ['checking', 'savings', 'credit_card'].includes(account.type);

  if (isBalanceLockedAccount) {
    logger.info(`Skipping balance update for ${account.type} account ${account.name} - balance is managed manually`);
  } else if (parser.name === 'JDCU Checking' && mostRecentBalance !== null) {
    account.balance = mostRecentBalance;
    account.updatedAt = getLocalTimestamp();
    logger.info(`Updated JDCU account balance to $${mostRecentBalance.toFixed(2)} from most recent transaction`, mostRecentDate?.toISOString().split('T')[0]);
  } else {
    // Check if account has positions to determine how to handle balance
    const hasPositions = db.positions.some((p: any) => p.accountId === accountId);
    
    if (hasPositions) {
      // Account has positions - recalculate balance from positions (ignore transaction CSV balance)
      updateAccountBalanceFromPositions(accountId, db);
    } else if (!balanceSet) {
      // No balance in CSV - calculate from transactions
      const isLiabilityAccount = ['credit_card', 'loan'].includes(account.type);
      
      let calculatedBalance = 0;
      db.transactions
        .filter((t: any) => t.accountId === accountId)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach((t: any) => {
          if (isLiabilityAccount) {
            if (t.type === 'expense') {
              calculatedBalance += t.amount;
            } else if (t.type === 'income') {
              calculatedBalance -= t.amount;
            } else if (t.type === 'transfer') {
              calculatedBalance += t.amount;
            }
          } else {
            if (t.type === 'income') {
              calculatedBalance += t.amount;
            } else if (t.type === 'expense') {
              calculatedBalance -= t.amount;
            } else if (t.type === 'transfer') {
              calculatedBalance += t.amount;
            }
          }
        });
      
      account.balance = calculatedBalance;
      account.updatedAt = getLocalTimestamp();
      logger.info(`Calculated account ${account.name} balance from ${imported} transactions: $${calculatedBalance.toFixed(2)}`);
    } else {
      // Balance found in CSV - use it
      account.balance = accountBalance;
      account.updatedAt = getLocalTimestamp();
      logger.info(`Updated account ${account.name} balance to $${accountBalance.toFixed(2)} from transaction CSV`);
    }
  }
  
  // Auto-categorize imported transactions (only for this account)
  if (imported > 0) {
    logger.info(`Running auto-categorization on transactions for account ${account.name} (ID: ${accountId})`);
    
    const originalCount = db.transactions.length;
    
    // Get only transactions for this account
    const accountTransactions = db.transactions.filter(t => t.accountId === accountId);
    const otherTransactions = db.transactions.filter(t => t.accountId !== accountId);
    
    // Auto-categorize only this account's transactions
    const categorizationResult = autoCategorizeTransactions(accountTransactions, db.categories);
    
    // Merge back: other account transactions + categorized account transactions
    db.transactions = [...otherTransactions, ...categorizationResult.transactions];
    
    // CRITICAL: Verify no transactions were lost during merge
    if (db.transactions.length !== originalCount) {
      logger.error(`[import] CRITICAL: Transaction count mismatch after categorization! Before: ${originalCount}, After: ${db.transactions.length}`);
      throw new Error(`Transaction merge failed: expected ${originalCount} transactions, got ${db.transactions.length}`);
    }
    
    logger.info(`Auto-categorized ${categorizationResult.changed} transactions for account ${account.name}`);
  }
  
  try {
    saveDb();
    logger.info(`[handleTransactionImport] Successfully saved ${imported} imported transactions for account ${accountId}`);
  } catch (saveError) {
    logger.error('[handleTransactionImport] CRITICAL: Failed to save imported transactions:', saveError);
    throw new Error(`Failed to save imported transactions to disk: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
  }
  
  // Save net worth snapshot after transaction import
  try {
    saveNetWorthSnapshot();
  } catch (snapshotError) {
    logger.error('Error saving net worth snapshot:', snapshotError);
    // Continue even if snapshot fails
  }
  
  // Log import event
  logImportEvent({
    accountId,
    accountName: account.name,
    fileName,
    csvType: 'transaction',
    format: parser.name,
    imported,
    skipped,
    errors,
    rowResults
  });
  
  return NextResponse.json({
    success: true,
    imported,
    skipped,
    errors,
    format: parser.name,
    csvType: 'transaction',
    message: `Imported ${imported} transactions from ${parser.name} CSV (${skipped} duplicates skipped, ${errors} errors)`,
    rowResults,
  });
}