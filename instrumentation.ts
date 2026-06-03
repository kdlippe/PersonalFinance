// Next.js Instrumentation
// This file runs once when the server starts
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on the server side
    const { instrumentationLogger } = await import('./lib/logger');
    const { startPriceUpdateService } = await import('./lib/priceUpdateService');
    const { startNetWorthService } = await import('./lib/netWorthService');
    
    instrumentationLogger.info('Starting background services...');
    startPriceUpdateService();
    startNetWorthService();
    instrumentationLogger.info('Background services initialized');
  }
}
