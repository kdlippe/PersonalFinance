'use client';

import { Account } from '@/lib/types';
import { CreditCard, Building2, PiggyBank, TrendingUp, Wallet, Trash2, Clock, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface HistoricalDataPoint {
  date: string;
  balance: number;
}

interface AccountCardProps {
  account: Account;
  historicalData?: HistoricalDataPoint[];
  onDelete?: () => void;
  onEdit?: () => void;
}

export default function AccountCard({ account, historicalData, onDelete, onEdit }: AccountCardProps) {
  const chartData = historicalData && historicalData.length > 1
    ? historicalData.map(p => ({ date: p.date, balance: p.balance }))
    : null;

  const perfChange = chartData && chartData.length > 1
    ? chartData[chartData.length - 1].balance - chartData[0].balance
    : null;

  const perfPct = chartData && chartData[0].balance !== 0
    ? (perfChange! / Math.abs(chartData[0].balance)) * 100
    : null;

  const isPositive = perfChange !== null ? perfChange >= 0 : true;
  const chartColor = isPositive ? '#16a34a' : '#dc2626';

  const yDomain = chartData
    ? (() => {
        const values = chartData.map(p => p.balance);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const pad = (max - min) * 0.1 || Math.abs(max) * 0.05 || 1;
        return [min - pad, max + pad] as [number, number];
      })()
    : undefined;
  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'checking':
      case 'savings':
        return <PiggyBank size={24} />;
      case 'credit_card':
        return <CreditCard size={24} />;
      case 'brokerage':
      case 'investment':
      case 'retirement':
      case 'crypto':
        return <TrendingUp size={24} />;
      case 'loan':
        return <Building2 size={24} />;
      default:
        return <Wallet size={24} />;
    }
  };

  const getBalanceColor = (type: string, balance: number) => {
    if (type === 'credit_card' || type === 'loan') {
      // Liabilities always show in red
      return 'text-red-600';
    }
    return balance >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getLastUpdatedText = (updatedAt: string) => {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffMs = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Link href={`/accounts/${account.id}`} className="block">
      <div className="card hover:shadow-lg hover:ring-2 hover:ring-blue-400 dark:hover:ring-blue-500 transition-all cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              {getAccountIcon(account.type)}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{account.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{account.type.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit();
                }}
                className="text-gray-400 hover:text-blue-600 transition-colors"
                title="Edit account"
              >
                <Edit2 size={18} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-gray-400 hover:text-red-600 transition-colors"
                title="Delete account"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-600 dark:text-gray-300">Balance</span>
            <span className={`text-2xl font-bold ${getBalanceColor(account.type, account.balance)}`}>
              ${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          
          {account.institution && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <Building2 size={14} className="inline mr-1" />
              {account.institution}
            </p>
          )}
          
          {account.accountNumber && (
            <p className="text-sm text-gray-400 dark:text-gray-500 font-mono">
              ****{account.accountNumber.slice(-4)}
            </p>
          )}
          
          <div className="pt-2 mt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={12} />
              <span>Updated {getLastUpdatedText(account.updatedAt)}</span>
            </p>
          </div>

          {chartData && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">1-Year Performance</span>
                {perfPct !== null && (
                  <span className={`text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{perfPct.toFixed(1)}%
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis domain={yDomain} hide />
                  <defs>
                    <linearGradient id={`grad-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke={chartColor}
                    strokeWidth={1.5}
                    fill={`url(#grad-${account.id})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 'Balance']}
                    labelFormatter={(label: string) => new Date(label + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    contentStyle={{ fontSize: '11px', padding: '4px 8px' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
