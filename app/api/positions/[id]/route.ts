import { NextResponse } from 'next/server';
import { reloadDatabase, saveDb, savePositions, saveAccounts, savePositionsAndAccounts, getLocalTimestamp } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const positionId = parseInt(params.id);
    const body = await request.json();
    const db = reloadDatabase();
    
    const position = db.positions.find(p => p.id === positionId);
    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    // Update current value and price
    if (body.currentValue !== undefined) {
      position.currentValue = parseFloat(body.currentValue);
      position.updatedAt = getLocalTimestamp();
      
      // Calculate and store current price based on quantity
      if (body.currentPrice !== undefined) {
        position.currentPrice = parseFloat(body.currentPrice);
      } else if (position.quantity > 0) {
        // Auto-calculate currentPrice from currentValue / quantity
        position.currentPrice = position.currentValue / position.quantity;
      }
      
      // Store daily change data if provided
      if (body.dailyChange !== undefined) {
        position.dailyChange = parseFloat(body.dailyChange);
      }
      if (body.dailyChangeAmount !== undefined) {
        position.dailyChangeAmount = parseFloat(body.dailyChangeAmount);
      }
      if (body.priceChange !== undefined) {
        position.priceChange = parseFloat(body.priceChange);
      }
      
      // Update account balance
      const account = db.accounts.find(a => a.id === position.accountId);
      if (account) {
        const accountPositions = db.positions.filter(p => p.accountId === position.accountId);
        account.balance = accountPositions.reduce((sum, p) => sum + p.currentValue, 0);
        account.updatedAt = getLocalTimestamp();
      }
      
      // Only save positions and accounts, NOT transactions
      savePositionsAndAccounts();
    }

    return NextResponse.json(position);
  } catch (error) {
    logger.error('Error updating position:', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const positionId = parseInt(params.id);
    const body = await request.json();
    const db = reloadDatabase();
    
    logger.info(`[PUT /api/positions/${positionId}] Request body:`, JSON.stringify(body, null, 2));
    
    const position = db.positions.find(p => p.id === positionId);
    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    logger.info(`[PUT /api/positions/${positionId}] Position before update:`, JSON.stringify({
      symbol: position.symbol,
      manualPriceUpdate: position.manualPriceUpdate
    }));

    // Update all fields
    if (body.symbol !== undefined) position.symbol = body.symbol.toUpperCase();
    if (body.description !== undefined) position.description = body.description;
    if (body.quantity !== undefined) position.quantity = parseFloat(body.quantity);
    if (body.costBasis !== undefined) position.costBasis = parseFloat(body.costBasis);
    if (body.currentValue !== undefined) position.currentValue = parseFloat(body.currentValue);
    if (body.assetType !== undefined) position.assetType = body.assetType;
    if (body.manualPriceUpdate !== undefined) {
      logger.info(`[PUT /api/positions/${positionId}] Setting manualPriceUpdate from ${position.manualPriceUpdate} to ${body.manualPriceUpdate}`);
      position.manualPriceUpdate = body.manualPriceUpdate;
    }
    
    // Calculate and store current price
    if (body.currentPrice !== undefined) {
      position.currentPrice = parseFloat(body.currentPrice);
    } else if (position.quantity > 0 && position.currentValue) {
      position.currentPrice = position.currentValue / position.quantity;
    }
    
    position.updatedAt = getLocalTimestamp();
    
    logger.info(`[PUT /api/positions/${positionId}] Position after update:`, JSON.stringify({
      symbol: position.symbol,
      manualPriceUpdate: position.manualPriceUpdate
    }));
    
    // Update account balance
    const account = db.accounts.find(a => a.id === position.accountId);
    if (account) {
      const accountPositions = db.positions.filter(p => p.accountId === position.accountId);
      account.balance = accountPositions.reduce((sum, p) => sum + p.currentValue, 0);
      account.updatedAt = getLocalTimestamp();
    }
    
    logger.info(`[PUT /api/positions/${positionId}] Saving positions and accounts...`);
    // Only save positions and accounts, NOT transactions
    savePositionsAndAccounts();
    logger.info(`[PUT /api/positions/${positionId}] Save completed`);

    return NextResponse.json(position);
  } catch (error) {
    logger.error('Error updating position:', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const positionId = parseInt(params.id);
    const db = reloadDatabase();
    
    const positionIndex = db.positions.findIndex(p => p.id === positionId);
    if (positionIndex === -1) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    const position = db.positions[positionIndex];
    const accountId = position.accountId;
    
    // Remove position from database
    db.positions.splice(positionIndex, 1);
    
    // Update account balance
    const account = db.accounts.find(a => a.id === accountId);
    if (account) {
      const accountPositions = db.positions.filter(p => p.accountId === accountId);
      account.balance = accountPositions.reduce((sum, p) => sum + p.currentValue, 0);
      account.updatedAt = getLocalTimestamp();
    }
    
    // Only save positions and accounts, NOT transactions
    savePositionsAndAccounts();

    return NextResponse.json({ success: true, message: 'Position deleted successfully' });
  } catch (error) {
    logger.error('Error deleting position:', error);
    return NextResponse.json({ error: 'Failed to delete position' }, { status: 500 });
  }
}
