import { NextResponse } from 'next/server';
import { apiLogger as logger } from '@/lib/logger';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Normalize stock symbols for Yahoo Finance lookup
function normalizeSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim();
  
  // Handle Berkshire Hathaway special cases
  if (upper === 'BRKB' || upper === 'BRK.B') {
    return 'BRK-B';
  }
  if (upper === 'BRKA' || upper === 'BRK.A') {
    return 'BRK-A';
  }
  
  // Convert dots to hyphens (common in some systems)
  return upper.replace(/\./g, '-');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // Normalize the symbol before lookup
    const normalizedSymbol = normalizeSymbol(symbol);

    // Use Yahoo Finance API through query.yahooapis.com
    // This is a free public API that doesn't require authentication
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalizedSymbol)}`;
    
    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store', // Don't cache the Yahoo Finance response
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch stock price' }, { status: response.status });
    }

    const data = await response.json();
    
    // Extract current price from Yahoo Finance response
    const result = data?.chart?.result?.[0];
    if (!result) {
      return NextResponse.json({ error: 'Invalid symbol or no data available' }, { status: 404 });
    }

    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice || meta.previousClose;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    
    if (!currentPrice) {
      return NextResponse.json({ error: 'Price not available' }, { status: 404 });
    }

    // Calculate daily change
    const dailyChangeAmount = previousClose ? currentPrice - previousClose : 0;
    const dailyChangePercent = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

    return NextResponse.json({
      symbol: meta.symbol,
      price: currentPrice,
      previousClose: previousClose,
      dailyChange: dailyChangePercent,
      dailyChangeAmount: dailyChangeAmount,
      currency: meta.currency || 'USD',
      exchangeName: meta.exchangeName,
      regularMarketTime: meta.regularMarketTime,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    logger.error('Error fetching stock price:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock price' },
      { status: 500 }
    );
  }
}
