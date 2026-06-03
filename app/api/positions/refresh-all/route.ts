import { NextResponse } from 'next/server';
import { reloadDatabase, logPriceUpdate, savePositionsAndAccounts, getLocalTimestamp } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    logger.info('[refresh-all] ===== STARTING REFRESH =====');
    
    // Get trigger type from request body (defaults to 'manual')
    const body = await request.json().catch(() => ({}));
    const trigger = body.trigger || 'manual';
    const accountId = Number.isFinite(Number(body.accountId)) ? Number(body.accountId) : null;
    logger.info('[refresh-all] Trigger:', trigger);
    if (accountId !== null) {
      logger.info('[refresh-all] Account scope:', accountId);
    }
    
    // PHASE 1: Load current position list from disk - snapshot what needs fetching.
    // We only read position IDs/symbols here; no writes happen in this phase.
    logger.info('[refresh-all] Phase 1: Loading positions from disk...');
    const snapshot = reloadDatabase();
    logger.info('[refresh-all] Database loaded:', snapshot.positions.length, 'positions,', snapshot.accounts.length, 'accounts');

    if (accountId !== null && !snapshot.accounts.some(a => a.id === accountId)) {
      return NextResponse.json({
        success: false,
        error: `Account ${accountId} not found`
      }, { status: 404 });
    }

    const positionsToFetch = snapshot.positions
      .filter(p =>
        (accountId === null || p.accountId === accountId) &&
        p.assetType && ['stock', 'etf', 'mutual_fund', 'crypto'].includes(p.assetType.toLowerCase()) &&
        !p.manualPriceUpdate
      )
      .map(p => ({ id: p.id, symbol: p.symbol, assetType: p.assetType, quantity: p.quantity }));

    if (positionsToFetch.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No positions to update',
        updated: 0,
        errors: 0
      });
    }

    // PHASE 2: Fetch all prices from Yahoo Finance.
    // Results are stored in a Map — no db access happens in this phase.
    // This means a concurrent reloadDatabase() call from the background service
    // cannot corrupt our results; we're not touching the module-level db pointer.
    logger.info('[refresh-all] Phase 2: Fetching prices for', positionsToFetch.length, 'positions...');

    interface PriceData {
      currentPrice: number;
      currentValue: number;
      dailyChange: number;
      dailyChangeAmount: number;
      priceChange: number;
      updatedAt: string;
    }

    const priceResults = new Map<number, PriceData>();
    let errors = 0;
    const errorDetails: Array<{ symbol: string; error: string }> = [];

    for (const position of positionsToFetch) {
      try {
        let cleanSymbol = position.symbol.replace(/\*+$/, '').trim();

        if (position.assetType === 'crypto' && !cleanSymbol.includes('-')) {
          cleanSymbol = cleanSymbol + '-USD';
        }

        const priceResponse = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSymbol)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (!priceResponse.ok) {
          errors++;
          errorDetails.push({ symbol: position.symbol, error: `HTTP ${priceResponse.status}` });
          continue;
        }

        const data = await priceResponse.json();
        const result = data?.chart?.result?.[0];

        if (!result) {
          errors++;
          errorDetails.push({ symbol: position.symbol, error: 'No data available' });
          continue;
        }

        const meta = result.meta;
        const currentPrice = meta.regularMarketPrice || meta.previousClose;
        const previousClose = meta.chartPreviousClose || meta.previousClose;

        if (!currentPrice) {
          errors++;
          errorDetails.push({ symbol: position.symbol, error: 'Price not available' });
          continue;
        }

        const priceChange = previousClose ? currentPrice - previousClose : 0;
        const dailyChangePercent = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
        const totalDailyChangeAmount = priceChange * position.quantity;

        priceResults.set(position.id, {
          currentPrice,
          currentValue: currentPrice * position.quantity,
          dailyChange: dailyChangePercent,
          dailyChangeAmount: totalDailyChangeAmount,
          priceChange,
          updatedAt: getLocalTimestamp(),
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errors++;
        errorDetails.push({
          symbol: position.symbol,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // PHASE 3: Reload db fresh from disk, then apply all collected results synchronously.
    // There are NO await points between reloadDatabase() and savePositionsAndAccounts(),
    // so the background price service cannot interleave and overwrite our changes.
    logger.info('[refresh-all] Phase 3: Applying', priceResults.size, 'price results to fresh db snapshot...');
    const db = reloadDatabase();

    // Manual refresh is never the 4 AM NAV run, so always zero out daily change
    // for scoped mutual funds upfront (covers skipped/errored positions too).
    for (const position of db.positions) {
      if ((accountId === null || position.accountId === accountId) && position.assetType?.toLowerCase() === 'mutual_fund') {
        position.dailyChange = 0;
        position.dailyChangeAmount = 0;
        position.priceChange = 0;
      }
    }
    logger.info('[refresh-all] Zeroed dailyChange/dailyChangeAmount/priceChange for scoped mutual fund positions');

    let updated = 0;
    for (const [positionId, priceData] of priceResults) {
      const positionIndex = db.positions.findIndex(p => p.id === positionId);
      if (positionIndex >= 0) {
        const isMutualFund = db.positions[positionIndex].assetType?.toLowerCase() === 'mutual_fund';
        db.positions[positionIndex].currentPrice = priceData.currentPrice;
        db.positions[positionIndex].currentValue = priceData.currentValue;
        db.positions[positionIndex].dailyChange = isMutualFund ? 0 : priceData.dailyChange;
        db.positions[positionIndex].dailyChangeAmount = isMutualFund ? 0 : priceData.dailyChangeAmount;
        db.positions[positionIndex].priceChange = isMutualFund ? 0 : priceData.priceChange;
        db.positions[positionIndex].updatedAt = priceData.updatedAt;
        updated++;
      }
    }

    // Update account balances from updated position values
    logger.info('[refresh-all] Updating account balances...');
    const accountsWithPositions = accountId === null
      ? new Set(db.positions.map(p => p.accountId))
      : new Set([accountId]);

    accountsWithPositions.forEach(scopedAccountId => {
      const account = db.accounts.find(a => a.id === scopedAccountId);
      if (account) {
        const accountPositions = db.positions.filter(p => p.accountId === scopedAccountId);
        const totalValue = accountPositions.reduce((sum, p) => sum + p.currentValue, 0);
        account.balance = totalValue;
        account.updatedAt = getLocalTimestamp();
      }
    });

    logger.info('[refresh-all] About to save. DB has', db.positions.length, 'positions');
    savePositionsAndAccounts();

    const duration = Date.now() - startTime;
    
    // Log the price update event (async, don't wait for it)
    setImmediate(() => {
      try {
        logPriceUpdate({
          trigger: trigger as 'manual' | 'automatic' | 'scheduled',
          updated,
          errors,
          duration,
          errorDetails: errors > 0 ? errorDetails : undefined
        });
      } catch (logError) {
        logger.error('Failed to log price update:', logError);
      }
    });

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} positions (${errors} errors)`,
      updated,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined,
      timestamp: getLocalTimestamp(),
      duration
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    logger.error('===== REFRESH ERROR =====');
    logger.error('Error message:', errorMessage);
    logger.error('Error stack:', errorStack);
    logger.error('Error object:', error);
    
    // Log failed update (async)
    setImmediate(() => {
      try {
        logPriceUpdate({
          trigger: 'manual',
          updated: 0,
          errors: 1,
          duration,
          errorDetails: [{
            symbol: 'ALL',
            error: errorMessage
          }]
        });
      } catch (logError) {
        logger.error('Failed to log error:', logError);
      }
    });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to refresh positions',
      details: errorMessage,
      stack: errorStack
    }, { status: 500 });
  }
}
