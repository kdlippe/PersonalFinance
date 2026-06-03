// Background Price Update Service
// This service runs automatically when the app starts and updates prices on schedule

import { reloadDatabase, saveDb, logPriceUpdate, savePositions, saveAccounts, savePositionsAndAccounts, getLocalTimestamp } from './db';
import { priceUpdateLogger as logger } from './logger';

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let lastUpdateTime: Date | null = null;

// Schedule configuration - Every 30 minutes during market hours
const SCHEDULE = [
  { hour: 4, minute: 0 },   // 4:00 AM - Pre-market
  { hour: 9, minute: 30 },  // 9:30 AM - Market open
  { hour: 10, minute: 0 },  // 10:00 AM
  { hour: 10, minute: 30 }, // 10:30 AM
  { hour: 11, minute: 0 },  // 11:00 AM
  { hour: 11, minute: 30 }, // 11:30 AM
  { hour: 12, minute: 0 },  // 12:00 PM
  { hour: 12, minute: 30 }, // 12:30 PM
  { hour: 13, minute: 0 },  // 1:00 PM
  { hour: 13, minute: 30 }, // 1:30 PM
  { hour: 14, minute: 0 },  // 2:00 PM
  { hour: 14, minute: 30 }, // 2:30 PM
  { hour: 15, minute: 0 },  // 3:00 PM
  { hour: 15, minute: 30 }, // 3:30 PM
  { hour: 16, minute: 0 },  // 4:00 PM - Market close
  { hour: 16, minute: 30 }, // 4:30 PM - Post-market
];

interface UpdateResult {
  success: boolean;
  updated: number;
  errors: number;
  duration: number;
  errorDetails?: Array<{ symbol: string; error: string }>;
}

async function updatePrices(is4amRun: boolean): Promise<UpdateResult> {
  const startTime = Date.now();

  // PHASE 1: Load current position list from disk - snapshot what needs fetching.
  // We only read position IDs/symbols here; no writes happen in this phase.
  logger.info('Phase 1: Loading positions from disk...');
  const snapshot = reloadDatabase();

  // Helper to detect CUSIP symbols (9-character alphanumeric identifiers)
  const isCUSIP = (symbol: string): boolean => {
    const cleaned = symbol.replace(/\*+$/, '').trim();
    return /^[0-9]{8}[0-9A-Z]$/.test(cleaned);
  };

  // Get all positions that need price updates (exclude manual-only positions)
  const skippedReasons: Record<string, string[]> = {
    manualUpdate: [],
    noAssetType: [],
    cusip: [],
    unsupportedType: []
  };

  const positionsToFetch = snapshot.positions
    .filter(p => {
      if (p.manualPriceUpdate === true) {
        skippedReasons.manualUpdate.push(p.symbol);
        return false;
      }
      if (!p.assetType) {
        skippedReasons.noAssetType.push(p.symbol);
        return false;
      }
      if (isCUSIP(p.symbol)) {
        skippedReasons.cusip.push(p.symbol);
        return false;
      }
      const isSupported = ['stock', 'etf', 'mutual_fund', 'crypto'].includes(p.assetType.toLowerCase());
      if (!isSupported) {
        skippedReasons.unsupportedType.push(p.symbol);
      }
      return isSupported;
    })
    .map(p => ({ id: p.id, symbol: p.symbol, assetType: p.assetType, quantity: p.quantity }));

  logger.info(`Price update: ${positionsToFetch.length} positions to update, ${snapshot.positions.length - positionsToFetch.length} skipped`);
  if (skippedReasons.manualUpdate.length > 0) {
    logger.info(`  Skipped (manual updates only): ${skippedReasons.manualUpdate.join(', ')}`);
  }
  if (skippedReasons.cusip.length > 0) {
    logger.info(`  Skipped (CUSIP): ${skippedReasons.cusip.join(', ')}`);
  }
  if (skippedReasons.noAssetType.length > 0) {
    logger.info(`  Skipped (no asset type): ${skippedReasons.noAssetType.join(', ')}`);
  }
  if (skippedReasons.unsupportedType.length > 0) {
    logger.info(`  Skipped (unsupported type): ${skippedReasons.unsupportedType.join(', ')}`);
  }

  if (positionsToFetch.length === 0) {
    return { success: true, updated: 0, errors: 0, duration: Date.now() - startTime };
  }

  // PHASE 2: Fetch all prices from Yahoo Finance.
  // Results are stored in a Map — no db access happens in this phase.
  // This means a concurrent reloadDatabase() call from refresh-all/route.ts
  // cannot corrupt our results; we're not touching the module-level db pointer.
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
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
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
      const dailyChangePercent = previousClose && previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
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
  // so refresh-all/route.ts cannot interleave and overwrite our changes.
  logger.info(`Phase 3: Applying ${priceResults.size} price results to fresh db snapshot...`);
  const db = reloadDatabase();

  // On non-4AM runs, zero out daily change for ALL mutual funds up front.
  // This covers funds that were skipped (manualPriceUpdate, fetch errors, etc.)
  // and would otherwise be missed by the per-position block below.
  if (!is4amRun) {
    for (const position of db.positions) {
      if (position.assetType?.toLowerCase() === 'mutual_fund') {
        position.dailyChange = 0;
        position.dailyChangeAmount = 0;
        position.priceChange = 0;
      }
    }
    logger.info('Non-4AM run: zeroed dailyChange/dailyChangeAmount/priceChange for all mutual fund positions');
  }

  let updated = 0;
  for (const [positionId, priceData] of priceResults) {
    const positionIndex = db.positions.findIndex(p => p.id === positionId);
    if (positionIndex >= 0) {
      const isMutualFund = db.positions[positionIndex].assetType?.toLowerCase() === 'mutual_fund';
      db.positions[positionIndex].currentPrice = priceData.currentPrice;
      db.positions[positionIndex].currentValue = priceData.currentValue;
      // Only set daily change for mutual funds on the 4 AM run (when NAV has posted).
      // All other runs keep it at 0 to avoid stale intraday values skewing daily return.
      db.positions[positionIndex].dailyChange = (isMutualFund && !is4amRun) ? 0 : priceData.dailyChange;
      db.positions[positionIndex].dailyChangeAmount = (isMutualFund && !is4amRun) ? 0 : priceData.dailyChangeAmount;
      db.positions[positionIndex].priceChange = (isMutualFund && !is4amRun) ? 0 : priceData.priceChange;
      db.positions[positionIndex].updatedAt = priceData.updatedAt;
      updated++;
    }
  }

  // Update account balances from updated position values
  const accountsWithPositions = new Set(db.positions.map(p => p.accountId));
  accountsWithPositions.forEach(accountId => {
    const account = db.accounts.find(a => a.id === accountId);
    if (account) {
      const accountPositions = db.positions.filter(p => p.accountId === accountId);
      const totalValue = accountPositions.reduce((sum, p) => sum + p.currentValue, 0);
      account.balance = totalValue;
      account.updatedAt = getLocalTimestamp();
    }
  });

  logger.info('Saving updated positions and account balances...');
  savePositionsAndAccounts();

  const duration = Date.now() - startTime;

  return {
    success: true,
    updated,
    errors,
    duration,
    errorDetails: errors > 0 ? errorDetails : undefined
  };
}

