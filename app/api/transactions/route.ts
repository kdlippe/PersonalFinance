import { NextRequest, NextResponse } from 'next/server';
import { reloadDatabase, saveDb, saveTransactionsAndAccounts, getLocalTimestamp } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';
import { Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const db = reloadDatabase();
    let transactions = [...db.transactions];
    
    if (accountId) {
      const accountIdNum = parseInt(accountId);
      transactions = transactions.filter(t => t.accountId === accountIdNum);
    }

    // Sort by date DESC, then by createdAt DESC
    transactions.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Limit results
    transactions = transactions.slice(0, limit);
    
    return NextResponse.json(transactions);
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      accountId, 
      date, 
      amount, 
      type, 
      category,
      categoryId, 
      description, 
      merchant,
      tags,
      notes 
    } = body;

    if (!accountId || !date || amount === undefined || !type || !category || !description) {
      return NextResponse.json({ 
        error: 'accountId, date, amount, type, category, and description are required' 
      }, { status: 400 });
    }

    const db = reloadDatabase();
    
    const newTransaction: Transaction = {
      id: db.nextId.transactions++,
      accountId,
      date,
      amount,
      type,
      category,
      categoryId,
      description,
      merchant,
      tags,
      notes,
      isReconciled: false,
      createdAt: getLocalTimestamp(),
    };

    db.transactions.push(newTransaction);

    // Update account balance
    const account = db.accounts.find(a => a.id === accountId);
    if (account) {
      const isLiability = account.type === 'credit_card' || account.type === 'loan';
      let balanceChange = 0;
      
      if (isLiability) {
        // For credit cards/loans: expenses add to debt, income/payments reduce debt
        if (type === 'expense') {
          balanceChange = amount;
        } else if (type === 'income') {
          balanceChange = -amount;
        } else if (type === 'transfer') {
          // Transfers are typically payments (negative amount reduces debt)
          balanceChange = amount;
        }
      } else {
        // For assets: income adds, expenses subtract
        if (type === 'income') {
          balanceChange = amount;
        } else if (type === 'expense') {
          balanceChange = -amount;
        } else if (type === 'transfer') {
          balanceChange = amount;
        }
      }
      
      account.balance += balanceChange;
      account.updatedAt = getLocalTimestamp();
    }

    try {
      logger.info(`[POST /api/transactions] Saving transaction ${newTransaction.id}...`);
      saveTransactionsAndAccounts();
      logger.info(`[POST /api/transactions] Successfully created and saved transaction ${newTransaction.id}`);
    } catch (saveError) {
      logger.error('[POST /api/transactions] CRITICAL: Failed to save transaction to disk:', saveError);
      // Remove the transaction from memory since save failed
      const txIndex = db.transactions.findIndex(t => t.id === newTransaction.id);
      if (txIndex >= 0) {
        db.transactions.splice(txIndex, 1);
      }
      return NextResponse.json({ 
        error: 'Failed to save transaction to disk', 
        details: saveError instanceof Error ? saveError.message : 'Unknown error' 
      }, { status: 500 });
    }
    
    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    logger.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id,
      accountId, 
      date, 
      amount, 
      type, 
      category,
      categoryId, 
      description, 
      merchant,
      notes 
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const db = reloadDatabase();
    const transactionIndex = db.transactions.findIndex(t => t.id === id);

    if (transactionIndex === -1) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const oldTransaction = db.transactions[transactionIndex];

    // Reverse old balance change
    const oldAccount = db.accounts.find(a => a.id === oldTransaction.accountId);
    if (oldAccount) {
      const isLiability = oldAccount.type === 'credit_card' || oldAccount.type === 'loan';
      let oldBalanceChange = 0;
      
      if (isLiability) {
        if (oldTransaction.type === 'expense') {
          oldBalanceChange = -oldTransaction.amount;
        } else if (oldTransaction.type === 'income') {
          oldBalanceChange = oldTransaction.amount;
        } else if (oldTransaction.type === 'transfer') {
          oldBalanceChange = -oldTransaction.amount;
        }
      } else {
        if (oldTransaction.type === 'income') {
          oldBalanceChange = -oldTransaction.amount;
        } else if (oldTransaction.type === 'expense') {
          oldBalanceChange = oldTransaction.amount;
        } else if (oldTransaction.type === 'transfer') {
          oldBalanceChange = -oldTransaction.amount;
        }
      }
      
      oldAccount.balance += oldBalanceChange;
      oldAccount.updatedAt = getLocalTimestamp();
    }

    // Update transaction
    db.transactions[transactionIndex] = {
      ...oldTransaction,
      accountId: accountId !== undefined ? accountId : oldTransaction.accountId,
      date: date !== undefined ? date : oldTransaction.date,
      amount: amount !== undefined ? amount : oldTransaction.amount,
      type: type !== undefined ? type : oldTransaction.type,
      category: category !== undefined ? category : oldTransaction.category,
      categoryId: categoryId !== undefined ? categoryId : oldTransaction.categoryId,
      description: description !== undefined ? description : oldTransaction.description,
      merchant: merchant !== undefined ? merchant : oldTransaction.merchant,
      notes: notes !== undefined ? notes : oldTransaction.notes,
    };

    const updatedTransaction = db.transactions[transactionIndex];

    // Apply new balance change
    const newAccount = db.accounts.find(a => a.id === updatedTransaction.accountId);
    if (newAccount) {
      const isLiability = newAccount.type === 'credit_card' || newAccount.type === 'loan';
      let newBalanceChange = 0;
      
      if (isLiability) {
        if (updatedTransaction.type === 'expense') {
          newBalanceChange = updatedTransaction.amount;
        } else if (updatedTransaction.type === 'income') {
          newBalanceChange = -updatedTransaction.amount;
        } else if (updatedTransaction.type === 'transfer') {
          newBalanceChange = updatedTransaction.amount;
        }
      } else {
        if (updatedTransaction.type === 'income') {
          newBalanceChange = updatedTransaction.amount;
        } else if (updatedTransaction.type === 'expense') {
          newBalanceChange = -updatedTransaction.amount;
        } else if (updatedTransaction.type === 'transfer') {
          newBalanceChange = updatedTransaction.amount;
        }
      }
      
      newAccount.balance += newBalanceChange;
      newAccount.updatedAt = getLocalTimestamp();
    }

    try {
      logger.info(`[PUT /api/transactions] Saving updated transaction ${id}...`);
      saveTransactionsAndAccounts();
      logger.info(`[PUT /api/transactions] Successfully updated and saved transaction ${id}`);
    } catch (saveError) {
      logger.error('[PUT /api/transactions] CRITICAL: Failed to save updated transaction to disk:', saveError);
      return NextResponse.json({ 
        error: 'Failed to save transaction update to disk', 
        details: saveError instanceof Error ? saveError.message : 'Unknown error' 
      }, { status: 500 });
    }

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    logger.error('Error updating transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const db = reloadDatabase();
    const transactionIndex = db.transactions.findIndex(t => t.id === id);
    
    if (transactionIndex === -1) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const transaction = db.transactions[transactionIndex];

    // Reverse the balance change
    const account = db.accounts.find(a => a.id === transaction.accountId);
    if (account) {
      // Reverse the balance change (don't use Math.abs)
      const balanceChange = transaction.type === 'expense' ? transaction.amount : 
                           transaction.type === 'income' ? -transaction.amount : 0;
      account.balance += balanceChange;
      account.updatedAt = getLocalTimestamp();
    }

    // Delete the transaction
    db.transactions.splice(transactionIndex, 1);
    
    try {
      logger.info(`[DELETE /api/transactions] Saving after deletion of transaction ${id}...`);
      saveTransactionsAndAccounts();
      logger.info(`[DELETE /api/transactions] Successfully deleted and saved transaction ${id}`);
    } catch (saveError) {
      logger.error('[DELETE /api/transactions] CRITICAL: Failed to save after deletion:', saveError);
      // Re-add the transaction since save failed
      db.transactions.splice(transactionIndex, 0, transaction);
      return NextResponse.json({ 
        error: 'Failed to save transaction deletion to disk', 
        details: saveError instanceof Error ? saveError.message : 'Unknown error' 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting transaction:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
