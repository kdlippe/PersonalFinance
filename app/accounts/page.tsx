'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Account } from '@/lib/types';
import AccountCard from '@/components/AccountCard';
import AddAccountModal from '@/components/AddAccountModal';
import EditAccountModal from '@/components/EditAccountModal';
import { Plus, X } from 'lucide-react';

const FILTER_CONFIG: Record<string, { label: string; types: string[]; color: string }> = {
  'non-retirement': {
    label: 'Non-Retirement Assets',
    types: ['checking', 'savings', 'brokerage', 'investment', 'crypto'],
    color: 'green',
  },
  'retirement': {
    label: 'Retirement Assets',
    types: ['retirement'],
    color: 'purple',
  },
  'liabilities': {
    label: 'Liabilities',
    types: ['credit_card', 'loan'],
    color: 'red',
  },
  'total': {
    label: 'All Assets',
    types: ['checking', 'savings', 'brokerage', 'investment', 'crypto', 'retirement'],
    color: 'blue',
  },
};

export default function AccountsPage() {
  const searchParams = useSearchParams();
  const filterKey = searchParams.get('filter') ?? null;
  const filterConfig = filterKey ? FILTER_CONFIG[filterKey] ?? null : null;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountHistory, setAccountHistory] = useState<Record<string, { date: string; balance: number }[]>>({});

  useEffect(() => {
    fetchAccounts();
    fetchAccountHistory();
  }, []);

  // Auto-refresh data when user returns to the page tab
  useEffect(() => {
    const handleFocus = () => {
      console.log('Accounts page gained focus - refreshing data...');
      fetchAccounts();
      fetchAccountHistory();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchAccounts = async () => {
    try {
      // Add cache-busting to ensure fresh data
      const res = await fetch('/api/accounts', { cache: 'no-store' });
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountHistory = async () => {
    try {
      const res = await fetch('/api/net-worth-history?days=365', { cache: 'no-store' });
      const histData = await res.json();
      if (!histData.snapshots) return;

      // accountBalances keys are already enriched to current account names by the API
      const snapshots: { date: string; accountBalances?: Record<string, number> }[] = histData.snapshots;

      const byName: Record<string, { date: string; balance: number }[]> = {};
      snapshots.forEach(snapshot => {
        if (!snapshot.accountBalances) return;
        Object.entries(snapshot.accountBalances).forEach(([name, balance]) => {
          if (!byName[name]) byName[name] = [];
          byName[name].push({ date: snapshot.date, balance });
        });
      });

      // Downsample to at most ~52 points per account (weekly for a full year).
      // For accounts with fewer than 90 points, use every point so sparse data
      // still renders a smooth chart.
      const result: Record<string, { date: string; balance: number }[]> = {};
      Object.entries(byName).forEach(([name, points]) => {
        if (points.length <= 90) {
          result[name] = points;
        } else {
          const step = Math.ceil(points.length / 52);
          result[name] = points.filter((_, i) => i % step === 0 || i === points.length - 1);
        }
      });

      setAccountHistory(result);
    } catch (error) {
      console.error('Error fetching account history:', error);
    }
  };

  const handleAccountAdded = () => {
    setShowAddModal(false);
    fetchAccounts();
  };

  const handleAccountEdited = () => {
    setEditingAccount(null);
    fetchAccounts();
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account? All associated transactions will be lost.')) {
      return;
    }

    try {
      await fetch(`/api/accounts?id=${id}`, { method: 'DELETE' });
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account');
    }
  };

  const filteredAccounts = filterConfig
    ? accounts.filter(a => filterConfig.types.includes(a.type))
    : accounts;

  const groupedAccounts = filteredAccounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = [];
    }
    acc[account.type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Accounts</h1>
          {filterConfig ? (
            <div className="flex items-center gap-2">
              <p className="text-gray-600 dark:text-gray-300">Showing: <span className="font-semibold">{filterConfig.label}</span></p>
              <Link href="/accounts" className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 transition-colors">
                <X size={12} /> Clear filter
              </Link>
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-300">Manage your bank accounts, credit cards, and investments</p>
          )}
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Account
        </button>
      </div>

      {Object.keys(groupedAccounts).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
            <div key={type}>
              <h2 className="text-xl font-semibold mb-4 capitalize">
                {type.replace('_', ' ')} ({typeAccounts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {typeAccounts.map((account) => (
                  <AccountCard 
                    key={account.id} 
                    account={account}
                    historicalData={accountHistory[account.name]}
                    onEdit={() => setEditingAccount(account)}
                    onDelete={() => handleDeleteAccount(account.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No accounts yet. Get started by adding your first account.</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            Add Your First Account
          </button>
        </div>
      )}

      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAccountAdded}
        />
      )}

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={handleAccountEdited}
        />
      )}
    </div>
  );
}
