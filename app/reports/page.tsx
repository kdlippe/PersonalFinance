'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Transaction, Account, Category } from '@/lib/types';
import { ArrowLeft, TrendingUp, TrendingDown, ChevronDown, ChevronRight, Download, DollarSign, Wallet, Eye, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Helper function to parse date string without timezone issues
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

type TimePeriod = '3m' | '6m' | '12m' | 'ytd' | 'custom';
type ReportTab = 'spending' | 'cashflow';

interface MonthData {
  year: number;
  month: number;
  amount: number;
}

interface CategorySpending {
  categoryName: string;
  categoryId: number;
  isParent: boolean;
  parentId?: number;
  months: MonthData[];
  total: number;
  trend: number; // Percentage change from previous month
  children?: CategorySpending[];
}

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('6m');
  const [accountType, setAccountType] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<ReportTab>('spending');
  const [otherIncomeModalOpen, setOtherIncomeModalOpen] = useState(false);
  const [selectedOtherIncomeMonth, setSelectedOtherIncomeMonth] = useState<{ year: number; month: number; label: string } | null>(null);
  const [incomeDetailModalOpen, setIncomeDetailModalOpen] = useState(false);
  const [selectedIncomeCategory, setSelectedIncomeCategory] = useState<{ categoryName: string; categoryId: number; year: number; month: number; label: string; isOther: boolean } | null>(null);
  const [expenseDetailModalOpen, setExpenseDetailModalOpen] = useState(false);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<{ categoryName: string; categoryId: number; year: number; month: number; label: string; isParent: boolean; childrenIds?: number[] } | null>(null);
  const [savingsRateModalOpen, setSavingsRateModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [transactionsRes, accountsRes, categoriesRes] = await Promise.all([
        fetch('/api/transactions?limit=50000'),
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);

      const [transactionsData, accountsData, categoriesData] = await Promise.all([
        transactionsRes.json(),
        accountsRes.json(),
        categoriesRes.json(),
      ]);

      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Calculate date range based on selected period
  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date();
    let start = new Date();

    switch (timePeriod) {
      case '3m':
        start.setMonth(now.getMonth() - 3);
        start.setDate(1);
        break;
      case '6m':
        start.setMonth(now.getMonth() - 6);
        start.setDate(1);
        break;
      case '12m':
        start.setMonth(now.getMonth() - 12);
        start.setDate(1);
        break;
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(customEndDate)
          };
        }
        start.setMonth(now.getMonth() - 6);
        break;
    }

    return { start, end: now };
  };

  // Filter transactions by date range and account type
  const getFilteredTransactions = (): Transaction[] => {
    const { start, end } = getDateRange();
    
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      if (transactionDate < start || transactionDate > end) return false;
      
      if (accountType !== 'all') {
        const account = accounts.find(a => a.id === t.accountId);
        if (!account || account.type !== accountType) return false;
      }
      
      return t.type === 'expense';
    });
  };

  // Generate list of months in the date range
  const getMonthsList = (): { year: number; month: number; label: string }[] => {
    const { start, end } = getDateRange();
    const months: { year: number; month: number; label: string }[] = [];
    
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endDate = new Date(end.getFullYear(), end.getMonth(), 1);
    
    while (current <= endDate) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth(),
        label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      });
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  // Calculate spending by category
  const calculateCategorySpending = (): CategorySpending[] => {
    const filteredTransactions = getFilteredTransactions();
    const months = getMonthsList();
    const now = new Date();
    const isCompleteMonth = (year: number, month: number) =>
      year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
    
    // Get parent categories (expense type only)
    const parentCategories = categories.filter(c => c.isParent && c.type === 'expense');
    const childCategories = categories.filter(c => c.parentId && c.type === 'expense');
    const standaloneCategories = categories.filter(c => !c.isParent && !c.parentId && c.type === 'expense');
    
    const result: CategorySpending[] = [];
    
    // Process parent categories with their children
    parentCategories.forEach(parent => {
      const children = childCategories.filter(c => c.parentId === parent.id);
      
      // Calculate parent's own spending (sum of all children)
      const parentMonths = months.map(({ year, month }) => {
        // Use string comparison to avoid timezone issues
        const monthStr = String(month + 1).padStart(2, '0');
        const datePrefix = `${year}-${monthStr}`;
        
        const amount = filteredTransactions
          .filter(t => {
            if (!t.date.startsWith(datePrefix)) {
              return false;
            }
            // Match by ID only - don't match by name to avoid duplicates
            return t.categoryId === parent.id || 
                   children.some(c => c.id === t.categoryId);
          })
          .reduce((sum, t) => sum + t.amount, 0);
        
        return { year, month, amount };
      });
      
      const parentTotal = parentMonths.reduce((sum, m) => sum + m.amount, 0);
      const completedParentMonths = parentMonths.filter(m => isCompleteMonth(m.year, m.month));
      const lastTwo = completedParentMonths.slice(-2);
      const parentTrend = lastTwo.length === 2 && lastTwo[0].amount !== 0
        ? ((lastTwo[1].amount - lastTwo[0].amount) / Math.abs(lastTwo[0].amount)) * 100
        : 0;
      
      // Calculate children
      const childrenData: CategorySpending[] = children.map(child => {
        const childMonths = months.map(({ year, month }) => {
          // Use string comparison to avoid timezone issues
          const monthStr = String(month + 1).padStart(2, '0');
          const datePrefix = `${year}-${monthStr}`;
          
          const amount = filteredTransactions
            .filter(t => {
              if (!t.date.startsWith(datePrefix)) {
                return false;
              }
              // Match by ID only - don't match by name to avoid duplicates
              return t.categoryId === child.id;
            })
            .reduce((sum, t) => sum + t.amount, 0);
          
          return { year, month, amount };
        });
        
        const childTotal = childMonths.reduce((sum, m) => sum + m.amount, 0);
        const completedChildMonths = childMonths.filter(m => isCompleteMonth(m.year, m.month));
        const lastTwo = completedChildMonths.slice(-2);
        const childTrend = lastTwo.length === 2 && lastTwo[0].amount !== 0
          ? ((lastTwo[1].amount - lastTwo[0].amount) / Math.abs(lastTwo[0].amount)) * 100
          : 0;
        
        return {
          categoryName: child.name,
          categoryId: child.id,
          isParent: false,
          parentId: parent.id,
          months: childMonths,
          total: childTotal,
          trend: childTrend
        };
      });
      
      // Include parent category if it has any activity (positive or negative)
      if (parentTotal !== 0 || parentMonths.some(m => m.amount !== 0)) {
        result.push({
          categoryName: parent.name,
          categoryId: parent.id,
          isParent: true,
          months: parentMonths,
          total: parentTotal,
          trend: parentTrend,
          children: childrenData
        });
      }
    });
    
    // Process standalone categories
    standaloneCategories.forEach(category => {
      const categoryMonths = months.map(({ year, month }) => {
        // Use string comparison to avoid timezone issues
        const monthStr = String(month + 1).padStart(2, '0');
        const datePrefix = `${year}-${monthStr}`;
        
        const amount = filteredTransactions
          .filter(t => {
            if (!t.date.startsWith(datePrefix)) {
              return false;
            }
            // Match by ID only - don't match by name to avoid duplicates
            return t.categoryId === category.id;
          })
          .reduce((sum, t) => sum + t.amount, 0);
        
        return { year, month, amount };
      });
      
      const categoryTotal = categoryMonths.reduce((sum, m) => sum + m.amount, 0);
      const completedCategoryMonths = categoryMonths.filter(m => isCompleteMonth(m.year, m.month));
      const lastTwo = completedCategoryMonths.slice(-2);
      const trend = lastTwo.length === 2 && lastTwo[0].amount !== 0
        ? ((lastTwo[1].amount - lastTwo[0].amount) / Math.abs(lastTwo[0].amount)) * 100
        : 0;
      
      // Include category if it has any activity (positive or negative)
      if (categoryTotal !== 0 || categoryMonths.some(m => m.amount !== 0)) {
        result.push({
          categoryName: category.name,
          categoryId: category.id,
          isParent: false,
          months: categoryMonths,
          total: categoryTotal,
          trend
        });
      }
    });
    
    // Sort alphabetically, with "Other" always at the bottom
    return result.sort((a, b) => {
      const aOther = a.categoryName.toLowerCase() === 'other';
      const bOther = b.categoryName.toLowerCase() === 'other';
      if (aOther && !bOther) return 1;
      if (!aOther && bOther) return -1;
      return a.categoryName.localeCompare(b.categoryName);
    });
  };

  const categorySpending = calculateCategorySpending();
  const months = getMonthsList();
  
  // Calculate totals for each month
  const monthlyTotals = months.map(({ year, month }) => {
    const total = categorySpending.reduce((sum, cat) => {
      const monthData = cat.months.find(m => m.year === year && m.month === month);
      return sum + (monthData?.amount || 0);
    }, 0);
    return total;
  });

  const accountTypes = [
    { value: 'all', label: 'All Accounts' },
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
    { value: 'credit_card', label: 'Credit Cards' },
  ];

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">Financial Reports</h1>
            <p className="text-gray-600 dark:text-gray-300">Analyze spending, income, and cash flow trends</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('spending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'spending'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingDown size={18} />
              Spending Analysis
            </div>
          </button>
          <button
            onClick={() => setActiveTab('cashflow')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'cashflow'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Wallet size={18} />
              Cash Flow
            </div>
          </button>
        </nav>
      </div>

      {/* Spending Analysis Tab */}
      {activeTab === 'spending' && (
        <>
          {/* Filters */}
          <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Time Period</label>
            <select
              className="input"
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
            >
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="12m">Last 12 Months</option>
              <option value="ytd">Year to Date</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div>
            <label className="label">Account Type</label>
            <select
              className="input"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
            >
              {accountTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {timePeriod === 'custom' && (
            <>
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Month-over-Month Table */}
      <div className="card overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">Category Spending by Month</h2>
        
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-300 dark:border-gray-600">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10">Category</th>
              {months.map((m, idx) => (
                <th key={idx} className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {m.label}
                </th>
              ))}
              <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Total</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300" title="Change between last 2 complete months">MoM Trend</th>
            </tr>
          </thead>
          <tbody>
            {categorySpending.map((cat) => (
              <>
                {/* Parent/Standalone Category Row */}
                <tr 
                  key={cat.categoryId}
                  className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 group ${
                    cat.isParent ? 'bg-gray-50 dark:bg-gray-800 font-medium cursor-pointer' : ''
                  }`}
                  onClick={() => cat.isParent && cat.children && cat.children.length > 0 && toggleCategory(cat.categoryId)}
                >
                  <td className="py-3 px-4 sticky left-0 bg-inherit z-10">
                    <div className="flex items-center gap-2">
                      {cat.isParent && cat.children && cat.children.length > 0 && (
                        expandedCategories.has(cat.categoryId) 
                          ? <ChevronDown size={16} className="text-gray-400 dark:text-gray-500" />
                          : <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
                      )}
                      <span className="dark:text-gray-100">{cat.categoryName}</span>
                      {cat.isParent && cat.children && cat.children.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">({cat.children.length})</span>
                      )}
                    </div>
                  </td>
                  {cat.months.map((m, idx) => (
                    <td 
                      key={idx} 
                      className={`text-right py-3 px-4 whitespace-nowrap ${m.amount !== 0 ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30' : ''}`}
                      onClick={(e) => {
                        if (m.amount !== 0) {
                          e.stopPropagation();
                          setSelectedExpenseCategory({
                            categoryName: cat.categoryName,
                            categoryId: cat.categoryId,
                            year: m.year,
                            month: m.month,
                            label: months[idx].label,
                            isParent: cat.isParent,
                            childrenIds: cat.children?.map(c => c.categoryId)
                          });
                          setExpenseDetailModalOpen(true);
                        }
                      }}
                    >
                      {m.amount !== 0 ? (
                        <span className={`flex items-center justify-end gap-1 ${m.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {m.amount > 0 ? '+' : ''}${Math.abs(m.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          <Eye size={14} className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100" />
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                  ))}

                  <td className={`text-right py-3 px-4 whitespace-nowrap ${cat.total > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}>
                    {cat.total > 0 ? '+' : ''}${Math.abs(cat.total).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="text-right py-3 px-4 whitespace-nowrap">
                    {cat.trend !== 0 ? (
                      <div className={`flex items-center justify-end gap-1 ${
                        cat.trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      } ${Math.abs(cat.trend) > 20 ? 'font-bold' : ''}`}>
                        {cat.trend < 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {Math.abs(cat.trend).toFixed(0)}%
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>
                </tr>

                {/* Child Categories */}
                {cat.isParent && cat.children && expandedCategories.has(cat.categoryId) && (
                  cat.children.map(child => (
                    <tr 
                      key={child.categoryId}
                      className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 group"
                    >
                      <td className="py-2 px-4 pl-12 text-sm sticky left-0 bg-inherit z-10 dark:text-gray-100">
                        {child.categoryName}
                      </td>
                      {child.months.map((m, idx) => (
                        <td 
                          key={idx} 
                          className={`text-right py-2 px-4 text-sm whitespace-nowrap ${m.amount !== 0 ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30' : ''}`}
                          onClick={(e) => {
                            if (m.amount !== 0) {
                              e.stopPropagation();
                              setSelectedExpenseCategory({
                                categoryName: child.categoryName,
                                categoryId: child.categoryId,
                                year: m.year,
                                month: m.month,
                                label: months[idx].label,
                                isParent: false
                              });
                              setExpenseDetailModalOpen(true);
                            }
                          }}
                        >
                          {m.amount !== 0 ? (
                            <span className={`flex items-center justify-end gap-1 ${m.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {m.amount > 0 ? '+' : ''}${Math.abs(m.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              <Eye size={14} className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100" />
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                      ))}
                      <td className={`text-right py-2 px-4 text-sm whitespace-nowrap ${child.total > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}>
                        {child.total > 0 ? '+' : ''}${Math.abs(child.total).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right py-2 px-4 text-sm whitespace-nowrap">
                        {child.trend !== 0 ? (
                          <div className={`flex items-center justify-end gap-1 ${
                            child.trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                          } ${Math.abs(child.trend) > 20 ? 'font-bold' : ''}`}>
                            {child.trend < 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {Math.abs(child.trend).toFixed(0)}%
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </>
            ))}

            {/* Total Row */}
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-blue-50 dark:bg-blue-900/20 font-bold">
              <td className="py-3 px-4 sticky left-0 bg-blue-50 dark:bg-blue-900/20 z-10 dark:text-gray-100">TOTAL</td>
              {monthlyTotals.map((total, idx) => (
                <td key={idx} className="text-right py-3 px-4 whitespace-nowrap">
                  ${Math.abs(total).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              ))}
              <td className="text-right py-3 px-4 whitespace-nowrap">
                ${Math.abs(monthlyTotals.reduce((sum, t) => sum + t, 0)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
              <td className="text-right py-3 px-4 whitespace-nowrap">
                {(() => {
                  const completedTotals = months
                    .map(({ year, month }, idx) => ({ year, month, total: monthlyTotals[idx] }))
                    .filter(m => m.year < new Date().getFullYear() || (m.year === new Date().getFullYear() && m.month < new Date().getMonth()));
                  const lt = completedTotals.slice(-2);
                  if (lt.length === 2 && lt[0].total !== 0) {
                    const pct = ((lt[1].total - lt[0].total) / Math.abs(lt[0].total)) * 100;
                    return (
                      <div className={`flex items-center justify-end gap-1 ${
                        pct < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {pct < 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {Math.abs(pct).toFixed(0)}%
                      </div>
                    );
                  }
                  return <span className="text-gray-400 dark:text-gray-500">-</span>;
                })()}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300">
          <p><strong>Note:</strong> Trend shows change from previous month.</p>
          <p className="mt-1">Click parent categories to expand/collapse subcategories. Click amounts to view transactions.</p>
        </div>
      </div>

      {/* Expense Detail Modal */}
      {expenseDetailModalOpen && selectedExpenseCategory && (() => {
        // Filter transactions for selected category and month
        const categoryTransactions = getFilteredTransactions().filter(t => {
          // Compare date strings directly to avoid timezone issues
          const year = selectedExpenseCategory.year;
          const month = String(selectedExpenseCategory.month + 1).padStart(2, '0');
          const datePrefix = `${year}-${month}`;
          
          if (!t.date.startsWith(datePrefix)) {
            return false;
          }
          
          if (selectedExpenseCategory.isParent && selectedExpenseCategory.childrenIds) {
            // For parent categories, include all children - match by ID only
            return t.categoryId === selectedExpenseCategory.categoryId ||
                   selectedExpenseCategory.childrenIds.includes(t.categoryId || -1);
          } else {
            // For standalone/child categories, match by ID only
            return t.categoryId === selectedExpenseCategory.categoryId;
          }
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setExpenseDetailModalOpen(false)}
          >
            <div 
              className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedExpenseCategory.categoryName}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedExpenseCategory.label}</p>
                  </div>
                  <button
                    onClick={() => setExpenseDetailModalOpen(false)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="mt-4 flex items-baseline gap-3">
                  {(() => {
                    const total = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
                    return (
                      <div className={`text-3xl font-bold ${total > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {total > 0 ? '+' : ''}${Math.abs(total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    );
                  })()}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {categoryTransactions.length} transaction{categoryTransactions.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                {categoryTransactions.length > 0 ? (
                  <div className="space-y-2">
                    {categoryTransactions.map((t) => {
                      const account = accounts.find(a => a.id === t.accountId);
                      return (
                        <div key={t.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.description}</span>
                              {t.merchant && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">({t.merchant})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {parseLocalDate(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{account?.name || 'Unknown'}</span>
                              {t.category && (
                                <>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{t.category}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className={`font-semibold ${t.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No transactions found for this category and month.
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button
                  onClick={() => {
                    const year = selectedExpenseCategory.year;
                    const month = String(selectedExpenseCategory.month + 1).padStart(2, '0');
                    const lastDay = String(new Date(year, selectedExpenseCategory.month + 1, 0).getDate()).padStart(2, '0');
                    // Pass category IDs instead of name to avoid duplicate name issues
                    const categoryIds = selectedExpenseCategory.isParent && selectedExpenseCategory.childrenIds
                      ? [selectedExpenseCategory.categoryId, ...selectedExpenseCategory.childrenIds].join(',')
                      : String(selectedExpenseCategory.categoryId);
                    window.location.href = `/transactions?filterCategoryIds=${categoryIds}&filterDateFrom=${year}-${month}-01&filterDateTo=${year}-${month}-${lastDay}&filterType=expense`;
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>View in Transactions Page</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
        </>
      )}

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (() => {
        // Calculate income and expense data for cash flow
        const { start, end } = getDateRange();
        const filteredTx = transactions.filter(t => {
          const transactionDate = new Date(t.date);
          if (transactionDate < start || transactionDate > end) return false;
          
          if (accountType !== 'all') {
            const account = accounts.find(a => a.id === t.accountId);
            if (!account || account.type !== accountType) return false;
          }
          
          // Exclude income from retirement accounts
          if (t.type === 'income') {
            const account = accounts.find(a => a.id === t.accountId);
            if (account && account.type === 'retirement') return false;
          }
          
          return (t.type === 'income' || t.type === 'expense');
        });

        // Calculate monthly income and expenses
        const chartData = months.map(({ year, month, label }) => {
          // Use string comparison to avoid timezone issues
          const monthStr = String(month + 1).padStart(2, '0');
          const datePrefix = `${year}-${monthStr}`;
          
          const income = filteredTx
            .filter(t => {
              return t.date.startsWith(datePrefix) && t.type === 'income';
            })
            .reduce((sum, t) => sum + t.amount, 0);

          const expenses = filteredTx
            .filter(t => {
              return t.date.startsWith(datePrefix) && t.type === 'expense';
            })
            .reduce((sum, t) => sum - t.amount, 0); // negative amounts = expenses, positive amounts = refunds (offset expenses)

          return {
            month: label,
            income,
            expenses,
            net: income - expenses
          };
        });

        const totalIncome = chartData.reduce((sum, d) => sum + d.income, 0);
        const totalExpenses = chartData.reduce((sum, d) => sum + d.expenses, 0);
        const totalNet = totalIncome - totalExpenses;

        // Include retirement account salary contributions in savings rate calc
        // (these are excluded from regular income/expense totals above but represent real savings)
        const retirementAccountIds = new Set(accounts.filter(a => a.type === 'retirement').map(a => a.id));
        const retirementSalaryContributions = transactions
          .filter(t => {
            const transactionDate = new Date(t.date);
            if (transactionDate < start || transactionDate > end) return false;
            return t.type === 'income' &&
              retirementAccountIds.has(t.accountId) &&
              t.category === 'Salary';
          })
          .reduce((sum, t) => sum + t.amount, 0);

        const adjustedIncome = totalIncome + retirementSalaryContributions;
        const adjustedNet = totalNet + retirementSalaryContributions;
        const avgSavingsRate = adjustedIncome > 0 ? (adjustedNet / adjustedIncome) * 100 : 0;

        // Per-month savings rate breakdown (for modal)
        const monthlySavingsData = months.map(({ year, month, label }) => {
          const monthStr = String(month + 1).padStart(2, '0');
          const datePrefix = `${year}-${monthStr}`;
          const d = chartData.find(cd => cd.month === label)!;
          const retirementContrib = transactions
            .filter(t =>
              t.date.startsWith(datePrefix) &&
              t.type === 'income' &&
              retirementAccountIds.has(t.accountId) &&
              t.category === 'Salary'
            )
            .reduce((sum, t) => sum + t.amount, 0);
          const adjInc = d.income + retirementContrib;
          const adjNet = d.net + retirementContrib;
          const rate = adjInc > 0 ? (adjNet / adjInc) * 100 : 0;
          return { label, income: d.income, expenses: d.expenses, retirementContrib, adjInc, adjNet, rate };
        });

        // Per-account retirement contributions (for modal)
        const retirementAccounts = accounts.filter(a => a.type === 'retirement');
        const perAccountContributions = retirementAccounts
          .map(acct => {
            const contrib = transactions
              .filter(t => {
                const transactionDate = new Date(t.date);
                if (transactionDate < start || transactionDate > end) return false;
                return t.type === 'income' && t.accountId === acct.id && t.category === 'Salary';
              })
              .reduce((sum, t) => sum + t.amount, 0);
            return { name: acct.name, contrib };
          })
          .filter(a => a.contrib > 0)
          .sort((a, b) => b.contrib - a.contrib);
        const avgMonthlyIncome = totalIncome / chartData.length;
        const avgMonthlyExpenses = totalExpenses / chartData.length;
        const avgMonthlySurplus = totalNet / chartData.length;

        // Calculate income by category
        const incomeCategories = categories.filter(c => c.type === 'income');
        const parentIncomeCategories = incomeCategories.filter(c => c.isParent);
        const childIncomeCategories = incomeCategories.filter(c => c.parentId);
        const standaloneIncomeCategories = incomeCategories.filter(c => !c.isParent && !c.parentId);

        const incomeByCategory: CategorySpending[] = [];

        // Process parent income categories
        parentIncomeCategories.forEach(parent => {
          const children = childIncomeCategories.filter(c => c.parentId === parent.id);
          
          const parentMonths = months.map(({ year, month }) => {
            // Use string comparison to avoid timezone issues
            const monthStr = String(month + 1).padStart(2, '0');
            const datePrefix = `${year}-${monthStr}`;
            
            const amount = filteredTx
              .filter(t => {
                if (!t.date.startsWith(datePrefix) || t.type !== 'income') {
                  return false;
                }
                // Match by ID only
                return t.categoryId === parent.id || 
                       children.some(c => c.id === t.categoryId);
              })
              .reduce((sum, t) => sum + t.amount, 0);
            
            return { year, month, amount };
          });
          
          const parentTotal = parentMonths.reduce((sum, m) => sum + m.amount, 0);
          const now2 = new Date();
          const completedParentMonths2 = parentMonths.filter(m => m.year < now2.getFullYear() || (m.year === now2.getFullYear() && m.month < now2.getMonth()));
          const lastTwo = completedParentMonths2.slice(-2);
          const parentTrend = lastTwo.length === 2 && lastTwo[0].amount !== 0
            ? ((lastTwo[1].amount - lastTwo[0].amount) / Math.abs(lastTwo[0].amount)) * 100
            : 0;
          
          const childrenData: CategorySpending[] = children.map(child => {
            const childMonths = months.map(({ year, month }) => {
              // Use string comparison to avoid timezone issues
              const monthStr = String(month + 1).padStart(2, '0');
              const datePrefix = `${year}-${monthStr}`;
              
              const amount = filteredTx
                .filter(t => {
                  if (!t.date.startsWith(datePrefix) || t.type !== 'income') {
                    return false;
                  }
                  // Match by ID only
                  return t.categoryId === child.id;
                })
                .reduce((sum, t) => sum + t.amount, 0);
              
              return { year, month, amount };
            });
            
            const childTotal = childMonths.reduce((sum, m) => sum + m.amount, 0);
            const now3 = new Date();
            const completedChildMonths2 = childMonths.filter(m => m.year < now3.getFullYear() || (m.year === now3.getFullYear() && m.month < now3.getMonth()));
            const lastTwo = completedChildMonths2.slice(-2);
            const childTrend = lastTwo.length === 2 && lastTwo[0].amount !== 0
              ? ((lastTwo[1].amount - lastTwo[0].amount) / Math.abs(lastTwo[0].amount)) * 100
              : 0;
            
            return {
              categoryName: child.name,
              categoryId: child.id,
              isParent: false,
              parentId: parent.id,
              months: childMonths,
              total: childTotal,
              trend: childTrend
            };
          });
          
          // Include parent category if it has any activity
          if (parentTotal !== 0 || parentMonths.some(m => m.amount !== 0)) {
            incomeByCategory.push({
              categoryName: parent.name,
              categoryId: parent.id,
              isParent: true,
              months: parentMonths,
              total: parentTotal,
              trend: parentTrend,
              children: childrenData
            });
          }
        });

        // Process standalone income categories
        standaloneIncomeCategories.forEach(category => {
          const categoryMonths = months.map(({ year, month }) => {
            // Use string comparison to avoid timezone issues
            const monthStr = String(month + 1).padStart(2, '0');
            const datePrefix = `${year}-${monthStr}`;
            
            const amount = filteredTx
              .filter(t => {
                if (!t.date.startsWith(datePrefix) || t.type !== 'income') {
                  return false;
                }
                // Match by ID only
                return t.categoryId === category.id;
              })
              .reduce((sum, t) => sum + t.amount, 0);
            
            return { year, month, amount };
          });
          
          const categoryTotal = categoryMonths.reduce((sum, m) => sum + m.amount, 0);
          const now4 = new Date();
          const completedCategoryMonths2 = categoryMonths.filter(m => m.year < now4.getFullYear() || (m.year === now4.getFullYear() && m.month < now4.getMonth()));
          const lastTwo = completedCategoryMonths2.slice(-2);
          const trend = lastTwo.length === 2 && lastTwo[0].amount !== 0
            ? ((lastTwo[1].amount - lastTwo[0].amount) / Math.abs(lastTwo[0].amount)) * 100
            : 0;
          
          // Include category if it has any activity
          if (categoryTotal !== 0 || categoryMonths.some(m => m.amount !== 0)) {
            incomeByCategory.push({
              categoryName: category.name,
              categoryId: category.id,
              isParent: false,
              months: categoryMonths,
              total: categoryTotal,
              trend
            });
          }
        });

        incomeByCategory.sort((a, b) => b.total - a.total);

        // Calculate income in non-income categories (wrong type) or truly uncategorized
        const allIncomeCategoryIds = new Set(incomeCategories.map(c => c.id));
        const allIncomeCategoryNames = new Set(incomeCategories.map(c => c.name));

        // Find income transactions not in income-type categories
        const wronglyTypedMonths = months.map(({ year, month }) => {
          // Use string comparison to avoid timezone issues
          const monthStr = String(month + 1).padStart(2, '0');
          const datePrefix = `${year}-${monthStr}`;
          
          const amount = filteredTx
            .filter(t => {
              if (!t.date.startsWith(datePrefix) || t.type !== 'income') {
                return false;
              }
              
              // Exclude if matches an income category by ID only
              if (t.categoryId && allIncomeCategoryIds.has(t.categoryId)) {
                return false;
              }
              
              // Include all other income transactions
              return true;
            })
            .reduce((sum, t) => sum + t.amount, 0);
          
          return { year, month, amount };
        });

        const wronglyTypedTotal = wronglyTypedMonths.reduce((sum, m) => sum + m.amount, 0);
        const wronglyTypedLastTwo = wronglyTypedMonths.slice(-2);
        const wronglyTypedTrend = wronglyTypedLastTwo.length === 2 && wronglyTypedLastTwo[0].amount > 0
          ? ((wronglyTypedLastTwo[1].amount - wronglyTypedLastTwo[0].amount) / wronglyTypedLastTwo[0].amount) * 100
          : 0;

        if (wronglyTypedTotal > 0 || wronglyTypedMonths.some(m => m.amount > 0)) {
          incomeByCategory.push({
            categoryName: 'Other Income (Non-Income Categories)',
            categoryId: -1,
            isParent: false,
            months: wronglyTypedMonths,
            total: wronglyTypedTotal,
            trend: wronglyTypedTrend
          });
        }

        return (
          <>
            {/* Filters */}
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Time Period</label>
                  <select
                    className="input"
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
                  >
                    <option value="3m">Last 3 Months</option>
                    <option value="6m">Last 6 Months</option>
                    <option value="12m">Last 12 Months</option>
                    <option value="ytd">Year to Date</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                <div>
                  <label className="label">Account Type</label>
                  <select
                    className="input"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                  >
                    {accountTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {timePeriod === 'custom' && (
                  <>
                    <div>
                      <label className="label">Start Date</label>
                      <input
                        type="date"
                        className="input"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">End Date</label>
                      <input
                        type="date"
                        className="input"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-sm dark:text-gray-100">Avg Monthly Income</h3>
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${avgMonthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Total: ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingDown size={20} className="text-red-600 dark:text-red-400" />
                  <h3 className="font-semibold text-sm dark:text-gray-100">Avg Monthly Expenses</h3>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ${avgMonthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Total: ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="card">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign size={20} className={totalNet >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'} />
                  <h3 className="font-semibold text-sm dark:text-gray-100">Avg Monthly Surplus</h3>
                </div>
                <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  ${avgMonthlySurplus.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Net: ${totalNet.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="card cursor-pointer hover:ring-2 hover:ring-green-400 dark:hover:ring-green-500 transition-all" onClick={() => setSavingsRateModalOpen(true)}>
                <div className="flex items-center gap-3 mb-2">
                  <Wallet size={20} className={avgSavingsRate >= 20 ? 'text-green-600 dark:text-green-400' : avgSavingsRate >= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'} />
                  <h3 className="font-semibold text-sm dark:text-gray-100">Avg Savings Rate</h3>
                </div>
                <p className={`text-2xl font-bold ${avgSavingsRate >= 20 ? 'text-green-600 dark:text-green-400' : avgSavingsRate >= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                  {avgSavingsRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {avgSavingsRate >= 20 ? 'Excellent!' : avgSavingsRate >= 10 ? 'Good' : 'Needs attention'} · click for details
                </p>
              </div>
            </div>

            {/* Cash Flow Chart */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">Income vs Expenses Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                  <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" name="Net" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Income by Category Table */}
            <div className="card overflow-x-auto">
              <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">Income by Category</h2>
              
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10">Category</th>
                    {months.map((m, idx) => (
                      <th key={idx} className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {m.label}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300" title="Change between last 2 complete months">MoM Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeByCategory.map((cat) => (
                    <>
                      <tr 
                        key={cat.categoryId}
                        className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 group ${
                          cat.isParent ? 'bg-gray-50 dark:bg-gray-800 font-medium cursor-pointer' : ''
                        } ${cat.categoryId === -1 ? 'bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-l-yellow-400 dark:border-l-yellow-600' : ''}`}
                        onClick={() => cat.isParent && cat.children && cat.children.length > 0 && toggleCategory(cat.categoryId)}
                      >
                        <td className="py-3 px-4 sticky left-0 bg-inherit z-10">
                          <div className="flex items-center gap-2">
                            {cat.isParent && cat.children && cat.children.length > 0 && (
                              expandedCategories.has(cat.categoryId) 
                                ? <ChevronDown size={16} className="text-gray-400 dark:text-gray-500" />
                                : <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
                            )}
                            <span className="dark:text-gray-100">{cat.categoryName}</span>
                            {cat.isParent && cat.children && cat.children.length > 0 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">({cat.children.length})</span>
                            )}
                          </div>
                        </td>
                        {cat.months.map((m, idx) => (
                          <td 
                            key={idx} 
                            className={`text-right py-3 px-4 whitespace-nowrap ${m.amount !== 0 ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30' : ''}`}
                            onClick={(e) => {
                              if (m.amount !== 0) {
                                e.stopPropagation();
                                setSelectedIncomeCategory({
                                  categoryName: cat.categoryName,
                                  categoryId: cat.categoryId,
                                  year: m.year,
                                  month: m.month,
                                  label: months[idx].label,
                                  isOther: cat.categoryId === -1
                                });
                                setIncomeDetailModalOpen(true);
                              }
                            }}
                          >
                            {m.amount !== 0 ? (
                              <span className={`flex items-center justify-end gap-1 ${m.amount < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                                {m.amount < 0 ? '-' : ''}${Math.abs(m.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                <Eye size={14} className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100" />
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                        ))}
                        <td className={`text-right py-3 px-4 whitespace-nowrap ${cat.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                          {cat.total < 0 ? '-' : ''}${Math.abs(cat.total).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-right py-3 px-4 whitespace-nowrap">
                          {cat.trend !== 0 ? (
                            <div className={`flex items-center justify-end gap-1 ${
                              cat.trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            } ${Math.abs(cat.trend) > 20 ? 'font-bold' : ''}`}>
                              {cat.trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                              {Math.abs(cat.trend).toFixed(0)}%
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                      </tr>

                      {cat.isParent && cat.children && expandedCategories.has(cat.categoryId) && (
                        cat.children.map(child => (
                          <tr 
                            key={child.categoryId}
                            className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <td className="py-2 px-4 pl-12 text-sm sticky left-0 bg-inherit z-10 dark:text-gray-100">
                              {child.categoryName}
                            </td>
                            {child.months.map((m, idx) => (
                              <td key={idx} className="text-right py-2 px-4 text-sm whitespace-nowrap">
                                {m.amount !== 0 ? (
                                  <span className={m.amount < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                                    {m.amount < 0 ? '-' : ''}${Math.abs(m.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">-</span>
                                )}
                              </td>
                            ))}
                            <td className={`text-right py-2 px-4 text-sm whitespace-nowrap ${child.total < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                              {child.total < 0 ? '-' : ''}${Math.abs(child.total).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                            <td className="text-right py-2 px-4 text-sm whitespace-nowrap">
                              {child.trend !== 0 ? (
                                <div className={`flex items-center justify-end gap-1 ${
                                  child.trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                } ${Math.abs(child.trend) > 20 ? 'font-bold' : ''}`}>
                                  {child.trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                  {Math.abs(child.trend).toFixed(0)}%
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </>
                  ))}

                  {/* Total Row */}
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-blue-50 dark:bg-blue-900/20 font-bold">
                    <td className="py-3 px-4 sticky left-0 bg-blue-50 dark:bg-blue-900/20 z-10 dark:text-gray-100">TOTAL</td>
                    {months.map(({ year, month }, idx) => {
                      const total = incomeByCategory.reduce((sum, cat) => {
                        const monthData = cat.months.find(m => m.year === year && m.month === month);
                        return sum + (monthData?.amount || 0);
                      }, 0);
                      return (
                        <td key={idx} className="text-right py-3 px-4 whitespace-nowrap">
                          ${total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      );
                    })}
                    <td className="text-right py-3 px-4 whitespace-nowrap">
                      ${incomeByCategory.reduce((sum, cat) => sum + cat.total, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="text-right py-3 px-4 whitespace-nowrap">
                      {(() => {
                        const now5 = new Date();
                        const completedMonthTotals = months
                          .filter(m => m.year < now5.getFullYear() || (m.year === now5.getFullYear() && m.month < now5.getMonth()))
                          .map(({ year, month }) =>
                            incomeByCategory.reduce((sum, cat) => {
                              const monthData = cat.months.find(m => m.year === year && m.month === month);
                              return sum + (monthData?.amount || 0);
                            }, 0)
                          );
                        const lt = completedMonthTotals.slice(-2);
                        if (lt.length === 2 && lt[0] !== 0) {
                          const trendPercent = ((lt[1] - lt[0]) / Math.abs(lt[0])) * 100;
                          return (
                            <div className={`flex items-center justify-end gap-1 ${
                              trendPercent > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {trendPercent > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                              {Math.abs(trendPercent).toFixed(0)}%
                            </div>
                          );
                        }
                        return <span className="text-gray-400 dark:text-gray-500">-</span>;
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300">
                <p><strong>Note:</strong> Income increases are shown in green, decreases in red.</p>
                <p className="mt-1">"Other Income" includes income transactions assigned to non-income category types (like expense categories).</p>
                <p className="mt-1">Click on any amount to see the transactions that make up that total.</p>
                <p className="mt-1">Savings rate = (Income - Expenses + Retirement Salary) / (Income + Retirement Salary) × 100</p>
              </div>
            </div>

            {/* Savings Rate Detail Modal */}
            {savingsRateModalOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                onClick={() => setSavingsRateModalOpen(false)}
              >
                <div
                  className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Savings Rate Breakdown</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Includes retirement salary contributions as savings · refunds offset expenses</p>
                      </div>
                      <button onClick={() => setSavingsRateModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={24} />
                      </button>
                    </div>
                    <div className="mt-4 flex items-baseline gap-3">
                      <span className={`text-4xl font-bold ${avgSavingsRate >= 20 ? 'text-green-600 dark:text-green-400' : avgSavingsRate >= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                        {avgSavingsRate.toFixed(1)}%
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">avg over period</span>
                    </div>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                    {/* Month-by-month table */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Month-by-Month</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                            <th className="text-left pb-2">Month</th>
                            <th className="text-right pb-2">Income</th>
                            <th className="text-right pb-2">Expenses</th>
                            <th className="text-right pb-2">Retirement</th>
                            <th className="text-right pb-2">Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlySavingsData.map((row) => (
                            <tr key={row.label} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 text-gray-700 dark:text-gray-300">{row.label}</td>
                              <td className="py-2 text-right text-green-600 dark:text-green-400">
                                ${row.income.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2 text-right text-red-600 dark:text-red-400">
                                ${row.expenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2 text-right text-purple-600 dark:text-purple-400">
                                {row.retirementContrib > 0
                                  ? `$${row.retirementContrib.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                  : <span className="text-gray-400">—</span>}
                              </td>
                              <td className="py-2 text-right">
                                <span className={`font-semibold ${row.rate >= 20 ? 'text-green-600 dark:text-green-400' : row.rate >= 10 ? 'text-yellow-600 dark:text-yellow-400' : row.adjInc === 0 ? 'text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {row.adjInc === 0 ? '—' : `${row.rate.toFixed(1)}%`}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Retirement account contributions */}
                    {perAccountContributions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Retirement Contributions (Salary)</h4>
                        <div className="space-y-2">
                          {perAccountContributions.map((acct) => {
                            const pct = retirementSalaryContributions > 0 ? (acct.contrib / retirementSalaryContributions) * 100 : 0;
                            return (
                              <div key={acct.name}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-gray-700 dark:text-gray-300">{acct.name}</span>
                                  <span className="font-medium text-purple-600 dark:text-purple-400">
                                    ${acct.contrib.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-gray-900 dark:text-gray-100">Total</span>
                            <span className="text-purple-600 dark:text-purple-400">
                              ${retirementSalaryContributions.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Rate = (Cash Income − Expenses + Retirement Salary) / (Cash Income + Retirement Salary) × 100
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Other Income Transactions Modal */}
            {otherIncomeModalOpen && selectedOtherIncomeMonth && (() => {
              // Get all income-type category IDs and names
              const incomeCategories = categories.filter(c => c.type === 'income');
              const incomeCategoryIds = new Set(incomeCategories.map(c => c.id));
              const incomeCategoryNames = new Set(incomeCategories.map(c => c.name));

              // Filter transactions for selected month that are "other income"
              const otherIncomeTransactions = filteredTx.filter(t => {
                // Use string comparison to avoid timezone issues
                const year = selectedOtherIncomeMonth.year;
                const monthStr = String(selectedOtherIncomeMonth.month + 1).padStart(2, '0');
                const datePrefix = `${year}-${monthStr}`;
                
                if (!t.date.startsWith(datePrefix) || t.type !== 'income') {
                  return false;
                }
                
                // Exclude if matches an income category by ID only
                if (t.categoryId && incomeCategoryIds.has(t.categoryId)) {
                  return false;
                }
                
                return true;
              }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              return (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                  onClick={() => setOtherIncomeModalOpen(false)}
                >
                  <div 
                    className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Other Income Details</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedOtherIncomeMonth.label}</p>
                        </div>
                        <button
                          onClick={() => setOtherIncomeModalOpen(false)}
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <X size={24} />
                        </button>
                      </div>
                      <div className="mt-4 flex items-baseline gap-3">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          ${otherIncomeTransactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {otherIncomeTransactions.length} transaction{otherIncomeTransactions.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 overflow-y-auto max-h-[50vh]">
                      {otherIncomeTransactions.length > 0 ? (
                        <div className="space-y-2">
                          {otherIncomeTransactions.map((t) => {
                            const account = accounts.find(a => a.id === t.accountId);
                            const category = categories.find(c => c.id === t.categoryId);
                            return (
                              <div key={t.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.description}</span>
                                    {t.merchant && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400">({t.merchant})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {parseLocalDate(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{account?.name || 'Unknown'}</span>
                                    {category && (
                                      <>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                        <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                                          {category.name} ({category.type})
                                        </span>
                                      </>
                                    )}
                                    {!t.categoryId && (
                                      <>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                        <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                                          No category
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="font-semibold text-green-600 dark:text-green-400">
                                    ${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          No transactions found for this month.
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Note:</strong> These income transactions are either uncategorized or assigned to non-income category types. 
                        Consider updating them to use proper income categories.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Income Category Detail Modal */}
            {incomeDetailModalOpen && selectedIncomeCategory && (() => {
              // Get all income categories
              const incomeCategories = categories.filter(c => c.type === 'income');
              const incomeCategoryIds = new Set(incomeCategories.map(c => c.id));
              const incomeCategoryNames = new Set(incomeCategories.map(c => c.name));

              // Filter transactions for selected category and month
              const categoryTransactions = filteredTx.filter(t => {
                // Compare date strings directly to avoid timezone issues
                const year = selectedIncomeCategory.year;
                const month = String(selectedIncomeCategory.month + 1).padStart(2, '0');
                const datePrefix = `${year}-${month}`;
                
                if (!t.date.startsWith(datePrefix) || t.type !== 'income') {
                  return false;
                }
                
                if (selectedIncomeCategory.isOther) {
                  // For "Other Income", exclude transactions matching income categories by ID only
                  if (t.categoryId && incomeCategoryIds.has(t.categoryId)) {
                    return false;
                  }
                  return true;
                } else {
                  // For regular categories, match by ID only
                  return t.categoryId === selectedIncomeCategory.categoryId;
                }
              }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              return (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                  onClick={() => setIncomeDetailModalOpen(false)}
                >
                  <div 
                    className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedIncomeCategory.categoryName}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedIncomeCategory.label}</p>
                        </div>
                        <button
                          onClick={() => setIncomeDetailModalOpen(false)}
                         className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <X size={24} />
                        </button>
                      </div>
                      <div className="mt-4 flex items-baseline gap-3">
                        {(() => {
                          const total = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
                          return (
                            <div className={`text-3xl font-bold ${total < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {total < 0 ? '-' : ''}${Math.abs(total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          );
                        })()}
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {categoryTransactions.length} transaction{categoryTransactions.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 overflow-y-auto max-h-[50vh]">
                      {categoryTransactions.length > 0 ? (
                        <div className="space-y-2">
                          {categoryTransactions.map((t) => {
                            const account = accounts.find(a => a.id === t.accountId);
                            return (
                              <div key={t.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.description}</span>
                                    {t.merchant && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400">({t.merchant})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {parseLocalDate(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{account?.name || 'Unknown'}</span>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className={`font-semibold ${t.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    {t.amount < 0 ? '-' : ''}${Math.abs(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          No transactions found for this category and month.
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <button
                        onClick={() => {
                          const year = selectedIncomeCategory.year;
                          const month = String(selectedIncomeCategory.month + 1).padStart(2, '0');
                          const lastDay = String(new Date(year, selectedIncomeCategory.month + 1, 0).getDate()).padStart(2, '0');
                          // Pass category ID and exclude retirement accounts (same as modal filter)
                          window.location.href = `/transactions?filterCategoryIds=${selectedIncomeCategory.categoryId}&filterDateFrom=${year}-${month}-01&filterDateTo=${year}-${month}-${lastDay}&filterType=income&excludeAccountTypes=retirement`;
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <span>View in Transactions Page</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        );
      })()}
    </div>
  );
}
