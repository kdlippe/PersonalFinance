import { Transaction, Account, Category } from '@/lib/types';
import { format } from 'date-fns';
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Trash2, Edit2, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';

// Helper function to parse date string without timezone issues
const parseLocalDate = (dateString: string): Date => {
  if (!dateString) return new Date(0);
  const parts = dateString.split('-').map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return new Date(0);
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
};

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  categories?: Category[];
  onDelete?: (id: number) => void;
  onEdit?: (transaction: Transaction) => void;
  onInlineEdit?: (transaction: Transaction) => void;
  onCategoryChange?: (transactionId: number, categoryIdStr: string) => void;
  selectedIds?: Set<number>;
  onSelectOne?: (id: number, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  showBulkSelect?: boolean;
}

export default function TransactionList({ 
  transactions, 
  accounts, 
  categories = [], 
  onDelete, 
  onEdit, 
  onInlineEdit, 
  onCategoryChange,
  selectedIds = new Set(),
  onSelectOne,
  onSelectAll,
  showBulkSelect = false
}: TransactionListProps) {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<{ id: number; field: string } | null>(null);
  const [editedValues, setEditedValues] = useState<{ category?: string; categoryId?: number; description?: string; type?: string }>({});
  const [showRuleCreator, setShowRuleCreator] = useState(false);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleField, setRuleField] = useState<'description' | 'merchant'>('description');
  const [ruleMatchType, setRuleMatchType] = useState<'contains' | 'regex'>('contains');

  useEffect(() => {
    // Fetch all transactions to get used categories
    fetch('/api/transactions?limit=10000')
      .then(res => res.json())
      .then(data => setAllTransactions(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching transactions:', err));
  }, []);

  // Get unique categories from all transactions
  const usedCategories = Array.from(
    new Set(allTransactions.map(t => t.category))
  ).filter(cat => cat && cat.trim() !== '');

  const getAccountName = (accountId: number) => {
    return accounts.find(a => a.id === accountId)?.name || 'Unknown';
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <ArrowUpCircle className="text-green-600" size={20} />;
      case 'expense':
        return <ArrowDownCircle className="text-red-600" size={20} />;
      case 'transfer':
        return <ArrowRightLeft className="text-blue-600" size={20} />;
      default:
        return null;
    }
  };

  const handleCategoryChange = async (transactionId: number, categoryIdStr: string) => {
    if (onCategoryChange) {
      await onCategoryChange(transactionId, categoryIdStr);
    }
    setEditingField(null);
    setEditedValues({});
  };

  const handleDescriptionChange = async (transaction: Transaction, newDescription: string) => {
    if (onInlineEdit) {
      await onInlineEdit({ ...transaction, description: newDescription });
    }
    setEditingField(null);
    setEditedValues({});
  };

  const handleRowClick = (transactionId: number) => {
    if (expandedId === transactionId) {
      setExpandedId(null);
      setShowRuleCreator(false);
      setEditingField(null);
      setEditedValues({});
    } else {
      setExpandedId(transactionId);
      setShowRuleCreator(false);
      setEditingField(null);
      setEditedValues({});
    }
  };

  const handleCreateRule = async (transaction: Transaction) => {
    // Prefer matching by categoryId to avoid name collisions (e.g. two "Food" categories)
    const category = transaction.categoryId
      ? categories.find(c => c.id === transaction.categoryId)
      : categories.find(c => c.name === transaction.category);
    if (!category) {
      alert('Please select a valid category first');
      return;
    }

    const updatedRules = [
      ...(category.rules || []),
      {
        id: Date.now(),
        pattern: rulePattern,
        field: ruleField,
        matchType: ruleMatchType,
      }
    ];

    try {
      const response = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: category.id,
          name: category.name,
          type: category.type,
          color: category.color,
          rules: updatedRules,
        }),
      });

      if (response.ok) {
        alert(`✅ Auto-categorization rule created!\n\nCategory: ${category.name}\nPattern: ${rulePattern}\nField: ${ruleField}\nMatch Type: ${ruleMatchType}\n\nNew transactions matching this pattern will be automatically categorized.`);
        setShowRuleCreator(false);
        setRulePattern('');
      } else {
        alert('Failed to create rule');
      }
    } catch (error) {
      console.error('Error creating rule:', error);
      alert('Failed to create rule');
    }
  };

  const getCategoriesForType = (type: string) => {
    const predefinedCategories = categories.filter(c => c.type === type);
    
    const allCategories = [...predefinedCategories]
      .sort((a, b) => a.name.localeCompare(b.name));

    // Group categories by parent/child relationships
    const parentCategories = allCategories.filter(c => c.isParent);
    const childCategoriesByParent = allCategories
      .filter(c => c.parentId)
      .reduce((acc, cat) => {
        if (!acc[cat.parentId!]) acc[cat.parentId!] = [];
        acc[cat.parentId!].push(cat);
        return acc;
      }, {} as Record<number, Category[]>);
    const standaloneCategories = allCategories.filter(c => !c.isParent && !c.parentId);

    return { standaloneCategories, parentCategories, childCategoriesByParent };
  };

  if (transactions.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No transactions found</p>;
  }

  const uncategorizedCount = transactions.filter(t => t.category === 'Uncategorized').length;

  return (
    <div className="card">
      {uncategorizedCount > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <div className="w-1 h-8 bg-yellow-400 rounded"></div>
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">{uncategorizedCount}</span> uncategorized transaction{uncategorizedCount !== 1 ? 's' : ''} highlighted in yellow
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              {showBulkSelect && (
                <th className="py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === transactions.length && transactions.length > 0}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
              )}
              <th className="w-8"></th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-200">Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-200">Description</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-200">Account</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-200">Category</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-200">Amount</th>
              {(onDelete || onEdit) && <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-200">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const isExpanded = expandedId === transaction.id;
              const isUncategorized = transaction.category === 'Uncategorized';
              return (
                <>
                  <tr 
                    key={transaction.id} 
                    className={`border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                      isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : 
                      isUncategorized ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-400 dark:border-l-yellow-600' : ''
                    }`}
                    onClick={() => handleRowClick(transaction.id)}
                  >
                    {showBulkSelect && (
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(transaction.id)}
                          onChange={(e) => onSelectOne?.(transaction.id, e.target.checked)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="py-3 px-2 text-gray-400 dark:text-gray-500">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                      {format(parseLocalDate(transaction.date), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{transaction.description}</p>
                          {transaction.merchant && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{transaction.merchant}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                      {getAccountName(transaction.accountId)}
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        // Use categoryId if available to handle duplicate names
                        const category = transaction.categoryId 
                          ? categories.find(c => c.id === transaction.categoryId)
                          : categories.find(c => c.name === transaction.category);
                        const parent = category?.parentId ? categories.find(c => c.id === category.parentId) : null;
                        return (
                          <div className="flex flex-col gap-1">
                            <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full text-center ${
                              transaction.category === 'Uncategorized' 
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700' 
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                            }`}>
                              {transaction.category}
                            </span>
                            {parent && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {parent.name}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${
                      transaction.type === 'transfer' || transaction.type === 'pending' ? 'text-gray-900 dark:text-gray-100' :
                      transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 
                      transaction.type === 'expense' && transaction.amount > 0 ? 'text-green-600 dark:text-green-400' :
                      transaction.type === 'expense' ? 'text-red-600 dark:text-red-400' : 
                      transaction.amount < 0 ? 'text-red-600 dark:text-red-400' :
                      transaction.amount > 0 ? 'text-green-600 dark:text-green-400' :
                      'text-gray-900 dark:text-gray-100'
                    }`}>
                      {transaction.type === 'pending' ? (
                        // Pending/uncategorized: no sign, neutral color until categorized
                        `$${Math.abs(transaction.amount).toFixed(2)}`
                      ) : transaction.type === 'transfer' ? (
                        // For transfers, show amount in white with no sign
                        `$${Math.abs(transaction.amount).toFixed(2)}`
                      ) : (
                        <>
                          {(() => {
                            const isRefund = transaction.type === 'expense' && transaction.amount > 0;
                            return (
                              <>
                                {isRefund ? '+' : transaction.type === 'expense' ? '' : transaction.type === 'income' ? '+' : transaction.amount < 0 ? '' : '+'}
                                ${Math.abs(transaction.amount).toFixed(2)}
                                {isRefund ? ' (refund)' : ''}
                              </>
                            );
                          })()}
                        </>
                      )}
                    </td>
                    {(onDelete || onEdit) && (
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 justify-end">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(transaction)}
                              className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Edit transaction"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(transaction.id)}
                              className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              title="Delete transaction"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  
                  {/* Expanded Row */}
                  {isExpanded && (
                    <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <td colSpan={onDelete || onEdit ? 7 : 6}>
                        <div className="p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-2 gap-4">
                            {/* Description Editing */}
                            <div>
                              <label className="label text-xs">Description</label>
                              {editingField?.id === transaction.id && editingField?.field === 'description' ? (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    className="input input-sm"
                                    defaultValue={transaction.description}
                                    onChange={(e) => setEditedValues({ ...editedValues, description: e.target.value })}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleDescriptionChange(transaction, editedValues.description || transaction.description)}
                                    className="btn btn-primary btn-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingField(null);
                                      setEditedValues({});
                                    }}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => setEditingField({ id: transaction.id, field: 'description' })}
                                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-100"
                                >
                                  {transaction.description}
                                </div>
                              )}
                            </div>

                            {/* Type + Category Editing */}
                            <div>
                              <label className="label text-xs">Type & Category</label>
                              {editingField?.id === transaction.id && editingField?.field === 'category' ? (
                                <div className="space-y-2">
                                  <select
                                    className="input input-sm"
                                    value={editedValues.type ?? transaction.type}
                                    onChange={(e) => setEditedValues({ ...editedValues, type: e.target.value, categoryId: undefined })}
                                  >
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                    <option value="transfer">Transfer</option>
                                  </select>
                                  <select
                                    className="input input-sm"
                                    value={editedValues.categoryId ?? transaction.categoryId ?? ''}
                                    onChange={(e) => setEditedValues({ ...editedValues, categoryId: parseInt(e.target.value) })}
                                    autoFocus
                                  >
                                    <option value="">Select category</option>
                                    
                                    {/* Standalone categories first */}
                                    {getCategoriesForType(editedValues.type ?? transaction.type).standaloneCategories.map((cat) => (
                                      <option key={cat.id || cat.name} value={cat.id}>
                                        {cat.name}
                                      </option>
                                    ))}
                                    
                                    {/* Parent categories with their children */}
                                    {getCategoriesForType(editedValues.type ?? transaction.type).parentCategories.map((parent) => {
                                      const children = getCategoriesForType(editedValues.type ?? transaction.type).childCategoriesByParent[parent.id] || [];
                                      return (
                                        <optgroup key={parent.id} label={`${parent.name}`}>
                                          {children.map((child) => (
                                            <option key={child.id} value={child.id}>
                                              → {child.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      );
                                    })}
                                  </select>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        const newType = editedValues.type ?? transaction.type;
                                        const catId = editedValues.categoryId !== undefined ? editedValues.categoryId : transaction.categoryId;
                                        const categoryObj = categories.find(c => c.id === catId);
                                        if (onInlineEdit) {
                                          await onInlineEdit({
                                            ...transaction,
                                            type: newType as Transaction['type'],
                                            category: categoryObj?.name || transaction.category,
                                            categoryId: categoryObj?.id ?? transaction.categoryId,
                                          });
                                        }
                                        setEditingField(null);
                                        setEditedValues({});
                                      }}
                                      className="btn btn-primary btn-sm"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingField(null);
                                        setEditedValues({});
                                      }}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    setEditingField({ id: transaction.id, field: 'category' });
                                    if (transaction.type === 'pending') {
                                      setEditedValues({ type: 'expense' });
                                    }
                                  }}
                                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-100"
                                >
                                  {(() => {
                                    // Use categoryId if available to handle duplicate names
                                    const category = transaction.categoryId 
                                      ? categories.find(c => c.id === transaction.categoryId)
                                      : categories.find(c => c.name === transaction.category);
                                    const parent = category?.parentId ? categories.find(c => c.id === category.parentId) : null;
                                    return (
                                      <div>
                                        <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full text-center ${
                                          transaction.category === 'Uncategorized' 
                                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700' 
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                                        }`}>
                                          {transaction.category}
                                        </span>
                                        {parent && (
                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Parent: {parent.name}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Additional Details */}
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Merchant:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">{transaction.merchant || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Type:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100 capitalize">{transaction.type}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Date:</span>
                              <span className="ml-2 text-gray-900 dark:text-gray-100">{format(parseLocalDate(transaction.date), 'PPP')}</span>
                            </div>
                          </div>

                          {transaction.notes && (
                            <div className="text-sm">
                              <span className="text-gray-500 dark:text-gray-400">Notes:</span>
                              <p className="mt-1 text-gray-900 dark:text-gray-100">{transaction.notes}</p>
                            </div>
                          )}

                          {/* Auto-Categorization Rule Creator */}
                          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                            {!showRuleCreator ? (
                              <button
                                onClick={() => {
                                  setRulePattern(transaction.merchant || '');
                                  setRuleField(transaction.merchant ? 'merchant' : 'description');
                                  setShowRuleCreator(true);
                                }}
                                className="btn btn-secondary btn-sm flex items-center gap-2"
                              >
                                <Sparkles size={16} />
                                Create Auto-Categorization Rule
                              </button>
                            ) : (
                              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                                <h4 className="font-medium text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                  <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
                                  Create Auto-Categorization Rule for "{transaction.category}"
                                </h4>
                                <p className="text-xs text-gray-600 dark:text-gray-300">
                                  Automatically categorize future transactions that match this pattern
                                </p>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="label text-xs">Match Field</label>
                                    <select
                                      className="input input-sm"
                                      value={ruleField}
                                      onChange={(e) => setRuleField(e.target.value as 'description' | 'merchant')}
                                    >
                                      <option value="description">Description</option>
                                      <option value="merchant">Merchant</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="label text-xs">Match Type</label>
                                    <select
                                      className="input input-sm"
                                      value={ruleMatchType}
                                      onChange={(e) => setRuleMatchType(e.target.value as 'contains' | 'regex')}
                                    >
                                      <option value="contains">Contains</option>
                                      <option value="regex">Regex</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="label text-xs">Pattern</label>
                                  <input
                                    type="text"
                                    className="input input-sm"
                                    value={rulePattern}
                                    onChange={(e) => setRulePattern(e.target.value)}
                                    placeholder={
                                      ruleMatchType === 'contains'
                                        ? ruleField === 'description' 
                                          ? transaction.description.substring(0, 20)
                                          : transaction.merchant || 'merchant name'
                                        : ruleField === 'description'
                                          ? `^${transaction.description.split(' ')[0]}.*`
                                          : `^${transaction.merchant?.split(' ')[0]}.*`
                                    }
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    {ruleMatchType === 'contains'
                                      ? `Will match transactions where ${ruleField} contains this text`
                                      : `Will match transactions where ${ruleField} matches this regex pattern`
                                    }
                                  </p>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleCreateRule(transaction)}
                                    disabled={!rulePattern}
                                    className="btn btn-primary btn-sm"
                                  >
                                    Create Rule
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowRuleCreator(false);
                                      setRulePattern('');
                                    }}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
