import { NextRequest, NextResponse } from 'next/server';
import { apiLogger as logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ symbol: string }>;
}

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { symbol } = await context.params;
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    // Clean symbol (remove asterisks)
    let cleanSymbol = symbol.replace(/\*+$/, '').trim();
    
    // For crypto, append -USD for Yahoo Finance format
    if (cleanSymbol.match(/^(BTC|ETH|DOGE|ADA|DOT|LINK|UNI)$/i)) {
      cleanSymbol = cleanSymbol.toUpperCase() + '-USD';
    }

    // Use the chart endpoint which is more reliable
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSymbol)}`;
    
    // Add cache-busting to Yahoo Finance request
    const response = await fetch(chartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store', // Don't cache the Yahoo Finance response
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch data: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result) {
      return NextResponse.json(
        { error: 'No data available for this symbol' },
        { status: 404 }
      );
    }

    const meta = result.meta;
    
    // Extract quote data
    const currentPrice = meta.regularMarketPrice || meta.previousClose;
    const previousClose = meta.previousClose || meta.chartPreviousClose;
    const dayChange = currentPrice && previousClose ? currentPrice - previousClose : 0;
    const dayChangePercent = currentPrice && previousClose && previousClose > 0 
      ? ((currentPrice - previousClose) / previousClose) * 100 
      : 0;

    const stockDetail = {
      symbol: meta.symbol,
      shortName: meta.shortName || meta.symbol,
      longName: meta.longName || meta.shortName || meta.symbol,
      
      // Price info
      currentPrice: currentPrice,
      previousClose: previousClose,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      dayChange: dayChange,
      dayChangePercent: dayChangePercent,
      
      // Volume
      volume: meta.regularMarketVolume,
      avgVolume: undefined,
      
      // Range info
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      
      // Valuation
      marketCap: undefined,
      
      // Fundamentals (stocks only)
      peRatio: undefined,
      forwardPE: undefined,
      eps: undefined,
      beta: undefined,
      
      // Dividends
      dividendYield: undefined,
      exDividendDate: undefined,
      
      // Fund info (mutual funds/ETFs)
      expenseRatio: undefined,
      category: undefined,
      
      // Company info
      industry: undefined,
      sector: undefined,
      
      // Financial metrics
      targetPrice: undefined,
      recommendationKey: undefined,
      numberOfAnalysts: undefined,
      
      // Events
      earningsDate: undefined,
      
      // Currency
      currency: meta.currency || 'USD',
    };

    // Return with no-cache headers to prevent stale data
    return NextResponse.json(stockDetail, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    logger.error('Error fetching stock details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}