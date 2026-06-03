import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Transaction, Account } from '@/lib/types';
import { reloadDatabase, getLocalTimestamp } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';

export async function PATCH(request: Request) {
  try {
    const { transactionIds, updates } = await request.json();

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Transaction IDs required' },
        { status: 400 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Updates required' },
        { status: 400 }
      );
    }

    // Load accounts with error handling
    const accountsPath = path.join(process.cwd(), 'data', 'accounts.json');
    let accounts: Account[] = [];
    let accountsNextId: number = 1;
    
    try {
      const accountsData = JSON.parse(await fs.readFile(accountsPath, 'utf8'));
      
      // Validate that accounts is actually an array
      if (accountsData && Array.isArray(accountsData.accounts)) {
        accounts = accountsData.accounts;
        accountsNextId = accountsData.nextId ?? 1;
      } else {
        logger.error('Bulk update warning: accounts.json is corrupted or missing accounts array', {
          hasData: !!accountsData,
          accountsType: typeof accountsData?.accounts,
          isArray: Array.isArray(accountsData?.accounts)
        });
        
        // Return error if we can't load accounts
        return NextResponse.json(
          { error: 'Failed to load accounts data - file may be corrupted' },
          { status: 500 }
        );
      }
    } catch (err) {
      logger.error('Bulk update error: Failed to read or parse accounts.json', err);
      return NextResponse.json(
        { error: 'Failed to load accounts data' },
        { status: 500 }
      );
    }

    // Log the bulk update operation
    logger.info(`Bulk update: Updating ${transactionIds.length} transactions across ${accounts.length} accounts`);

    // Track affected accounts for balance recalculation
    const affectedAccountIds = new Set<number>();
    const updatedTransactions: Transaction[] = [];
    // Store the full updated transaction list per affected account (for balance recalc)
    const accountTransactionsMap = new Map<number, Transaction[]>();

    // Update transactions by account
    for (const account of accounts) {
      const transactionPath = path.join(
        process.cwd(),
        'data',
        'transactions',
        `account-${account.id}.json`
      );

      let transactions: Transaction[] = [];
      try {
        transactions = JSON.parse(await fs.readFile(transactionPath, 'utf8'));
      } catch (err) {
        continue;
      }

      let modified = false;

      transactions = transactions.map(t => {
        if (transactionIds.includes(t.id)) {
          // Apply updates (category, type, etc.)
          const updated = { ...t, ...updates };
          
          logger.info(`Updating transaction ${t.id}:`, {
            before: { category: t.category, categoryId: t.categoryId, type: t.type },
            after: { category: updated.category, categoryId: updated.categoryId, type: updated.type },
            updates
          });
          
          affectedAccountIds.add(account.id);
          modified = true;
          updatedTransactions.push(updated);
          
          return updated;
        }
        return t;
      });

      if (modified) {
        await fs.writeFile(transactionPath, JSON.stringify(transactions, null, 2), 'utf8');
        logger.info(`Wrote updated transactions to ${transactionPath}`);
        accountTransactionsMap.set(account.id, transactions);
      }
    }

    // If updates include a type change, recalculate account balances for affected accounts.
    // Skip position-based accounts — their balance comes from position values, not transactions.
    if (updates.type !== undefined && affectedAccountIds.size > 0) {
      const positionsPath = path.join(process.cwd(), 'data', 'positions.json');
      let positionAccountIds = new Set<number>();
      try {
        const positionsData = JSON.parse(await fs.readFile(positionsPath, 'utf8'));
        if (Array.isArray(positionsData.positions)) {
          positionAccountIds = new Set(positionsData.positions.map((p: any) => p.accountId));
        }
      } catch {
        // positions.json missing or unreadable — treat all accounts as non-position-based
      }

      let accountsModified = false;
      for (const accountId of affectedAccountIds) {
        if (positionAccountIds.has(accountId)) continue; // balance from positions, not transactions
        const account = accounts.find(a => a.id === accountId);
        if (!account) continue;
        const txs = accountTransactionsMap.get(accountId) || [];
        const isLiability = account.type === 'credit_card' || account.type === 'loan';
        let balance = 0;
        txs.forEach((t: Transaction) => {
          if (isLiability) {
            if (t.type === 'expense') balance += t.amount;
            else if (t.type === 'income') balance -= t.amount;
            else if (t.type === 'transfer') balance += t.amount;
          } else {
            if (t.type === 'income') balance += t.amount;
            else if (t.type === 'expense') balance -= t.amount;
            else if (t.type === 'transfer') balance += t.amount;
          }
        });
        account.balance = balance;
        account.updatedAt = getLocalTimestamp();
        accountsModified = true;
        logger.info(`Recalculated balance for account ${accountId}: $${balance.toFixed(2)}`);
      }

      if (accountsModified) {
        await fs.writeFile(
          accountsPath,
          JSON.stringify({ accounts, nextId: accountsNextId }, null, 2),
          'utf8'
        );
        logger.info('Wrote updated account balances to accounts.json');
      }
    }

    // Reload the database cache to reflect the changes
    reloadDatabase();

    logger.info(`Bulk update completed: ${updatedTransactions.length} transactions updated across ${affectedAccountIds.size} accounts`);

    return NextResponse.json({
      success: true,
      updated: updatedTransactions.length,
      affectedAccounts: Array.from(affectedAccountIds)
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    logger.error('Bulk update error:', {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name
    });
    
    return NextResponse.json(
      { error: 'Failed to update transactions', details: errorMessage },
      { status: 500 }
    );
  }
}
