import { NextRequest, NextResponse } from 'next/server';
import { reloadDatabase, saveTransactions, saveTransactionsAndAccounts, getLocalTimestamp } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';
import { autoCategorizeTransactions, countAffectedTransactions } from '@/lib/autoCategorize';

export async function POST(request: NextRequest) {
  try {
    const { action, overrideExisting, categoryId } = await request.json();

    const db = reloadDatabase();

    // Filter categories if categoryId is provided
    const categoriesToUse = categoryId 
      ? db.categories.filter(c => c.id === categoryId)
      : db.categories;

    if (action === 'preview') {
      // Preview mode - just count what would be affected
      const result = countAffectedTransactions(
        db.transactions,
        categoriesToUse,
        { overrideExisting }
      );

      return NextResponse.json(result);
    } else if (action === 'apply') {
      // Apply mode - actually categorize transactions
      const originalCount = db.transactions.length;
      
      const result = autoCategorizeTransactions(
        db.transactions,
        categoriesToUse,
        { overrideExisting }
      );

      // CRITICAL: Verify no transactions were lost
      if (result.transactions.length !== originalCount) {
        logger.error(`[auto-categorize] CRITICAL: Transaction count mismatch! Before: ${originalCount}, After: ${result.transactions.length}`);
        return NextResponse.json({ 
          error: 'Auto-categorization failed: transaction count mismatch',
          before: originalCount,
          after: result.transactions.length
        }, { status: 500 });
      }

      // Snapshot old types by transaction ID before overwriting db.transactions.
      // Must be done BEFORE the assignment — after it, db.transactions === result.transactions
      // and the comparison would always be false (same object reference).
      const oldTypeById = new Map(db.transactions.map(t => [t.id, t.type]));

      // Update transactions in database
      db.transactions = result.transactions;

      // If any transaction types changed, recalculate balances for affected accounts.
      // Skip position-based accounts — their balance is derived from position values, not transactions.
      const typeChangedAccountIds = new Set<number>();
      result.transactions.forEach((newTx) => {
        const oldType = oldTypeById.get(newTx.id);
        if (oldType !== undefined && oldType !== newTx.type) {
          typeChangedAccountIds.add(newTx.accountId);
        }
      });

      if (typeChangedAccountIds.size > 0) {
        typeChangedAccountIds.forEach(accountId => {
          const account = db.accounts.find(a => a.id === accountId);
          if (!account) return;
          // Skip position-based accounts — balance comes from position values
          const hasPositions = db.positions.some(p => p.accountId === accountId);
          if (hasPositions) return;
          const isLiability = account.type === 'credit_card' || account.type === 'loan';
          let balance = 0;
          db.transactions
            .filter(t => t.accountId === accountId)
            .forEach(t => {
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
        });
        saveTransactionsAndAccounts();
      } else {
        // No type changes — only category/categoryId changed, balances unaffected
        saveTransactions();
      }

      return NextResponse.json({
        success: true,
        total: result.changed,
        byCategory: result.byCategory,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "preview" or "apply"' },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Error in auto-categorization:', error);
    return NextResponse.json(
      { error: 'Failed to auto-categorize transactions' },
      { status: 500 }
    );
  }
}
