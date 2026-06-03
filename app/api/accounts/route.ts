import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, reloadDatabase, saveDb, deleteAccountTransactions, getLocalTimestamp } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';
import { Account } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use reloadDatabase to ensure fresh data from disk
    const db = reloadDatabase();
    return NextResponse.json(db.accounts);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, balance = 0, currency = 'USD', institution, accountNumber } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    const db = reloadDatabase();
    const now = getLocalTimestamp();
    
    const newAccount: Account = {
      id: db.nextId.accounts++,
      name,
      type,
      balance,
      currency,
      institution,
      accountNumber,
      createdAt: now,
      updatedAt: now,
    };

    db.accounts.push(newAccount);
    saveDb();

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    logger.error('Error creating account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, type, balance, currency, institution, accountNumber } = body;

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const db = reloadDatabase();
    const accountIndex = db.accounts.findIndex(a => a.id === id);

    if (accountIndex === -1) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const account = db.accounts[accountIndex];
    
    if (name !== undefined) account.name = name;
    if (type !== undefined) account.type = type;
    if (balance !== undefined) account.balance = balance;
    if (currency !== undefined) account.currency = currency;
    if (institution !== undefined) account.institution = institution;
    if (accountNumber !== undefined) account.accountNumber = accountNumber;
    account.updatedAt = getLocalTimestamp();

    saveDb();

    return NextResponse.json(account);
  } catch (error) {
    logger.error('Error updating account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const db = reloadDatabase();
    const accountIndex = db.accounts.findIndex(a => a.id === id);

    if (accountIndex === -1) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Also delete related transactions and positions
    db.transactions = db.transactions.filter(t => t.accountId !== id);
    db.positions = db.positions.filter(p => p.accountId !== id);
    db.accounts.splice(accountIndex, 1);
    
    saveDb();
    
    // Delete the account's transaction file
    deleteAccountTransactions(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