function shouldUpdateNow(): { should: boolean; is4amRun: boolean } {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Check if current time matches any scheduled time
  for (const schedule of SCHEDULE) {
    if (schedule.hour === currentHour && schedule.minute === currentMinute) {
      // Check if we haven't updated in the last minute
      if (!lastUpdateTime || (now.getTime() - lastUpdateTime.getTime()) > 60000) {
        return { should: true, is4amRun: schedule.hour === 4 && schedule.minute === 0 };
      }
    }
  }
  
  return { should: false, is4amRun: false };
}

async function checkAndUpdate() {
  if (!isRunning) return;
  
  const { should, is4amRun } = shouldUpdateNow();
  if (should) {
    logger.info(`Starting scheduled update... (4 AM run: ${is4amRun})`);
    
    try {
      const result = await updatePrices(is4amRun);
      lastUpdateTime = new Date();
      
      // Log the update
      logPriceUpdate({
        trigger: 'automatic',
        updated: result.updated,
        errors: result.errors,
        duration: result.duration,
        errorDetails: result.errorDetails
      });
      
      logger.info(`Update completed - Updated: ${result.updated}, Errors: ${result.errors}, Duration: ${result.duration}ms`);
    } catch (error) {
      logger.error('Update failed:', error);
      
      // Log failed update
      logPriceUpdate({
        trigger: 'automatic',
        updated: 0,
        errors: 1,
        duration: 0,
        errorDetails: [{
          symbol: 'ALL',
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      });
    }
  }
}

export function startPriceUpdateService() {
  if (isRunning) {
    logger.info('Already running');
    return;
  }
  
  logger.info('Starting background price update service...');
  logger.info('Schedule:', SCHEDULE.map(s => `${s.hour.toString().padStart(2, '0')}:${s.minute.toString().padStart(2, '0')}`).join(', '));
  
  isRunning = true;
  
  // Check every minute if it's time to update
  intervalId = setInterval(checkAndUpdate, 60000); // 60 seconds
  
  logger.info('Service started successfully');
}

export function stopPriceUpdateService() {
  if (!isRunning) {
    logger.info('Not running');
    return;
  }
  
  logger.info('Stopping service...');
  
  isRunning = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  logger.info('Service stopped');
}

export function getPriceUpdateServiceStatus() {
  // In development mode, if we have an interval but isRunning is false, it means the module reloaded
  // Check if interval exists to determine actual running state
  const actuallyRunning = intervalId !== null || isRunning;
  
  return {
    isRunning: actuallyRunning,
    lastUpdateTime: lastUpdateTime?.toISOString() || null,
    schedule: SCHEDULE,
    // Include interval status for debugging
    hasInterval: intervalId !== null,
    flagStatus: isRunning
  };
}
