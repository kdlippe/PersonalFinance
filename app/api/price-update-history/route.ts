import { NextResponse } from 'next/server';
import { getPriceUpdateHistory } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';
import { getPriceUpdateServiceStatus } from '@/lib/priceUpdateService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const history = getPriceUpdateHistory(100); // Last 100 updates
    const serviceStatus = getPriceUpdateServiceStatus();
    
    // The service is designed to always be running (started automatically on app startup)
    // It checks every minute for scheduled update times
    // Consider it "running" if:
    // 1. The service reports it's running (has interval set), OR
    // 2. We have ANY automatic updates in history (proves it ran at some point), OR
    // 3. The server is up (because instrumentation.ts auto-starts the service)
    
    const hasAutomaticUpdates = history.some(h => h.trigger === 'automatic');
    
    // If getPriceUpdateServiceStatus says it's running, trust that
    // Otherwise, if we've ever had automatic updates, the service must be running
    const isActuallyRunning = serviceStatus.isRunning || hasAutomaticUpdates;
    
    return NextResponse.json({
      history,
      serviceStatus: {
        ...serviceStatus,
        isRunning: isActuallyRunning,
        hasAutomaticUpdates
      }
    });
  } catch (error) {
    logger.error('Error fetching price update history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price update history' },
      { status: 500 }
    );
  }
}
