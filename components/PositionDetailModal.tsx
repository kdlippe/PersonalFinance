'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, ExternalLink, Calendar, DollarSign, BarChart3, Percent, Users, RefreshCw } from 'lucide-react';

interface Position {
  id: number;
  accountId: number;
  symbol: string;
  assetType?: string;
  manualPriceUpdate?: boolean;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  currentValue: number;
  costBasisPerShare?: number;
}

interface StockDetail {
  symbol: string;
  shortName: string;
  longName: string;
  currentPrice: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  dayChange: number;
  dayChangePercent: number;
  volume: number;
  avgVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
  peRatio?: number;
  forwardPE?: number;
  eps?: number;
  beta?: number;
  dividendYield?: number;
  exDividendDate?: number;
  expenseRatio?: number;
  category?: string;
  industry?: string;
  sector?: string;
  targetPrice?: number;
  recommendationKey?: string;
  numberOfAnalysts?: number;
  earningsDate?: number;
  currency: string;
}

interface PositionDetailModalProps {
  position: Position | Position[];
  accounts?: Array<{ id: number; name: string }>;
  onClose: () => void;
}

export default function PositionDetailModal({ position, accounts, onClose }: PositionDetailModalProps) {
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Handle both single position and array of positions
  const positions = Array.isArray(position) ? position : [position];
  const firstPosition = positions[0];
  const isAggregated = positions.length > 1;

  // Calculate aggregated totals
  const totalQuantity = positions.reduce((sum, p) => sum + p.quantity, 0);
  const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
  const totalCurrentValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalGainLoss = totalCurrentValue - totalCostBasis;
  const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const avgCostBasis = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;
  const avgCurrentPrice = totalQuantity > 0 ? totalCurrentValue / totalQuantity : 0;

  const isManual = firstPosition.manualPriceUpdate === true;

  useEffect(() => {
    if (isManual) {
      setLoading(false);
      return;
    }
    fetchStockDetails();
  }, [firstPosition.symbol]);

  const fetchStockDetails = async () => {
    if (isManual) return;
    try {
      setLoading(true);
      setError(null);
      // Clean symbol - remove ** and other special characters
      const cleanSymbol = firstPosition.symbol.replace(/\*+$/, '').trim();
      // Add cache-busting to ensure fresh data
      const response = await fetch(`/api/stock-price/${encodeURIComponent(cleanSymbol)}?t=${Date.now()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setStockDetail(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching stock details:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | undefined, currency = 'USD') => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatLargeNumber = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return formatCurrency(value);
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {firstPosition.symbol}
                {!isManual && stockDetail && (
                  <a
                    href={`https://finance.yahoo.com/quote/${firstPosition.symbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <ExternalLink size={20} />
                  </a>
                )}
              </h2>
              {!isManual && !loading && !error && (
                <button
                  onClick={fetchStockDetails}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Refresh live data"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : 'text-gray-500 dark:text-gray-400'} />
                </button>
              )}
            </div>
            {stockDetail && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stockDetail.longName || stockDetail.shortName}</p>}
            {isAggregated && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">Aggregated across {positions.length} accounts</p>
            )}
            {lastUpdated && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Updated: {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                <span className="ml-2 text-yellow-600 dark:text-yellow-500">• Data may be delayed 15-20 minutes</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors ml-4"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading details...</p>
            </div>
          )}

          {!loading && isManual && (
            <div className="space-y-6">
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
                This position uses manual price updates — live market data is not fetched.
              </div>
              <div className="card bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <h3 className="text-lg font-semibold mb-3">Your Position{isAggregated ? 's' : ''}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Shares</p>
                    <p className="text-xl font-bold">{totalQuantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Cost / Share</p>
                    <p className="text-xl font-bold">{formatCurrency(avgCostBasis)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Current Price</p>
                    <p className="text-xl font-bold">{formatCurrency(avgCurrentPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Value</p>
                    <p className="text-xl font-bold">{formatCurrency(totalCurrentValue)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Cost Basis</p>
                    <p className="text-xl font-bold">{formatCurrency(totalCostBasis)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Gain / Loss</p>
                    <p className={`text-xl font-bold ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss)} ({totalGainLossPercent >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%)
                    </p>
                  </div>
                </div>
                {isAggregated && accounts && (
                  <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                    <p className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Breakdown by Account:</p>
                    <div className="space-y-2">
                      {positions.map((pos, index) => {
                        const account = accounts.find(a => a.id === pos.accountId);
                        const posGainLoss = pos.currentValue - pos.costBasis;
                        const posGainLossPercent = pos.costBasis > 0 ? (posGainLoss / pos.costBasis) * 100 : 0;
                        const bgColors = [
                          'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
                          'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                          'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700',
                        ];
                        const colorClass = bgColors[index % bgColors.length];
                        return (
                          <div key={pos.id} className={`flex justify-between items-center text-sm px-3 py-2 rounded border ${colorClass}`}>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{account?.name || `Account ${pos.accountId}`}</span>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{pos.quantity.toLocaleString()} shares • {formatCurrency(pos.currentValue)}</div>
                              <div className={`text-xs ${posGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {posGainLoss >= 0 ? '+' : ''}{formatCurrency(posGainLoss)} ({posGainLoss >= 0 ? '+' : ''}{posGainLossPercent.toFixed(2)}%)
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Unable to fetch live market data for this symbol.
              </p>
            </div>
          )}

          {!loading && !error && stockDetail && (
            <div className="space-y-6">
              {/* Current Price & Change */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={20} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold">Current Price</h3>
                  </div>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(stockDetail.currentPrice, stockDetail.currency)}
                  </p>
                  <p className={`text-sm mt-1 flex items-center gap-1 ${stockDetail.dayChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {stockDetail.dayChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {stockDetail.dayChange >= 0 ? '+' : ''}{formatCurrency(stockDetail.dayChange, stockDetail.currency)} ({stockDetail.dayChangePercent >= 0 ? '+' : ''}{stockDetail.dayChangePercent?.toFixed(2)}%)
                  </p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 size={20} className="text-purple-600 dark:text-purple-400" />
                    <h3 className="font-semibold">Day's Range</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Low: {formatCurrency(stockDetail.dayLow, stockDetail.currency)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    High: {formatCurrency(stockDetail.dayHigh, stockDetail.currency)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Prev Close: {formatCurrency(stockDetail.previousClose, stockDetail.currency)}
                  </p>
                </div>

                <div className="card">
                  <h3 className="font-semibold mb-2">52 Week Range</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Low: {formatCurrency(stockDetail.fiftyTwoWeekLow, stockDetail.currency)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    High: {formatCurrency(stockDetail.fiftyTwoWeekHigh, stockDetail.currency)}
                  </p>
                </div>
              </div>

              {/* Your Position */}
              <div className="card bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <h3 className="text-lg font-semibold mb-3">Your Position{isAggregated ? 's' : ''}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Shares</p>
                    <p className="text-xl font-bold">{totalQuantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Cost</p>
                    <p className="text-xl font-bold">{formatCurrency(avgCostBasis)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Value</p>
                    <p className="text-xl font-bold">{formatCurrency(totalCurrentValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Daily Change</p>
                    <p className={`text-xl font-bold ${(stockDetail.dayChange * totalQuantity) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {(stockDetail.dayChange * totalQuantity) >= 0 ? '+' : ''}{formatCurrency(stockDetail.dayChange * totalQuantity)}
                    </p>
                    <p className={`text-xs ${stockDetail.dayChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {stockDetail.dayChangePercent >= 0 ? '+' : ''}{stockDetail.dayChangePercent?.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Account Breakdown */}
                {isAggregated && accounts && (
                  <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                    <p className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Breakdown by Account:</p>
                    <div className="space-y-2">
                      {positions.map((pos, index) => {
                        const account = accounts.find(a => a.id === pos.accountId);
                        const posGainLoss = pos.currentValue - pos.costBasis;
                        const posGainLossPercent = pos.costBasis > 0 ? (posGainLoss / pos.costBasis) * 100 : 0;
                        
                        // Alternate between different shades of green
                        const bgColors = [
                          'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700',
                          'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                          'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700',
                        ];
                        const colorClass = bgColors[index % bgColors.length];
                        
                        return (
                          <div key={pos.id} className={`flex justify-between items-center text-sm px-3 py-2 rounded border ${colorClass}`}>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{account?.name || `Account ${pos.accountId}`}</span>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{pos.quantity.toLocaleString()} shares • {formatCurrency(pos.currentValue)}</div>
                              <div className={`text-xs ${posGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {posGainLoss >= 0 ? '+' : ''}{formatCurrency(posGainLoss)} ({posGainLoss >= 0 ? '+' : ''}{posGainLossPercent.toFixed(2)}%)
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Market Data */}
              {(stockDetail.marketCap || stockDetail.volume || stockDetail.peRatio || stockDetail.beta || stockDetail.dividendYield || stockDetail.expenseRatio) && (
                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">Market Data</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {stockDetail.marketCap && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Market Cap</p>
                        <p className="font-semibold">{formatLargeNumber(stockDetail.marketCap)}</p>
                      </div>
                    )}
                    {stockDetail.volume && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Volume</p>
                        <p className="font-semibold">{stockDetail.volume?.toLocaleString() || 'N/A'}</p>
                      </div>
                    )}
                    {stockDetail.avgVolume && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Avg Volume</p>
                        <p className="font-semibold">{stockDetail.avgVolume?.toLocaleString() || 'N/A'}</p>
                      </div>
                    )}
                    {stockDetail.peRatio && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">P/E Ratio (TTM)</p>
                        <p className="font-semibold">{stockDetail.peRatio.toFixed(2)}</p>
                      </div>
                    )}
                    {stockDetail.forwardPE && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Forward P/E</p>
                        <p className="font-semibold">{stockDetail.forwardPE.toFixed(2)}</p>
                      </div>
                    )}
                    {stockDetail.eps && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">EPS (TTM)</p>
                        <p className="font-semibold">{formatCurrency(stockDetail.eps, stockDetail.currency)}</p>
                      </div>
                    )}
                    {stockDetail.beta && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Beta</p>
                        <p className="font-semibold">{stockDetail.beta.toFixed(2)}</p>
                      </div>
                    )}
                    {stockDetail.dividendYield && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Dividend Yield</p>
                        <p className="font-semibold">{formatPercent(stockDetail.dividendYield)}</p>
                      </div>
                    )}
                    {stockDetail.expenseRatio && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Expense Ratio</p>
                        <p className="font-semibold">{formatPercent(stockDetail.expenseRatio)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Company/Fund Info */}
              {(stockDetail.sector || stockDetail.industry || stockDetail.category) && (
                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {stockDetail.sector && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Sector</p>
                        <p className="font-semibold">{stockDetail.sector}</p>
                      </div>
                    )}
                    {stockDetail.industry && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Industry</p>
                        <p className="font-semibold">{stockDetail.industry}</p>
                      </div>
                    )}
                    {stockDetail.category && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Category</p>
                        <p className="font-semibold">{stockDetail.category}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Analyst Data */}
              {(stockDetail.targetPrice || stockDetail.recommendationKey) && (
                <div className="card bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={20} className="text-purple-600 dark:text-purple-400" />
                    <h3 className="text-lg font-semibold">Analyst Ratings</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {stockDetail.targetPrice && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Target Price</p>
                        <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                          {formatCurrency(stockDetail.targetPrice, stockDetail.currency)}
                        </p>
                      </div>
                    )}
                    {stockDetail.recommendationKey && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Recommendation</p>
                        <p className="text-xl font-bold capitalize">{stockDetail.recommendationKey}</p>
                      </div>
                    )}
                    {stockDetail.numberOfAnalysts && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Analysts</p>
                        <p className="text-xl font-bold">{stockDetail.numberOfAnalysts}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Events */}
              {(stockDetail.earningsDate || stockDetail.exDividendDate) && (
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={20} className="text-orange-600 dark:text-orange-400" />
                    <h3 className="text-lg font-semibold">Upcoming Events</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {stockDetail.earningsDate && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Next Earnings</p>
                        <p className="font-semibold">{formatDate(stockDetail.earningsDate)}</p>
                      </div>
                    )}
                    {stockDetail.exDividendDate && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Ex-Dividend Date</p>
                        <p className="font-semibold">{formatDate(stockDetail.exDividendDate)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data availability note */}
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <p>Some advanced metrics (P/E, analyst ratings, etc.) may not be available for all securities.</p>
                <p className="mt-1">Data provided by Yahoo Finance</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
