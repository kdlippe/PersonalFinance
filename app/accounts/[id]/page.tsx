'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Account, Transaction, Position } from '@/lib/types';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Package, Clock, Plus, X, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import EditPositionModal from '@/components/EditPositionModal';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AccountDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const accountId = parseInt(params.id);
  
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'positions'>('positions');
  const [historyData, setHistoryData] = useState<{ date: string; balance: number }[]>([]);
  const [chartDays, setChartDays] = useState<number>(365);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [addingPosition, setAddingPosition] = useState(false);
  const [refreshingPositions, setRefreshingPositions] = useState<Set<number>>(new Set());
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [newPosition, setNewPosition] = useState({
    symbol: '',
    description: '',
    quantity: '',
    costBasis: '',
    currentValue: '',
    assetType: 'stock' as 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'crypto' | 'other',
  });

  useEffect(() => {
    fetchAccountData();
  }, [accountId]);

  useEffect(() => {
    if (account) fetchHistory(account.name);
  }, [account?.name, chartDays]);

  const fetchHistory = async (accountName: string) => {
    try {
      const param = chartDays > 0 ? `?days=${chartDays}` : '';
      const res = await fetch(`/api/net-worth-history${param}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.snapshots) return;

      const points = data.snapshots
        .filter((s: any) => s.accountBalances && s.accountBalances[accountName] !== undefined)
        .map((s: any) => ({ date: s.date, balance: s.accountBalances[accountName] as number }));

      setHistoryData(points);
    } catch (e) {
      console.error('Error fetching account history:', e);
    }
  };

  const fetchAccountData = async () => {
    try {
      // Fetch account details (with cache busting for fresh data)
      const accountRes = await fetch('/api/accounts', { cache: 'no-store' });
      const accounts = await accountRes.json();
      const foundAccount = Array.isArray(accounts) ? accounts.find((a: Account) => a.id === accountId) : null;
      setAccount(foundAccount);

      // Fetch transactions for this account
      const txRes = await fetch(`/api/transactions?accountId=${accountId}&limit=10000`, { cache: 'no-store' });
      const accountTransactions = await txRes.json();
      setTransactions(Array.isArray(accountTransactions) ? accountTransactions : []);

      // Fetch positions for this account
      const posRes = await fetch('/api/positions', { cache: 'no-store' });
      const allPositions = await posRes.json();
      const accountPositions = Array.isArray(allPositions)
        ? allPositions.filter((p: Position) => p.accountId === accountId)
        : [];
      setPositions(accountPositions);
    } catch (error) {
      console.error('Error fetching account data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingPosition(true);

    try {
      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          symbol: newPosition.symbol.trim().toUpperCase(),
          description: newPosition.description.trim() || newPosition.symbol.trim().toUpperCase(),
          quantity: parseFloat(newPosition.quantity),
          costBasis: newPosition.costBasis ? parseFloat(newPosition.costBasis) : parseFloat(newPosition.currentValue),
          currentValue: parseFloat(newPosition.currentValue),
          assetType: newPosition.assetType,
        }),
      });

      if (response.ok) {
        // Reset form
        setNewPosition({
          symbol: '',
          description: '',
          quantity: '',
          costBasis: '',
          currentValue: '',
          assetType: 'stock',
        });
        setShowAddPosition(false);
        
        // Refresh data
        await fetchAccountData();
      } else {
        const error = await response.json();
        alert('Failed to add position: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding position:', error);
      alert('Failed to add position');
    } finally {
      setAddingPosition(false);
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
      
      // Fetch current stock price
      const priceResponse = await fetch('/api/stock-price?symbol=' + encodeURIComponent(cleanSymbol));
      
      if (!priceResponse.ok) {
        const error = await priceResponse.json();
        alert('Failed to fetch price for ' + symbol + ': ' + (error.error || 'Unknown error'));
        return;
      }

      const priceData = await priceResponse.json();
      const currentPrice = priceData.price;
      const newCurrentValue = currentPrice * quantity;

      // Update position with new current value and price
      const updateResponse = await fetch('/api/positions/' + positionId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentValue: newCurrentValue,
          currentPrice: currentPrice
        }),
      });

      if (updateResponse.ok) {
        // Refresh account data to show updated values
        await fetchAccountData();
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
    const positionsToRefresh = positions.filter(p => 
      p.assetType === 'stock' || p.assetType === 'etf' || p.assetType === 'mutual_fund' || p.assetType === 'crypto'
    );
    
    // Add all positions to refreshing state
    const refreshingIds = new Set(positionsToRefresh.map(p => p.id));
    setRefreshingPositions(refreshingIds);
    
    try {
      // Use the bulk refresh endpoint
      const response = await fetch('/api/positions/refresh-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual', accountId })
      });
      
      if (response.ok) {
        const result = await response.json();
        await fetchAccountData();
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
        await fetchAccountData();
      } else {
        const error = await response.json();
        alert('Failed to delete position: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting position:', error);
      alert('Failed to delete position');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Account not found</p>
        <button onClick={() => router.push('/accounts')} className="btn btn-primary">
          Back to Accounts
        </button>
      </div>
    );
  }

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalGainLoss = positions.reduce((sum, p) => sum + (p.currentValue - p.costBasis), 0);
  const totalGainLossPercent = positions.length > 0
    ? (totalGainLoss / positions.reduce((sum, p) => sum + p.costBasis, 0)) * 100
    : 0;
  
  // Calculate daily return
  const totalDailyChangeAmount = positions.reduce((sum, p) => sum + (p.dailyChangeAmount ?? 0), 0);
  const yesterdayValue = totalValue - totalDailyChangeAmount;
  const totalDailyChangePercent = yesterdayValue > 0 ? (totalDailyChangeAmount / yesterdayValue) * 100 : 0;

  // For accounts with positions, show the calculated total from positions
  // Otherwise show the account balance
  const displayBalance = positions.length > 0 ? totalValue : account.balance;

  const getLastUpdatedText = (updatedAt: string) => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffMs = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/accounts')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold dark:text-gray-100">{account.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-600 dark:text-gray-300 capitalize">{account.type.replace('_', ' ')}</p>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock size={14} />
              <span>Updated {getLastUpdatedText(account.updatedAt)}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-300">{positions.length > 0 ? 'Total Portfolio Value' : 'Current Balance'}</p>
          <p className={`text-3xl font-bold ${account.type === 'credit_card' || account.type === 'loan' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            ${displayBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Investment Summary (for brokerage accounts with positions) */}
      {positions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Package size={20} className="text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Positions</p>
            </div>
            <p className="text-2xl font-bold dark:text-gray-100">{positions.length}</p>
          </div>
          
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={20} className="text-green-600 dark:text-green-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Value</p>
            </div>
            <p className="text-2xl font-bold dark:text-gray-100">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              {totalGainLoss >= 0 ? (
                <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown size={20} className="text-red-600 dark:text-red-400" />
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Gain/Loss</p>
            </div>
            <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalGainLoss >= 0 ? '+' : ''}${totalGainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              {totalDailyChangePercent >= 0 ? (
                <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown size={20} className="text-red-600 dark:text-red-400" />
              )}
              <p className="text-sm text-gray-600 dark:text-gray-300">Daily Return</p>
            </div>
            <p className={`text-2xl font-bold ${totalDailyChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalDailyChangePercent >= 0 ? '+' : ''}{totalDailyChangePercent.toFixed(2)}%
            </p>
            <p className={`text-xs mt-1 ${totalDailyChangeAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalDailyChangeAmount >= 0 ? '+' : ''}${totalDailyChangeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Balance History Chart */}
      {historyData.length > 1 && (() => {
        const values = historyData.map(p => p.balance);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const pad = (max - min) * 0.1 || Math.abs(max) * 0.05 || 1;
        const yDomain: [number, number] = [min - pad, max + pad];
        const first = historyData[0].balance;
        const last = historyData[historyData.length - 1].balance;
        const change = last - first;
        const changePct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
        const isUp = change >= 0;
        const color = isUp ? '#16a34a' : '#dc2626';

        const RANGES = [
          { label: '1M', days: 30 },
          { label: '3M', days: 90 },
          { label: '6M', days: 180 },
          { label: '1Y', days: 365 },
          { label: 'All', days: 0 },
        ];

        return (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold dark:text-gray-100">Balance History</h3>
                <span className={`text-sm font-medium ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isUp ? '+' : ''}${change.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
                </span>
              </div>
              <div className="flex gap-1">
                {RANGES.map(r => (
                  <button
                    key={r.label}
                    onClick={() => setChartDays(r.days)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      chartDays === r.days
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={historyData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => {
                    const dt = new Date(d + 'T00:00:00');
                    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                  interval="preserveStartEnd"
                  tickCount={6}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => '$' + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0))}
                  width={56}
                />
                <Tooltip
                  formatter={(value: number) => [`$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Balance']}
                  labelFormatter={(label: string) => new Date(label + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={color}
                  strokeWidth={2}
                  fill="url(#histGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'positions'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'transactions'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Transactions ({transactions.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'transactions' ? (
          <div className="space-y-2">
            {transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Category</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        tx.category === 'Uncategorized' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-400 dark:border-l-yellow-600' : ''
                      }`}>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{tx.date}</td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium dark:text-gray-100">{tx.description}</p>
                            {tx.merchant && tx.merchant !== tx.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">{tx.merchant}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full text-center ${
                            tx.category === 'Uncategorized' 
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                          }`}>
                            {tx.category}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${
                          tx.type === 'income' ? 'text-green-600 dark:text-green-400' :
                          tx.type === 'transfer' ? 'text-gray-900 dark:text-gray-100' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '-'}${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No transactions yet</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add Position and Refresh All Buttons */}
            {!showAddPosition && (
              <div className="flex justify-end gap-2">
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
                <button
                  onClick={() => setShowAddPosition(true)}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Plus size={20} />
                  Add Position
                </button>
              </div>
            )}

            {/* Add Position Form */}
            {showAddPosition && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg dark:text-gray-100">Add New Position</h3>
                  <button
                    onClick={() => setShowAddPosition(false)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddPosition} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Symbol <span className="text-red-500 dark:text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPosition.symbol}
                        onChange={(e) => setNewPosition({ ...newPosition, symbol: e.target.value })}
                        placeholder="e.g., AAPL"
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description (optional)
                      </label>
                      <input
                        type="text"
                        value={newPosition.description}
                        onChange={(e) => setNewPosition({ ...newPosition, description: e.target.value })}
                        placeholder="e.g., Apple Inc."
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quantity <span className="text-red-500 dark:text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={newPosition.quantity}
                        onChange={(e) => setNewPosition({ ...newPosition, quantity: e.target.value })}
                        placeholder="e.g., 100"
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Asset Type
                      </label>
                      <select
                        value={newPosition.assetType}
                        onChange={(e) => setNewPosition({ ...newPosition, assetType: e.target.value as any })}
                        className="input"
                      >
                        <option value="stock">Stock</option>
                        <option value="etf">ETF</option>
                        <option value="mutual_fund">Mutual Fund</option>
                        <option value="bond">Bond</option>
                        <option value="crypto">Cryptocurrency</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cost Basis (optional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPosition.costBasis}
                        onChange={(e) => setNewPosition({ ...newPosition, costBasis: e.target.value })}
                        placeholder="e.g., 15000.00"
                        className="input"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave blank to use current value</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Current Value <span className="text-red-500 dark:text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPosition.currentValue}
                        onChange={(e) => setNewPosition({ ...newPosition, currentValue: e.target.value })}
                        placeholder="e.g., 18000.00"
                        className="input"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddPosition(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingPosition}
                      className="btn btn-primary"
                    >
                      {addingPosition ? 'Adding...' : 'Add Position'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Positions Table */}
            {positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Symbol</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Quantity</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Value</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Price</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Today's Change</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Total Gain/Loss</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => {
                      const currentPrice = pos.currentPrice ?? (pos.quantity > 0 ? pos.currentValue / pos.quantity : 0);
                      const dailyChange = pos.dailyChange ?? 0;
                      const dailyChangeAmount = pos.dailyChangeAmount ?? 0;
                      const gainLoss = pos.currentValue - pos.costBasis;
                      const gainLossPercent = pos.costBasis > 0 ? (gainLoss / pos.costBasis) * 100 : 0;
                      const isRefreshing = refreshingPositions.has(pos.id);
                      
                      return (
                        <tr key={pos.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-mono font-bold text-blue-600 dark:text-blue-400">{pos.symbol}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{pos.assetType}</p>
                              </div>
                              {(pos.assetType === 'stock' || pos.assetType === 'etf' || pos.assetType === 'mutual_fund' || pos.assetType === 'crypto') && (
                                <button
                                  onClick={() => handleRefreshPrice(pos.id, pos.symbol, pos.quantity, pos.assetType)}
                                  disabled={isRefreshing}
                                  className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Refresh current market value"
                                >
                                  <RefreshCw 
                                    size={14} 
                                    className={isRefreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400'}
                                  />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium dark:text-gray-100">{pos.quantity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                          <td className="py-3 px-4 text-right font-medium dark:text-gray-100">${pos.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 px-4 text-right font-medium dark:text-gray-100">${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className={`py-3 px-4 text-right font-medium text-sm ${dailyChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            <div>{dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)}%</div>
                            <div className="text-xs">${dailyChangeAmount >= 0 ? '+' : ''}{dailyChangeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          </td>
                          <td className={`py-3 px-4 text-right font-medium text-sm ${gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            <div>{gainLoss >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%</div>
                            <div className="text-xs">${gainLoss >= 0 ? '+' : ''}{gainLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setEditingPosition(pos)}
                                className="p-2 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                                title="Edit position"
                              >
                                <Edit2 size={16} className="text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400" />
                              </button>
                              <button
                                onClick={() => handleDeletePosition(pos.id, pos.symbol)}
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
            ) : (
              !showAddPosition && (
                <div className="text-center py-12">
                  <Package size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No positions yet</p>
                  <button
                    onClick={() => setShowAddPosition(true)}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Add Your First Position
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Edit Position Modal */}
      {editingPosition && (
        <EditPositionModal
          position={editingPosition}
          onClose={() => setEditingPosition(null)}
          onSuccess={() => {
            setEditingPosition(null);
            fetchAccountData();
          }}
        />
      )}
    </div>
  );
}
