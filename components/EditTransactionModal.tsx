'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Transaction, Account, Category, TransactionType } from '@/lib/types';

interface EditTransactionModalProps {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTransactionModal({ 
  transaction, 
  accounts, 
  categories, 
  onClose, 
  onSuccess 
}: EditTransactionModalProps) {
  const [formData, setFormData] = useState({
    accountId: transaction.accountId,
    date: transaction.date,
    amount: transaction.amount.toString(),
    type: transaction.type as TransactionType,
    category: transaction.category,
    categoryId: transaction.categoryId,
    description: transaction.description,
    merchant: transaction.merchant || '',
    notes: transaction.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    // Fetch all transactions to get used categories
    fetch('/api/transactions?limit=10000')
      .then(res => res.json())
      .then(data => setAllTransactions(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching transactions:', err));
  }, []);

  // Get unique categories from transactions
  const usedCategories = Array.from(
    new Set(allTransactions.map(t => t.category))
  ).filter(cat => cat && cat.trim() !== '');

  // Get all categories grouped by type
  const getCategoriesByType = (type: TransactionType) => {
    const predefinedCategories = categories.filter(c => c.type === type);
    
    const allCats = [...predefinedCategories]
      .sort((a, b) => a.name.localeCompare(b.name));

    // Group by parent/child relationships
    const parentCats = allCats.filter(c => c.isParent);
    const childCats = allCats
      .filter(c => c.parentId)
      .reduce((acc, cat) => {
        if (!acc[cat.parentId!]) acc[cat.parentId!] = [];
        acc[cat.parentId!].push(cat);
        return acc;
      }, {} as Record<number, Category[]>);
    const standaloneCats = allCats.filter(c => !c.isParent && !c.parentId);

    return { standaloneCats, parentCats, childCats };
  };

  const handleCategoryChange = (categoryIdStr: string) => {
    const categoryId = parseInt(categoryIdStr);
    const selectedCategory = categories.find(c => c.id === categoryId);
    if (selectedCategory) {
      setFormData({
        ...formData,
        category: selectedCategory.name,
        categoryId: selectedCategory.id,
        type: selectedCategory.type
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transaction.id,
          ...formData,
          amount: parseFloat(formData.amount) || 0,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to update transaction');
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Transaction</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Account *</label>
            <select
              className="input"
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: parseInt(e.target.value) })}
              required
            >
              {(() => {
                // Group accounts by type
                const accountsByType = accounts.reduce((acc, account) => {
                  if (!acc[account.type]) {
                    acc[account.type] = [];
                  }
                  acc[account.type].push(account);
                  return acc;
                }, {} as Record<string, Account[]>);

                // Define type labels
                const typeLabels: Record<string, string> = {
                  checking: 'Checking',
                  savings: 'Savings',
                  credit_card: 'Credit Cards',
                  brokerage: 'Brokerage',
                  retirement: 'Retirement',
                  loan: 'Loans',
                  other: 'Other'
                };

                // Sort types in preferred order
                const typeOrder = ['checking', 'savings', 'credit_card', 'brokerage', 'retirement', 'loan', 'other'];
                const sortedTypes = Object.keys(accountsByType).sort((a, b) => {
                  const aIndex = typeOrder.indexOf(a);
                  const bIndex = typeOrder.indexOf(b);
                  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                  if (aIndex === -1) return 1;
                  if (bIndex === -1) return -1;
                  return aIndex - bIndex;
                });

                return sortedTypes.map(type => (
                  <optgroup key={type} label={typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)}>
                    {accountsByType[type].map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </optgroup>
                ));
              })()}
            </select>
          </div>

          <div>
            <label className="label">Date *</label>
            <input
              type="date"
              className="input"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Category *</label>
            <select
              className="input"
              value={formData.categoryId || ''}
              onChange={(e) => handleCategoryChange(e.target.value)}
              required
            >
              <option value="">Select a category</option>
              
              {/* Income Categories */}
              {(() => {
                const { standaloneCats, parentCats, childCats } = getCategoriesByType('income');
                return (
                  <optgroup label="━━━ INCOME ━━━">
                    {standaloneCats.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                    {parentCats.map((parent) => {
                      const children = childCats[parent.id] || [];
                      return [
                        <option key={`parent-${parent.id}`} value={parent.id} disabled style={{ fontWeight: 'bold' }}>
                          ── {parent.name} ──
                        </option>,
                        ...children.map((child) => (
                          <option key={child.id} value={child.id}>
                            &nbsp;&nbsp;→ {child.name}
                          </option>
                        ))
                      ];
                    })}
                  </optgroup>
                );
              })()}
              
              {/* Expense Categories */}
              {(() => {
                const { standaloneCats, parentCats, childCats } = getCategoriesByType('expense');
                return (
                  <optgroup label="━━━ EXPENSE ━━━">
                    {standaloneCats.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                    {parentCats.map((parent) => {
                      const children = childCats[parent.id] || [];
                      return [
                        <option key={`parent-${parent.id}`} value={parent.id} disabled style={{ fontWeight: 'bold' }}>
                          ── {parent.name} ──
                        </option>,
                        ...children.map((child) => (
                          <option key={child.id} value={child.id}>
                            &nbsp;&nbsp;→ {child.name}
                          </option>
                        ))
                      ];
                    })}
                  </optgroup>
                );
              })()}
              
              {/* Transfer Categories */}
              {(() => {
                const { standaloneCats, parentCats, childCats } = getCategoriesByType('transfer');
                return (
                  <optgroup label="━━━ TRANSFER ━━━">
                    {standaloneCats.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                    {parentCats.map((parent) => {
                      const children = childCats[parent.id] || [];
                      return [
                        <option key={`parent-${parent.id}`} value={parent.id} disabled style={{ fontWeight: 'bold' }}>
                          ── {parent.name} ──
                        </option>,
                        ...children.map((child) => (
                          <option key={child.id} value={child.id}>
                            &nbsp;&nbsp;→ {child.name}
                          </option>
                        ))
                      ];
                    })}
                  </optgroup>
                );
              })()}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Type: <span className="font-semibold capitalize">{formData.type}</span>
              {(() => {
                // Use categoryId if available for accurate lookup
                const selectedCategory = formData.categoryId 
                  ? categories.find(c => c.id === formData.categoryId)
                  : categories.find(c => c.name === formData.category);
                if (selectedCategory?.parentId) {
                  const parentCategory = categories.find(c => c.id === selectedCategory.parentId);
                  if (parentCategory) {
                    return (
                      <>
                        {' • '}
                        Parent: <span className="font-semibold">{parentCategory.name}</span>
                      </>
                    );
                  }
                }
                return null;
              })()}
            </p>
          </div>

          <div>
            <label className="label">Amount *</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="label">Description *</label>
            <input
              type="text"
              className="input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              placeholder="e.g., Grocery shopping"
            />
          </div>

          <div>
            <label className="label">Merchant</label>
            <input
              type="text"
              className="input"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              placeholder="e.g., Whole Foods"
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
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
