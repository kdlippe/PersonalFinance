'use client';

import { useEffect, useState } from 'react';
import { Account, Position } from '@/lib/types';
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, Plus, Edit2, Trash2, Lock } from 'lucide-react';
import Link from 'next/link';
import PositionDetailModal from '@/components/PositionDetailModal';
import AddPositionModal from '@/components/AddPositionModal';
import EditPositionModal from '@/components/EditPositionModal';

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingPositions, setRefreshingPositions] = useState<Set<number>>(new Set());
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [positionDetailModalOpen, setPositionDetailModalOpen] = useState(false);
  const [addPositionModalOpen, setAddPositionModalOpen] = useState(false);
  const [editPositionModalOpen, setEditPositionModalOpen] = useState(false);
  const [positionToEdit, setPositionToEdit] = useState<Position | null>(null);
  const [preselectedAccountId, setPreselectedAccountId] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh data when user returns to the page tab
  useEffect(() => {
    const handleFocus = () => {
      console.log('Portfolio page gained focus - refreshing data...');
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, positionsRes] = await Promise.all([
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/positions', { cache: 'no-store' }),
      ]);

      const accountsData = await accountsRes.json();
      const positionsData = await positionsRes.json();

      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setPositions(Array.isArray(positionsData) ? positionsData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setAccounts([]);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPrice = async (positionId: number, symbol: string, quantity: number, assetType?: string) => {
    setRefreshingPositions(prev => new Set(prev).add(positionId));

    try {
      // Clean symbol - remove ** and other special characters
      let cleanSymbol = symbol.replace(/\*+$/, '').trim();
      
      // For crypto, append -USD for Yahoo Finance format (BTC -> BTC-USD)
      if (assetType === 'crypto' && !cleanSymbol.includes('-')) {
        cleanSymbol = cleanSymbol + '-USD';
      }
      
      const priceResponse = await fetch('/api/stock-price?symbol=' + encodeURIComponent(cleanSymbol));
      
      if (!priceResponse.ok) {
        const error = await priceResponse.json();
        alert('Failed to fetch price for ' + cleanSymbol + ': ' + (error.error || 'Unknown error'));
        return;
      }

      const priceData = await priceResponse.json();
      const currentPrice = priceData.price;
      const newCurrentValue = currentPrice * quantity;
      const dailyChange = priceData.dailyChange ?? 0;
      const priceChange = priceData.dailyChangeAmount ?? 0; // Per-share change
      const dailyChangeAmount = priceChange * quantity; // Total position change

      const updateResponse = await fetch('/api/positions/' + positionId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentValue: newCurrentValue,
          currentPrice: currentPrice,
          dailyChange: dailyChange,
          dailyChangeAmount: dailyChangeAmount,
          priceChange: priceChange
        }),
      });

      if (updateResponse.ok) {
        await fetchData();
      } else {
        alert('Failed to update position');
      }
    } catch (error) {
      console.error('Error refreshing price:', error);
      alert('Failed to refresh price for ' + symbol);
    } finally {
      setRefreshingPositions(prev => {
        const next = new Set(prev);
        next.delete(positionId);
        return next;
      });
    }
  };

  const handleRefreshAllPrices = async () => {
    // Add all positions to refreshing state (exclude manual-only positions)
    const positionsToRefresh = positions.filter(p => 
      (p.assetType === 'stock' || p.assetType === 'etf' || p.assetType === 'mutual_fund' || p.assetType === 'crypto') &&
      !p.manualPriceUpdate
    );
    
    const refreshingIds = new Set(positionsToRefresh.map(p => p.id));
    setRefreshingPositions(refreshingIds);
    
    try {
      // Use the bulk refresh endpoint
      const response = await fetch('/api/positions/refresh-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' })
      });
      
      if (response.ok) {
        const result = await response.json();
        await fetchData();
        alert(`Updated ${result.updated} positions successfully!${result.errors > 0 ? ` (${result.errors} errors)` : ''}`);
      } else {
        const error = await response.json();
        alert('Failed to refresh prices: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error refreshing all prices:', error);
      alert('Failed to refresh prices');
    } finally {
      setRefreshingPositions(new Set());
    }
  };

  const handleDeletePosition = async (positionId: number, symbol: string) => {
    if (!confirm(`Are you sure you want to delete position ${symbol}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchData();
      } else {
        const error = await response.json();
        alert('Failed to delete position: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting position:', error);
      alert('Failed to delete position');
    }
  };

  const handleEditPosition = (position: Position, e: React.MouseEvent) => {
    e.stopPropagation();
    setPositionToEdit(position);
    setEditPositionModalOpen(true);
  };

  // Group positions by account
  const investmentAccounts = accounts.filter(a => 
    ['brokerage', 'investment', 'retirement', 'crypto'].includes(a.type) && 
    positions.some(p => p.accountId === a.id)
  );

  // Calculate account summaries
  const accountSummaries = investmentAccounts.map(account => {
    const accountPositions = positions.filter(p => p.accountId === account.id);
    const accountValue = accountPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const accountDailyReturn = accountPositions.reduce((sum, p) => sum + ((p.priceChange ?? 0) * p.quantity), 0);
    const accountDailyReturnPercent = accountValue > 0 ? (accountDailyReturn / accountValue) * 100 : 0;
    
    return {
      account,
      value: accountValue,
      dailyReturn: accountDailyReturn,
      dailyReturnPercent: accountDailyReturnPercent
    };
  });

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold mb-2">Investment Portfolio</h1>
            <p className="text-gray-600 dark:text-gray-300">All holdings across accounts</p>
          </div>
        </div>
        
        {/* Refresh All Prices Button */}
        {positions.length > 0 && (
          <button
            onClick={handleRefreshAllPrices}
            disabled={refreshingPositions.size > 0}
            className="btn btn-primary flex items-center gap-2"
            title="Refresh all stock, ETF, mutual fund, and crypto prices"
          >
            <RefreshCw size={20} className={refreshingPositions.size > 0 ? 'animate-spin' : ''} />
            Refresh All Prices
          </button>
        )}
      </div>

      {/* Account Summary by Type */}
      <div className="flex flex-wrap justify-center gap-4">
        {(() => {
          // Group accounts by type
          const accountsByType = accountSummaries.reduce((acc, summary) => {
            const type = summary.account.type;
            if (!acc[type]) acc[type] = [];
            acc[type].push(summary);
            return acc;
          }, {} as Record<string, typeof accountSummaries>);

          // Define display order and labels
          const typeOrder = [
            { key: 'brokerage', label: 'Brokerage', color: 'blue' },
            { key: 'investment', label: 'Investment', color: 'green' },
            { key: 'crypto', label: 'Crypto', color: 'orange' },
            { key: 'retirement', label: 'Retirement', color: 'purple' }
          ];

          return typeOrder.map(({ key, label, color }) => {
            const accounts = accountsByType[key] || [];
            if (accounts.length === 0) return null;

            const headerColorClasses = {
              purple: 'text-purple-600 dark:text-purple-400',
              blue: 'text-blue-600 dark:text-blue-400',
              green: 'text-green-600 dark:text-green-400',
              orange: 'text-orange-600 dark:text-orange-400'
            };

            return (
              <div key={key} className="card">
                <div className="flex items-center gap-4">
                  <h3 className={`text-xs font-bold uppercase tracking-wide whitespace-nowrap ${headerColorClasses[color as keyof typeof headerColorClasses]}`}>
                    {label}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3">
                    {accounts.map(({ account, value, dailyReturn, dailyReturnPercent }) => (
                      <button
                        key={account.id}
                        onClick={() => {
                          const element = document.getElementById(`account-${account.id}`);
                          element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="flex-shrink-0 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-center border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                      >
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 whitespace-nowrap">
                          {account.name}
                        </div>
                        <div className="font-bold text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className={`text-xs font-semibold ${dailyReturn > 0 ? 'text-green-600 dark:text-green-400' : dailyReturn < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                          {dailyReturn >= 0 ? '+' : ''}{dailyReturnPercent.toFixed(2)}%
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          }).filter(Boolean);
        })()}
      </div>

      {/* Holdings by Account */}
      {investmentAccounts.length > 0 ? (
        <div className="space-y-8">
          {(() => {
            // Group accounts by type
            const accountsByType = investmentAccounts.reduce((acc, account) => {
              if (!acc[account.type]) acc[account.type] = [];
              acc[account.type].push(account);
              return acc;
            }, {} as Record<string, Account[]>);

            // Define display order and labels for account types
            const typeOrder = [
              { key: 'brokerage', label: 'Brokerage Accounts' },
              { key: 'investment', label: 'Investment Accounts' },
              { key: 'crypto', label: 'Crypto Accounts' },
              { key: 'retirement', label: 'Retirement Accounts' }
            ];

            return typeOrder.map(({ key, label }) => {
              const accountsOfType = accountsByType[key] || [];
              if (accountsOfType.length === 0) return null;

              return (
                <div key={key} className="space-y-6">
                  {/* Type Heading */}
                  <div className="border-b-2 border-gray-300 dark:border-gray-600 pb-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{label}</h2>
                  </div>

                  {/* Accounts of this type */}
                  {accountsOfType.map(account => {
                    const accountPositions = positions.filter(p => p.accountId === account.id);
                    const accountValue = accountPositions.reduce((sum, p) => sum + p.currentValue, 0);
                    const accountCostBasis = accountPositions.reduce((sum, p) => sum + p.costBasis, 0);
                    const accountGainLoss = accountValue - accountCostBasis;
                    const accountGainLossPercent = accountCostBasis > 0 ? (accountGainLoss / accountCostBasis) * 100 : 0;
                    
                    // Calculate daily return - calculate dynamically from priceChange * quantity
                    const accountDailyReturn = accountPositions.reduce((sum, p) => sum + ((p.priceChange ?? 0) * p.quantity), 0);
                    const accountDailyReturnPercent = accountValue > 0 ? (accountDailyReturn / accountValue) * 100 : 0;

                    return (
                      <div key={account.id} id={`account-${account.id}`} className="card scroll-mt-8">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{account.name}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreselectedAccountId(account.id);
                        setAddPositionModalOpen(true);
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Add position to this account"
                    >
                      <Plus size={18} className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      ${accountValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className={`text-sm font-medium flex items-center justify-end gap-1 ${accountDailyReturn > 0 ? 'text-green-600' : accountDailyReturn < 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                      {accountDailyReturn >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {accountDailyReturn >= 0 ? '+' : ''}${accountDailyReturn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-xs">({accountDailyReturn >= 0 ? '+' : ''}{accountDailyReturnPercent.toFixed(2)}%)</span>
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Symbol</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Quantity</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Value</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Price</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Price Change</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Today's Change</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Total Gain/Loss</th>
                        <th className="text-center py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountPositions
                        .sort((a, b) => b.currentValue - a.currentValue)
                        .map((position) => {
                          const currentPrice = position.currentPrice ?? (position.quantity > 0 ? position.currentValue / position.quantity : 0);
                          const dailyChange = position.dailyChange ?? 0;
                          const priceChange = position.priceChange ?? 0;
                          const dailyChangeAmount = priceChange * position.quantity; // Calculate dynamically
                          const totalGainLoss = position.currentValue - position.costBasis;
                          const totalGainLossPercent = position.costBasis > 0 ? (totalGainLoss / position.costBasis) * 100 : 0;
                          const isRefreshing = refreshingPositions.has(position.id);

                          return (
                            <tr 
                              key={position.id} 
                              className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                              onClick={() => {
                                setSelectedPosition(position);
                                setPositionDetailModalOpen(true);
                              }}
                            >
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{position.symbol}</span>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{position.assetType}</p>
                                  </div>
                                  {(position.assetType === 'stock' || position.assetType === 'etf' || position.assetType === 'mutual_fund' || position.assetType === 'crypto') && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!position.manualPriceUpdate) {
                                          handleRefreshPrice(position.id, position.symbol, position.quantity, position.assetType);
                                        }
                                      }}
                                      disabled={isRefreshing || position.manualPriceUpdate}
                                      className={`p-1.5 rounded transition-colors ${
                                        position.manualPriceUpdate 
                                          ? 'cursor-not-allowed opacity-60' 
                                          : 'hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed'
                                      }`}
                                      title={position.manualPriceUpdate ? 'Manual price updates only (edit to change)' : 'Refresh current market value'}
                                    >
                                      {position.manualPriceUpdate ? (
                                        <Lock 
                                          size={14} 
                                          className="text-yellow-600 dark:text-yellow-400"
                                        />
                                      ) : (
                                        <RefreshCw 
                                          size={14} 
                                          className={isRefreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400'}
                                        />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-medium">
                                {position.quantity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                              </td>
                              <td className="py-3 px-3 text-right font-medium">
                                ${position.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-3 text-right font-medium">
                                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className={`py-3 px-3 text-right font-medium text-sm ${priceChange > 0 ? 'text-green-600 dark:text-green-400' : priceChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                {priceChange >= 0 ? '+' : ''}${priceChange.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className={`py-3 px-3 text-right font-medium text-sm ${dailyChange > 0 ? 'text-green-600 dark:text-green-400' : dailyChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                <div>{dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)}%</div>
                                <div className="text-xs">${dailyChangeAmount >= 0 ? '+' : ''}{dailyChangeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                              </td>
                              <td className={`py-3 px-3 text-right font-medium text-sm ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                <div>{totalGainLoss >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%</div>
                                <div className="text-xs">${totalGainLoss >= 0 ? '+' : ''}{totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={(e) => handleEditPosition(position, e)}
                                    className="p-2 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                    title="Edit position"
                                  >
                                    <Edit2 size={16} className="text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePosition(position.id, position.symbol);
                                    }}
                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    title="Delete position"
                                  >
                                    <Trash2 size={16} className="text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
                    );
                  })}
                </div>
              );
            }).filter(Boolean);
          })()}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No investment positions found</p>
          <button
            onClick={() => setAddPositionModalOpen(true)}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={20} />
            Add Your First Position
          </button>
        </div>
      )}

      {/* Position Detail Modal */}
      {positionDetailModalOpen && selectedPosition && (
        <PositionDetailModal
          position={selectedPosition as any}
          accounts={accounts}
          onClose={() => {
            setPositionDetailModalOpen(false);
            setSelectedPosition(null);
          }}
        />
      )}

      {/* Add Position Modal */}
      {addPositionModalOpen && (
        <AddPositionModal
          accounts={accounts}
          preselectedAccountId={preselectedAccountId}
          onClose={() => {
            setAddPositionModalOpen(false);
            setPreselectedAccountId(undefined);
          }}
          onSuccess={() => {
            setAddPositionModalOpen(false);
            setPreselectedAccountId(undefined);
            fetchData();
          }}
        />
      )}

      {/* Edit Position Modal */}
      {editPositionModalOpen && positionToEdit && (
        <EditPositionModal
          position={positionToEdit}
          onClose={() => {
            setEditPositionModalOpen(false);
            setPositionToEdit(null);
          }}
          onSuccess={() => {
            setEditPositionModalOpen(false);
            setPositionToEdit(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
