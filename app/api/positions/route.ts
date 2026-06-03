import { NextResponse } from 'next/server';
import { getDatabase, reloadDatabase, saveDb, savePositions, saveAccounts, savePositionsAndAccounts, getLocalTimestamp } from '@/lib/db';
import { Position } from '@/lib/types';
import { apiLogger as logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use reloadDatabase to ensure fresh data from disk
    const db = reloadDatabase();
    
    // Add account names to positions
    const positionsWithAccounts = db.positions.map(position => {
      const account = db.accounts.find(a => a.id === position.accountId);
      return {
        ...position,
        accountName: account?.name || 'Unknown',
      };
    });

    // Sort by account name, then symbol
    positionsWithAccounts.sort((a, b) => {
      const nameCompare = a.accountName.localeCompare(b.accountName);
      if (nameCompare !== 0) return nameCompare;
      return a.symbol.localeCompare(b.symbol);
    });
    
    return NextResponse.json(positionsWithAccounts);
  } catch (error) {
    logger.error('Error fetching positions:', error);
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = reloadDatabase();
    
    // Validate required fields
    if (!body.accountId || !body.symbol || !body.quantity || !body.currentValue) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, symbol, quantity, currentValue' },
        { status: 400 }
      );
    }

    // Create new position
    const newPosition: Position = {
      id: db.nextId.positions++,
      accountId: body.accountId,
      symbol: body.symbol.toUpperCase(),
      description: body.description || body.symbol,
      quantity: parseFloat(body.quantity),
      costBasis: body.costBasis ? parseFloat(body.costBasis) : parseFloat(body.currentValue),
      currentValue: parseFloat(body.currentValue),
      currentPrice: parseFloat(body.quantity) > 0 ? parseFloat(body.currentValue) / parseFloat(body.quantity) : undefined,
      assetType: body.assetType || 'stock',
      manualPriceUpdate: body.manualPriceUpdate || false,
      createdAt: getLocalTimestamp(),
      updatedAt: getLocalTimestamp(),
    };

    // Add to database
    db.positions.push(newPosition);

    // Update account balance to reflect the new position value
    const account = db.accounts.find(a => a.id === body.accountId);
    if (account) {
      const accountPositions = db.positions.filter(p => p.accountId === body.accountId);
      account.balance = accountPositions.reduce((sum, p) => sum + p.currentValue, 0);
      account.updatedAt = getLocalTimestamp();
    }

    // Only save positions and accounts, NOT transactions
    savePositionsAndAccounts();

    return NextResponse.json(newPosition, { status: 201 });
  } catch (error) {
    logger.error('Error creating position:', error);
    return NextResponse.json({ error: 'Failed to create position' }, { status: 500 });
  }
}
