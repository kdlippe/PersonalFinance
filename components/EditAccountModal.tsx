'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Account, AccountType } from '@/lib/types';

interface EditAccountModalProps {
  account: Account;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditAccountModal({ account, onClose, onSuccess }: EditAccountModalProps) {
  const [formData, setFormData] = useState({
    name: account.name,
    type: account.type as AccountType,
    balance: account.balance.toString(),
    currency: account.currency,
    institution: account.institution || '',
    accountNumber: account.accountNumber || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: account.id,
          ...formData,
          balance: parseFloat(formData.balance) || 0,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to update account');
      }
    } catch (error) {
      console.error('Error updating account:', error);
      alert('Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Account</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Account Name *</label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Chase Checking"
            />
          </div>

          <div>
            <label className="label">Account Type *</label>
            <select
              className="input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
              required
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit_card">Credit Card</option>
              <option value="brokerage">Brokerage</option>
              <option value="investment">Investment</option>
              <option value="retirement">Retirement</option>
              <option value="crypto">Crypto</option>
              <option value="loan">Loan</option>
            </select>
          </div>

          <div>
            <label className="label">Balance</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="label">Institution</label>
            <input
              type="text"
              className="input"
              value={formData.institution}
              onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              placeholder="e.g., Chase Bank"
            />
          </div>

          <div>
            <label className="label">Account Number (last 4 digits)</label>
            <input
              type="text"
              className="input"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              placeholder="1234"
              maxLength={4}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
