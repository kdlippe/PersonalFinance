'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Account, Transaction, AccountSummary, Position, NetWorthSnapshot } from '@/lib/types';
import RecentTransactions from '@/components/RecentTransactions';
import PositionDetailModal from '@/components/PositionDetailModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart, BarChart, Bar, ComposedChart } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Settings, PiggyBank, CreditCard, Building2, Coins, Info, ChevronRight } from 'lucide-react';

type TimePeriod = '7d' | '30d' | '90d' | '1y' | 'all';

export default function Dashboard() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [netWorthSnapshots, setNetWorthSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30d');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [positionDetailModalOpen, setPositionDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh data when user returns to the page tab
  useEffect(() => {
    const handleFocus = () => {
      console.log('Dashboard gained focus - refreshing data...');
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, transactionsRes, positionsRes, historyRes] = await Promise.all([
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/transactions?all=true', { cache: 'no-store' }),
        fetch('/api/positions', { cache: 'no-store' }),
        fetch('/api/net-worth-history?days=0', { cache: 'no-store' }),
      ]);

      const accountsData = await accountsRes.json();
      const transactionsData = await transactionsRes.json();
      const positionsData = await positionsRes.json();
      const historyData = await historyRes.json();

      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      setPositions(Array.isArray(positionsData) ? positionsData : []);
      setNetWorthSnapshots(Array.isArray(historyData.snapshots) ? historyData.snapshots : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setAccounts([]);
      setTransactions([]);
      setPositions([]);
      setNetWorthSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to parse date string as local time (avoid UTC timezone shift)
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Get latest snapshot for net worth data (single source of truth)
  // Sort by date descending to ensure we have the most recent snapshot
  const sortedSnapshots = [...netWorthSnapshots].sort((a, b) => b.date.localeCompare(a.date));
  const latestSnapshot = sortedSnapshots.length > 0 
    ? sortedSnapshots[0]
    : null;

  // Calculate current account breakdowns from actual accounts
  const currentTotalAssets = Array.isArray(accounts)
    ? accounts
        .filter(a => ['checking', 'savings', 'brokerage', 'investment', 'crypto'].includes(a.type))
        .reduce((sum, a) => sum + a.balance, 0)
    : 0;
    
  const currentRetirementAssets = Array.isArray(accounts)
    ? accounts
        .filter(a => a.type === 'retirement')
        .reduce((sum, a) => sum + a.balance, 0)
    : 0;
    
  const currentTotalLiabilities = Array.isArray(accounts)
    ? accounts
        .filter(a => ['credit_card', 'loan'].includes(a.type))
        .reduce((sum, a) => sum + Math.abs(a.balance), 0)
    : 0;

  const summary: AccountSummary = {
    // Always use current account data for real-time accuracy
    totalAssets: currentTotalAssets,
    totalLiabilities: currentTotalLiabilities,
    netWorth: currentTotalAssets + currentRetirementAssets - currentTotalLiabilities,
    accountsByType: {} as any,
  };
  
  const retirementAssets = currentRetirementAssets;

  const accountTypeData = Array.isArray(accounts) 
    ? accounts.reduce((acc, account) => {
        const existing = acc.find(item => item.name === account.type);
        if (existing) {
          existing.value += Math.abs(account.balance);
        } else {
          acc.push({ name: account.type, value: Math.abs(account.balance) });
        }
        return acc;
      }, [] as { name: string; value: number }[])
    : [];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Get investment account positions
  const investmentAccounts = accounts.filter(a => ['brokerage', 'investment', 'retirement', 'crypto'].includes(a.type));
  const hasPositions = positions.length > 0;
  
  // Calculate total portfolio value and gain/loss
  const totalPortfolioValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
  const totalGainLoss = totalPortfolioValue - totalCostBasis;
  const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  
  // Calculate daily return - calculate dynamically from priceChange * quantity
  const totalDailyReturn = positions.reduce((sum, p) => sum + ((p.priceChange ?? 0) * p.quantity), 0);
  const totalDailyReturnPercent = totalPortfolioValue > 0 ? (totalDailyReturn / totalPortfolioValue) * 100 : 0;

  // Calculate net worth trend over time using snapshots
  const getNetWorthTrend = () => {
    const now = new Date();
    const periodDays: Record<TimePeriod, number | null> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
      'all': null,
    };
    
    const days = periodDays[selectedPeriod];
    const startDateStr = days !== null
      ? (() => { const d = new Date(now); d.setDate(d.getDate() - days); return d.toISOString().split('T')[0]; })()
      : null;
    
    // Filter snapshots within the selected period and sort by date
    const periodSnapshots = netWorthSnapshots
      .filter(s => startDateStr === null || s.date >= startDateStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Convert to chart data - only use snapshot data (single source of truth)
    const trendData = periodSnapshots.map(s => {
      // Parse date as local time to avoid timezone shifts
      const [year, month, day] = s.date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      
      return {
        date: s.date,
        netWorth: s.netWorth,
        label: localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullLabel: localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    });
    
    return trendData;
  };

  const netWorthTrend = getNetWorthTrend();
  const netWorthChange = netWorthTrend.length > 1 
    ? netWorthTrend[netWorthTrend.length - 1].netWorth - netWorthTrend[0].netWorth 
    : 0;
  const netWorthChangePercent = netWorthTrend.length > 1 && netWorthTrend[0].netWorth !== 0
    ? (netWorthChange / Math.abs(netWorthTrend[0].netWorth)) * 100
    : 0;

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-300">Overview of your financial accounts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/accounts?filter=non-retirement" className="card hover:shadow-lg hover:ring-2 hover:ring-green-400 dark:hover:ring-green-500 transition-all cursor-pointer">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Non-Retirement Assets</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            ${summary.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </Link>
        <Link href="/accounts?filter=retirement" className="card hover:shadow-lg hover:ring-2 hover:ring-purple-400 dark:hover:ring-purple-500 transition-all cursor-pointer">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Retirement Assets</h3>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            ${retirementAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </Link>
        <Link href="/accounts?filter=liabilities" className="card hover:shadow-lg hover:ring-2 hover:ring-red-400 dark:hover:ring-red-500 transition-all cursor-pointer">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Total Liabilities</h3>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
            ${summary.totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </Link>
        <Link href="/accounts?filter=total" className="card hover:shadow-lg hover:ring-2 hover:ring-blue-400 dark:hover:ring-blue-500 transition-all cursor-pointer">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Total Assets</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            ${summary.netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </Link>
      </div>

      {/* Net Worth Trend & Income vs Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Worth Trend */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Net Worth Trend</h2>
                <Link 
                  href="/net-worth-settings" 
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Configure automatic daily updates"
                >
                  <Settings size={16} />
                </Link>
              </div>
              <div className="flex items-center gap-2 mt-1">
              <span className={`text-sm font-medium flex items-center gap-1 ${netWorthChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {netWorthChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {netWorthChange >= 0 ? '+' : ''}${netWorthChange.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className="text-xs">({netWorthChange >= 0 ? '+' : ''}{netWorthChangePercent.toFixed(2)}%)</span>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedPeriod === '7d' ? 'past 7 days' : 
                 selectedPeriod === '30d' ? 'past 30 days' : 
                 selectedPeriod === '90d' ? 'past 90 days' : 
                 selectedPeriod === '1y' ? 'past year' : 'all time'}
              </span>
            </div>
          </div>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {(['7d', '30d', '90d', '1y', 'all'] as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  selectedPeriod === period
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {period === '7d' ? '7D' : period === '30d' ? '30D' : period === '90d' ? '90D' : period === '1y' ? '1Y' : 'All'}
              </button>
            ))}
          </div>
        </div>
        {netWorthTrend.length >= 1 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={netWorthTrend}>
              <defs>
                <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="label" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#6b7280' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#6b7280' }}
                domain={['dataMin - 5%', 'dataMax + 5%']}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ''}
                formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Net Worth']}
              />
              <Area 
                type="monotone" 
                dataKey="netWorth" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorNetWorth)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Calendar size={48} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No net worth data available</p>
              <p className="text-xs mt-1">Import transactions or positions to start tracking</p>
            </div>
          </div>
        )}
        </div>

        {/* Income vs Expenses */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Income vs Expenses (2026)</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Monthly cash flow (excludes retirement accounts)</p>
            </div>
            <Link href="/transactions" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
              View Transactions →
            </Link>
          </div>
        {(() => {
          const currentYear = new Date().getFullYear();
          
          // Get non-retirement accounts
          const nonRetirementAccountIds = accounts
            .filter(a => a.type !== 'retirement')
            .map(a => a.id);
          
          // Calculate monthly income and expenses for current year (excluding retirement accounts)
          const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            month: new Date(currentYear, i).toLocaleDateString('en-US', { month: 'short' }),
            monthNum: i,
            income: 0,
            expenses: 0,
            net: 0,
          }));
          
          transactions.forEach(t => {
            // Skip transactions from retirement accounts
            if (!nonRetirementAccountIds.includes(t.accountId)) return;
            
            const transactionDate = parseLocalDate(t.date);
            if (transactionDate.getFullYear() !== currentYear) return;
            
            const monthIndex = transactionDate.getMonth();
            if (monthIndex < 0 || monthIndex > 11) return;
            
            if (t.type === 'income' && t.amount > 0) {
              monthlyData[monthIndex].income += t.amount;
            } else if (t.type === 'expense') {
              monthlyData[monthIndex].expenses -= t.amount; // negative = expense, positive = refund (offsets)
            }
          });
          
          // Calculate net for each month
          monthlyData.forEach(month => {
            month.net = month.income - month.expenses;
          });
          
          // Calculate totals
          const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
          const totalExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0);
          const totalNet = totalIncome - totalExpenses;
          
          // Calculate average monthly values
          const currentMonth = new Date().getMonth();
          const monthsWithData = monthlyData.slice(0, currentMonth + 1);
          const avgMonthlyIncome = monthsWithData.length > 0 
            ? monthsWithData.reduce((sum, m) => sum + m.income, 0) / monthsWithData.length 
            : 0;
          const avgMonthlyExpenses = monthsWithData.length > 0 
            ? monthsWithData.reduce((sum, m) => sum + m.expenses, 0) / monthsWithData.length 
            : 0;
          
          return (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Total Income YTD</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">${(totalIncome / 1000).toFixed(1)}k</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Avg: ${(avgMonthlyIncome / 1000).toFixed(1)}k/mo</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium mb-1">Total Expenses YTD</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">${(totalExpenses / 1000).toFixed(1)}k</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Avg: ${(avgMonthlyExpenses / 1000).toFixed(1)}k/mo</p>
                </div>
              </div>
              
              {/* Chart */}
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#6b7280' }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={30}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Net Cash Flow"
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          );
        })()}
        </div>
      </div>

      {/* Investment Portfolio Summary */}
      {hasPositions && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Investment Portfolio</h2>
            <Link href="/portfolio" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
              View All Holdings →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Total Value</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Total Holdings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{positions.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{investmentAccounts.length} accounts</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Daily Return</p>
              <p className={`text-2xl font-bold flex items-center gap-1 ${totalDailyReturn > 0 ? 'text-green-600 dark:text-green-400' : totalDailyReturn < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {totalDailyReturn >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                {totalDailyReturn >= 0 ? '+' : ''}${totalDailyReturn.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className="text-sm">({totalDailyReturn >= 0 ? '+' : ''}{totalDailyReturnPercent.toFixed(2)}%)</span>
              </p>
            </div>
          </div>
          
          {/* Top Holdings */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Top Holdings</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Symbol</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Accounts</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Quantity</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Value</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Price</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Price Change</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600 dark:text-gray-300">Today's Change</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Aggregate positions by symbol
                    const aggregatedPositions = positions.reduce((acc, position) => {
                      const symbol = position.symbol;
                      
                      if (!acc[symbol]) {
                        acc[symbol] = {
                          symbol: symbol,
                          accountIds: new Set<number>(),
                          totalQuantity: 0,
                          totalValue: 0,
                          totalCostBasis: 0,
                          totalDailyChangeAmount: 0,
                          positions: [], // Store original positions for modal
                        };
                      }
                      
                      acc[symbol].accountIds.add(position.accountId);
                      acc[symbol].totalQuantity += position.quantity;
                      acc[symbol].totalValue += position.currentValue;
                      acc[symbol].totalCostBasis += position.costBasis;
                      acc[symbol].totalDailyChangeAmount += (position.priceChange ?? 0) * position.quantity;
                      acc[symbol].positions.push(position);
                      
                      return acc;
                    }, {} as Record<string, {
                      symbol: string;
                      accountIds: Set<number>;
                      totalQuantity: number;
                      totalValue: number;
                      totalCostBasis: number;
                      totalDailyChangeAmount: number;
                      positions: Position[];
                    }>);
                    
                    // Convert to array and sort by total value
                    const sortedAggregatedPositions = Object.values(aggregatedPositions)
                      .sort((a, b) => b.totalValue - a.totalValue)
                      .slice(0, 10);
                    
                    return sortedAggregatedPositions.map((aggregated) => {
                      const currentPrice = aggregated.totalQuantity > 0 ? aggregated.totalValue / aggregated.totalQuantity : 0;
                      const dailyPriceChange = aggregated.totalQuantity > 0 ? aggregated.totalDailyChangeAmount / aggregated.totalQuantity : 0;
                      const dailyChangePercent = aggregated.totalValue > 0 ? (aggregated.totalDailyChangeAmount / aggregated.totalValue) * 100 : 0;
                      
                      // Check if this is a cash position
                      const isCash = aggregated.positions[0]?.assetType?.toLowerCase() === 'cash' || 
                                     aggregated.symbol.toUpperCase().includes('CASH');
                      
                      // Get account names for display
                      const accountNames = Array.from(aggregated.accountIds)
                        .map(id => accounts.find(a => a.id === id)?.name || 'Unknown')
                        .join(', ');
                      const accountDisplay = aggregated.accountIds.size === 1 
                        ? accountNames 
                        : `${aggregated.accountIds.size} accounts`;
                      
                      return (
                        <tr 
                          key={aggregated.symbol} 
                          className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          onClick={() => {
                            // Pass all positions for this symbol to show aggregated view
                            setSelectedPosition(aggregated.positions.length > 1 ? aggregated.positions as any : aggregated.positions[0]);
                            setPositionDetailModalOpen(true);
                          }}
                          title={aggregated.accountIds.size > 1 ? accountNames : undefined}
                        >
                          <td className="py-2 px-3">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{aggregated.symbol}</span>
                          </td>
                          <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-300">{accountDisplay}</td>
                          <td className="py-2 px-3 text-right text-sm">{aggregated.totalQuantity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                          <td className="py-2 px-3 text-right font-medium">${aggregated.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="py-2 px-3 text-right text-sm text-gray-700 dark:text-gray-300">
                            {isCash ? 'N/A' : `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          </td>
                          <td className={`py-2 px-3 text-right font-medium ${isCash ? 'text-gray-500 dark:text-gray-400' : dailyPriceChange > 0 ? 'text-green-600 dark:text-green-400' : dailyPriceChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {isCash ? 'N/A' : `${dailyPriceChange >= 0 ? '+' : ''}${dailyPriceChange.toFixed(2)}`}
                          </td>
                          <td className={`py-2 px-3 text-right font-medium text-sm ${isCash ? 'text-gray-500 dark:text-gray-400' : aggregated.totalDailyChangeAmount > 0 ? 'text-green-600 dark:text-green-400' : aggregated.totalDailyChangeAmount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {isCash ? (
                              <div>N/A</div>
                            ) : (
                              <>
                                <div>{dailyChangePercent >= 0 ? '+' : ''}{dailyChangePercent.toFixed(2)}%</div>
                                <div className="text-xs">${aggregated.totalDailyChangeAmount >= 0 ? '+' : ''}{aggregated.totalDailyChangeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Monthly Spending + Investment Mix */}
        <div className="space-y-8">
          {/* Monthly Spending by Category */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Monthly Spending</h2>
              <Link href="/reports" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                View All →
              </Link>
            </div>
            {(() => {
              // Get current month's expense transactions (April 2026)
              const now = new Date();
              const currentYear = now.getFullYear();
              const currentMonth = now.getMonth();
              
              const currentMonthExpenses = transactions.filter(t => {
                if (t.type !== 'expense') return false;
                const transactionDate = parseLocalDate(t.date);
                return transactionDate.getFullYear() === currentYear && 
                       transactionDate.getMonth() === currentMonth;
              });
              
              // Group by category and sum amounts (negative amounts are expenses; skip refunds/credits)
              const spendingByCategory = currentMonthExpenses.reduce((acc, t) => {
                if (t.amount >= 0) return acc; // Skip refunds/credits
                const category = t.category || 'Uncategorized';
                if (!acc[category]) {
                  acc[category] = 0;
                }
                acc[category] += Math.abs(t.amount);
                return acc;
              }, {} as Record<string, number>);
              
              // Convert to array and sort by amount
              const categoryData = Object.entries(spendingByCategory)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 6); // Top 6 categories
              
              const totalSpending = categoryData.reduce((sum, cat) => sum + cat.value, 0);
              
              if (categoryData.length === 0) {
                return (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No expenses this month</p>
                );
              }
              
              return (
                <div>
                  <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total This Month</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">${totalSpending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{currentMonthExpenses.filter(t => t.amount < 0).length} transactions</p>
                  </div>
                  
                  <div className="space-y-2.5">
                    {categoryData.map((category, index) => {
                      const percentage = (category.value / totalSpending) * 100;
                      const categoryTransactions = currentMonthExpenses.filter(t => t.category === category.name && t.amount < 0);
                      const topMerchants = categoryTransactions
                        .reduce((acc, t) => {
                          const merchant = t.merchant || t.description.split(/[-\s]/)[0];
                          if (!acc[merchant]) acc[merchant] = 0;
                          acc[merchant] += t.amount;
                          return acc;
                        }, {} as Record<string, number>);
                      const topMerchantsArray = Object.entries(topMerchants)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3);
                      
                      return (
                        <div key={category.name} className="group relative">
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{category.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCategory(category.name);
                                  setCategoryModalOpen(true);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                                title="Quick view"
                              >
                                <Info size={14} className="text-blue-600 dark:text-blue-400" />
                              </button>
                            </div>
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">${category.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div 
                            className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5"
                          >
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: `rgba(59, 130, 246, ${1 - (index * 0.15)})` // Blue with decreasing opacity
                              }}
                            />
                          </div>
                          <div className="flex justify-between items-center mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{percentage.toFixed(1)}%</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              {categoryTransactions.length} transactions
                            </span>
                          </div>
                          
                          {/* Hover tooltip */}
                          <div className="absolute left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-95 transition-opacity pointer-events-none z-10 min-w-[200px]">
                            <div className="font-semibold mb-1">{category.name}</div>
                            <div className="text-gray-300 mb-1">{categoryTransactions.length} transactions · ${category.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                            {topMerchantsArray.length > 0 && (
                              <>
                                <div className="border-t border-gray-700 my-1"></div>
                                <div className="text-gray-400 text-[10px] mb-0.5">Top merchants:</div>
                                {topMerchantsArray.map(([merchant, amount]) => (
                                  <div key={merchant} className="flex justify-between gap-2 text-[10px]">
                                    <span className="truncate">{merchant}</span>
                                    <span>${amount.toFixed(0)}</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Investment Mix */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Investment Mix</h2>
              {positions.length > 0 ? (
                <>
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={(() => {
                          // Aggregate positions by symbol
                          const holdingsBySymbol = positions.reduce((acc, pos) => {
                            if (!acc[pos.symbol]) {
                              acc[pos.symbol] = { symbol: pos.symbol, value: 0 };
                            }
                            acc[pos.symbol].value += pos.currentValue;
                            return acc;
                          }, {} as Record<string, { symbol: string; value: number }>);
                          
                          const totalValue = Object.values(holdingsBySymbol).reduce((sum, h) => sum + h.value, 0);
                          
                          // Get top holdings
                          let chartData = Object.values(holdingsBySymbol)
                            .map(h => ({
                              name: h.symbol,
                              value: h.value
                            }))
                            .sort((a, b) => b.value - a.value);
                          
                          // Show top 10 holdings individually, group rest as "Other"
                          if (chartData.length > 10) {
                            const top10 = chartData.slice(0, 10);
                            const others = chartData.slice(10);
                            const othersTotal = others.reduce((sum, item) => sum + item.value, 0);
                            
                            if (othersTotal > 0) {
                              chartData = [
                                ...top10,
                                {
                                  name: 'Other',
                                  value: othersTotal
                                }
                              ];
                            }
                          }
                          
                          return chartData;
                        })()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                          // Only show label if slice is >= 5%
                          if (percent < 0.05) return null;
                          
                          const RADIAN = Math.PI / 180;
                          const radius = outerRadius + 15;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          
                          return (
                            <text
                              x={x}
                              y={y}
                              className="fill-gray-700 dark:fill-gray-200"
                              textAnchor={x > cx ? 'start' : 'end'}
                              dominantBaseline="central"
                              style={{ fontSize: '11px', fontWeight: 500 }}
                            >
                              {`${name} ${(percent * 100).toFixed(1)}%`}
                            </text>
                          );
                        }}
                        innerRadius={60}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                      >
                      {(() => {
                        const holdingsBySymbol = positions.reduce((acc, pos) => {
                          if (!acc[pos.symbol]) {
                            acc[pos.symbol] = { symbol: pos.symbol, value: 0 };
                          }
                          acc[pos.symbol].value += pos.currentValue;
                          return acc;
                        }, {} as Record<string, { symbol: string; value: number }>);
                        
                        let chartData = Object.values(holdingsBySymbol)
                          .sort((a, b) => b.value - a.value);
                        
                        const top10 = chartData.slice(0, 10);
                        const others = chartData.slice(10);
                        const othersTotal = others.reduce((sum, item) => sum + item.value, 0);
                        
                        const finalData = chartData.length > 10 && othersTotal > 0
                          ? [...top10, { symbol: 'Other', value: othersTotal }]
                          : chartData;
                        
                        return finalData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ));
                      })()}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Label */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Value</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    ${(totalPortfolioValue / 1000).toFixed(0)}k
                  </p>
                </div>
              </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-300 mb-1 text-xs">Total Holdings</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{positions.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300 mb-1 text-xs">Unique Securities</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {new Set(positions.map(p => p.symbol)).size}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No holdings yet</p>
            )}
          </div>
        </div>

        {/* Right Column: Recent Transactions */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <a href="/transactions" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
              View All
            </a>
          </div>
          <RecentTransactions transactions={transactions.slice(0, 10)} accounts={accounts} />
        </div>
      </div>

      {/* Category Detail Modal */}
      {categoryModalOpen && selectedCategory && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setCategoryModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const now = new Date();
              const currentYear = now.getFullYear();
              const currentMonth = now.getMonth();
              
              const categoryTransactions = transactions.filter(t => {
                if (t.type !== 'expense' || t.category !== selectedCategory || t.amount >= 0) return false;
                const transactionDate = parseLocalDate(t.date);
                return transactionDate.getFullYear() === currentYear && 
                       transactionDate.getMonth() === currentMonth;
              });
              
              const totalAmount = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
              
              return (
                <>  
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedCategory}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                      </div>
                      <button
                        onClick={() => setCategoryModalOpen(false)}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-4 flex items-baseline gap-3">
                      <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {categoryTransactions.length} transactions
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 overflow-y-auto max-h-[50vh]">
                    <div className="space-y-2">
                      {categoryTransactions
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((t) => {
                          const account = accounts.find(a => a.id === t.accountId);
                          return (
                            <div key={t.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-700">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.description}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{account?.name || 'Unknown'}</span>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                  ${Math.abs(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <button
                      onClick={() => {
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        router.push(`/transactions?filterCategory=${encodeURIComponent(selectedCategory)}&filterDateFrom=${year}-${month}-01&filterDateTo=${year}-${month}-${new Date(year, now.getMonth() + 1, 0).getDate()}`);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <span>View All Transactions</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Position Detail Modal */}
      {positionDetailModalOpen && selectedPosition && (
        <PositionDetailModal
          position={selectedPosition}
          accounts={accounts}
          onClose={() => {
            setPositionDetailModalOpen(false);
            setSelectedPosition(null);
          }}
        />
      )}

    </div>
  );
}
