'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Transaction, Account, Category, TransactionType, CategorizationRule } from '@/lib/types';
import TransactionList from '@/components/TransactionList';
import AddTransactionModal from '@/components/AddTransactionModal';
import EditTransactionModal from '@/components/EditTransactionModal';
import RulesManager from '@/components/RulesManager';
import { Plus, Search, Mail, X, Edit2, Trash2, Zap, PlayCircle, Tag, Receipt } from 'lucide-react';

type PageTab = 'transactions' | 'categories';
type CatSubTab = 'categories' | 'rules';

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterCategoryIds, setFilterCategoryIds] = useState<number[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<number | null>(null);
  const [bulkType, setBulkType] = useState<'income' | 'expense' | 'transfer' | ''>('expense'); // Default to expense
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('kathrynlippe@gmail.com');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // ── Page tab ──────────────────────────────────────────────────────────────
  const [pageTab, setPageTab] = useState<PageTab>('transactions');

  // ── Categories state ──────────────────────────────────────────────────────
  const [catSubTab, setCatSubTab] = useState<CatSubTab>('categories');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState<{
    name: string;
    type: TransactionType;
    color: string;
    rules: CategorizationRule[];
    parentId?: number | null;
    isParent?: boolean;
  }>({ name: '', type: 'expense', color: '#3b82f6', rules: [], parentId: null, isParent: false });
  const [showAutoCategorizationModal, setShowAutoCategorizationModal] = useState(false);
  const [autoCategorizationPreview, setAutoCategorizationPreview] = useState<any>(null);
  const [isRunningAutoCategorization, setIsRunningAutoCategorization] = useState(false);
  const [runningCategoryId, setRunningCategoryId] = useState<number | null>(null);
  const [addingRuleToCategoryId, setAddingRuleToCategoryId] = useState<number | null>(null);
  const [newRuleData, setNewRuleData] = useState({
    pattern: '',
    field: 'description' as 'description' | 'merchant' | 'amount',
    matchType: 'contains' as 'contains' | 'regex',
  });

  // Read URL parameters and apply filters on initial load
  useEffect(() => {
    if (searchParams) {
      const category = searchParams.get('filterCategory');
      const categoryIds = searchParams.get('filterCategoryIds');
      const dateFrom = searchParams.get('filterDateFrom');
      const dateTo = searchParams.get('filterDateTo');
      const type = searchParams.get('filterType');
      const account = searchParams.get('filterAccount');
      const selectedIdsParam = searchParams.get('selectedIds');
      const excludeTypes = searchParams.get('excludeAccountTypes');
      
      if (category) setFilterCategory(category);
      if (categoryIds) {
        const ids = categoryIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        setFilterCategoryIds(ids);
      }
      if (dateFrom) setFilterDateFrom(dateFrom);
      if (dateTo) setFilterDateTo(dateTo);
      if (type) setFilterType(type);
      if (account) setFilterAccount(account);
      
      // Handle excluded account types (e.g., "retirement")
      if (excludeTypes) {
        const typesToExclude = excludeTypes.split(',');
        // Filter out accounts of these types
        const excludedAccountIds = accounts
          .filter(a => typesToExclude.includes(a.type))
          .map(a => a.id.toString());
        
        // We'll apply this filter in the applyFilters function
        // Store it in a way we can use
        (window as any).excludedAccountIds = new Set(excludedAccountIds);
      }
      
      // Auto-select transaction IDs from URL
      if (selectedIdsParam) {
        const ids = selectedIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        setSelectedIds(new Set(ids));
        // Show only these transactions when coming from email
        setShowOnlySelected(true);
      }
    }
  }, [searchParams, accounts]);

  // Sync filterCategory name when filterCategoryIds is set (e.g., from URL)
  useEffect(() => {
    if (filterCategoryIds.length > 0 && categories.length > 0 && !filterCategory) {
      // Find the first category that matches the filterCategoryIds
      const matchingCategory = categories.find(c => filterCategoryIds.includes(c.id));
      if (matchingCategory) {
        setFilterCategory(matchingCategory.name);
        setFilterType(matchingCategory.type);
      }
    }
  }, [filterCategoryIds, categories, filterCategory]);

  useEffect(() => {
    fetchData();
  }, [filterAccount]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterAccount, filterType, filterCategory, filterCategoryIds, filterDateFrom, filterDateTo]);

  const fetchData = async () => {
    try {
      const url = filterAccount 
        ? `/api/transactions?accountId=${filterAccount}&limit=999999` 
        : '/api/transactions?limit=999999';
      
      const [transactionsRes, accountsRes, categoriesRes] = await Promise.all([
        fetch(url, { cache: 'no-store' }),
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
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
      setTransactions([]);
      setAccounts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const scrollToCategoryForm = () => {
    setTimeout(() => {
      document.getElementById('category-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingCategory ? 'PUT' : 'POST';
      const payload = editingCategory ? { id: editingCategory.id, ...categoryFormData } : categoryFormData;
      const response = await fetch('/api/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        fetchCategories();
        setShowAddCategoryForm(false);
        setEditingCategory(null);
        setCategoryFormData({ name: '', type: 'expense', color: '#3b82f6', rules: [], parentId: null, isParent: false });
      } else {
        alert('Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      type: category.type,
      color: category.color || '#3b82f6',
      rules: category.rules || [],
      parentId: category.parentId || null,
      isParent: category.isParent || false,
    });
    setShowAddCategoryForm(true);
    scrollToCategoryForm();
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  };

  const handleCancelCategoryEdit = () => {
    setShowAddCategoryForm(false);
    setEditingCategory(null);
    setCategoryFormData({ name: '', type: 'expense', color: '#3b82f6', rules: [], parentId: null, isParent: false });
  };

  const handlePreviewAutoCategorization = async () => {
    setIsRunningAutoCategorization(true);
    try {
      const response = await fetch('/api/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', overrideExisting: false }),
      });
      setAutoCategorizationPreview(await response.json());
      setShowAutoCategorizationModal(true);
    } catch (error) {
      console.error('Error previewing auto-categorization:', error);
      alert('Failed to preview auto-categorization');
    } finally {
      setIsRunningAutoCategorization(false);
    }
  };

  const handleRunAutoCategorization = async () => {
    setIsRunningAutoCategorization(true);
    try {
      const response = await fetch('/api/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', overrideExisting: false }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`Successfully categorized ${result.total} transactions!`);
        setShowAutoCategorizationModal(false);
        fetchData();
      } else {
        alert('Failed to categorize transactions');
      }
    } catch (error) {
      console.error('Error running auto-categorization:', error);
      alert('Failed to run auto-categorization');
    } finally {
      setIsRunningAutoCategorization(false);
    }
  };

  const handleRunCategoryRules = async (categoryId: number) => {
    setRunningCategoryId(categoryId);
    try {
      const response = await fetch('/api/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', overrideExisting: false, categoryId }),
      });
      const result = await response.json();
      if (result.success) {
        const cat = categories.find(c => c.id === categoryId);
        alert(`Successfully categorized ${result.total} transactions with "${cat?.name}" rules!`);
        fetchData();
      } else {
        alert('Failed to categorize transactions');
      }
    } catch (error) {
      console.error('Error running categorization:', error);
      alert('Failed to run categorization');
    } finally {
      setRunningCategoryId(null);
    }
  };

  const handleDeleteRule = async (categoryId: number, ruleId: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;
      const updatedRules = (category.rules || []).filter(r => r.id !== ruleId);
      const response = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: category.id, name: category.name, type: category.type, color: category.color, rules: updatedRules }),
      });
      if (response.ok) fetchCategories();
      else alert('Failed to delete rule');
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    }
  };

  const handleAddRule = async (categoryId: number) => {
    if (!newRuleData.pattern) { alert('Please enter a pattern'); return; }
    try {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;
      const newRule: CategorizationRule = { id: Date.now(), ...newRuleData };
      const updatedRules = [...(category.rules || []), newRule];
      const response = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: category.id, name: category.name, type: category.type, color: category.color, rules: updatedRules }),
      });
      if (response.ok) {
        setAddingRuleToCategoryId(null);
        setNewRuleData({ pattern: '', field: 'description', matchType: 'contains' });
        fetchCategories();
      } else {
        alert('Failed to add rule');
      }
    } catch (error) {
      console.error('Error adding rule:', error);
      alert('Failed to add rule');
    }
  };

  const handleTransactionAdded = () => {
    setShowAddModal(false);
    fetchData();
  };

  const handleTransactionEdited = () => {
    setEditingTransaction(null);
    fetchData();
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
    }
  };

  const handleCategoryChange = async (id: number, categoryIdStr: string) => {
    try {
      const transaction = transactions.find(t => t.id === id);
      if (!transaction) return;

      const categoryId = parseInt(categoryIdStr);
      const categoryObj = categories.find(c => c.id === categoryId);
      
      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...transaction,
          category: categoryObj?.name || '',
          categoryId: categoryObj?.id,
        }),
      });
      
      fetchData();
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category');
    }
  };

  const handleInlineEdit = async (updatedTransaction: Transaction) => {
    try {
      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTransaction),
      });
      
      fetchData();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction');
    }
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedTransactions.map(t => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // Bulk action handlers
  const handleBulkUpdate = async () => {
    const updates: any = {};
    if (bulkCategoryId) {
      const category = categories.find(c => c.id === bulkCategoryId);
      if (category) {
        updates.category = category.name;
        updates.categoryId = category.id;
        // Automatically set the type to match the category type
        updates.type = category.type;
      }
    }
    // Allow user to override type if they explicitly selected one
    if (bulkType) {
      updates.type = bulkType;
    }
    
    if (Object.keys(updates).length === 0) {
      alert('Please select a category or type to update');
      return;
    }

    const category = bulkCategoryId ? categories.find(c => c.id === bulkCategoryId) : null;
    const confirmMessage = `Update ${selectedIds.size} transaction${selectedIds.size !== 1 ? 's' : ''}?\n\n` +
      (category ? `Category: ${category.name}\n` : '') +
      (updates.type ? `Type: ${updates.type}\n` : '');

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch('/api/transactions/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          updates
        })
      });

      if (response.ok) {
        const result = await response.json();
        // Force reload data
        await fetchData();
        setSelectedIds(new Set());
        setBulkCategoryId(null);
        setBulkType('');
        setShowOnlySelected(false);
        alert(`Successfully updated ${result.updated} transaction${result.updated !== 1 ? 's' : ''}`);
        // Force page refresh to ensure UI updates
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Failed to update transactions: ${error.error}`);
      }
    } catch (error) {
      console.error('Bulk update error:', error);
      alert('Failed to update transactions');
    }
  };

  const handleBulkDelete = async () => {
    const confirmMessage = `Delete ${selectedIds.size} transaction${selectedIds.size !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      let deletedCount = 0;
      for (const id of selectedIds) {
        const response = await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
        if (response.ok) deletedCount++;
      }
      
      await fetchData();
      setSelectedIds(new Set());
      alert(`Successfully deleted ${deletedCount} transaction${deletedCount !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Failed to delete transactions');
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      alert('Please enter a recipient email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch('/api/send-categorization-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          recipientEmail: recipientEmail
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Email sent successfully to ${recipientEmail}!\n\n${result.transactionCount} transaction${result.transactionCount !== 1 ? 's' : ''} included.`);
        setShowEmailModal(false);
        setRecipientEmail('');
        setSelectedIds(new Set());
      } else {
        alert(`Failed to send email: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Email sending error:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  // Filter transactions based on search and filter criteria
  const filteredTransactions = transactions.filter((transaction) => {
    // If showing only selected transactions (from email), filter to just those
    if (showOnlySelected && selectedIds.size > 0) {
      if (!selectedIds.has(transaction.id)) {
        return false;
      }
    }

    // Search text filter (searches description, merchant, category)
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesDescription = transaction.description?.toLowerCase().includes(search);
      const matchesMerchant = transaction.merchant?.toLowerCase().includes(search);
      const matchesCategory = transaction.category?.toLowerCase().includes(search);
      const matchesAmount = transaction.amount?.toString().includes(search);
      
      if (!matchesDescription && !matchesMerchant && !matchesCategory && !matchesAmount) {
        return false;
      }
    }

    // Type filter
    if (filterType && transaction.type !== filterType) {
      return false;
    }
    
    // Excluded account types filter (for excluding retirement accounts from income view)
    const excludedAccountIds = (window as any).excludedAccountIds as Set<string> | undefined;
    if (excludedAccountIds && excludedAccountIds.has(transaction.accountId.toString())) {
      return false;
    }

    // Category filter - use categoryId if filterCategoryIds is set, otherwise use category name
    if (filterCategoryIds.length > 0) {
      if (!filterCategoryIds.includes(transaction.categoryId)) {
        return false;
      }
    } else if (filterCategory) {
      // Check if the selected category is a parent category
      const selectedCategoryObj = categories.find(c => c.name === filterCategory && c.type === filterType);
      
      if (selectedCategoryObj) {
        // If it's a parent category, include transactions from all child categories
        if (selectedCategoryObj.isParent) {
          const childCategories = categories
            .filter(c => c.parentId === selectedCategoryObj.id)
            .map(c => c.name);
          
          // Match parent category or any child category
          const matchesParent = transaction.category === filterCategory;
          const matchesChild = childCategories.includes(transaction.category || '');
          
          if (!matchesParent && !matchesChild) {
            return false;
          }
        } else {
          // Not a parent, just match the exact category name
          if (transaction.category !== filterCategory) {
            return false;
          }
        }
      } else if (transaction.category !== filterCategory) {
        return false;
      }
    }

    // Date range filter
    if (filterDateFrom && transaction.date < filterDateFrom) {
      return false;
    }
    if (filterDateTo && transaction.date > filterDateTo) {
      return false;
    }

    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.type]) acc[cat.type] = [];
    acc[cat.type].push(cat);
    return acc;
  }, {} as Record<string, Category[]>);

  const tabCls = (tab: PageTab) =>
    `py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
      pageTab === tab
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
    }`;

  const catSubTabCls = (tab: CatSubTab) =>
    `px-4 py-3 font-medium border-b-2 transition-colors ${
      catSubTab === tab
        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Transactions</h1>
          <p className="text-gray-600 dark:text-gray-300">Track your income and expenses</p>
        </div>
        {pageTab === 'transactions' && (
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary flex items-center gap-2">
            <Plus size={20} />
            Add Transaction
          </button>
        )}
        {pageTab === 'categories' && (
          <div className="flex gap-3">
            <button
              onClick={handlePreviewAutoCategorization}
              disabled={isRunningAutoCategorization}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Zap size={20} />
              Auto-Categorize All
            </button>
            <button
              onClick={() => { setShowAddCategoryForm(true); setCatSubTab('categories'); scrollToCategoryForm(); }}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={20} />
              Add Category
            </button>
          </div>
        )}
      </div>

      {/* Page Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setPageTab('transactions')} className={tabCls('transactions')}>
            <Receipt size={16} />
            Transactions
          </button>
          <button onClick={() => setPageTab('categories')} className={tabCls('categories')}>
            <Tag size={16} />
            Categories
          </button>
        </nav>
      </div>

      {pageTab === 'transactions' && (<>

      {/* Filters */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Search & Filters</h3>
        
        {/* Search Bar */}
        <div className="mb-4">
          <label className="label">Search Transactions</label>
          <input
            type="text"
            className="input"
            placeholder="Search by description, merchant, category, or amount..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Search across all transaction details
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="label">Account</label>
            <select 
              className="input"
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
            >
              <option value="">All Accounts</option>
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
            <label className="label">Type</label>
            <select 
              className="input"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                // Clear category filter when type changes
                if (e.target.value === '') {
                  setFilterCategory('');
                  setFilterCategoryIds([]);
                }
              }}
            >
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
              <option value="pending">Pending Classification</option>
            </select>
          </div>

          <div>
            <label className="label">Category</label>
            <select 
              className="input"
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                // Clear categoryIds filter when manually selecting category
                setFilterCategoryIds([]);
              }}
              disabled={!filterType}
            >
              <option value="">All Categories</option>
              {filterType && categories
                .filter(c => c.type === filterType)
                .sort((a, b) => {
                  // Get display names with parent
                  const getDisplayName = (cat: Category) => {
                    if (cat.parentId) {
                      const parent = categories.find(p => p.id === cat.parentId);
                      return parent ? `${parent.name} > ${cat.name}` : cat.name;
                    }
                    return cat.name;
                  };
                  return getDisplayName(a).localeCompare(getDisplayName(b));
                })
                .map((category) => {
                  const displayName = category.parentId 
                    ? (() => {
                        const parent = categories.find(p => p.id === category.parentId);
                        return parent ? `${parent.name} > ${category.name}` : category.name;
                      })()
                    : category.name;
                  
                  return (
                    <option key={category.id} value={category.name}>
                      {displayName}
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              className="input"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              className="input"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {/* Results Summary */}
        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {filteredTransactions.length === transactions.length ? (
              `Showing ${startIndex + 1}-${Math.min(endIndex, filteredTransactions.length)} of ${filteredTransactions.length} transactions`
            ) : (
              `Showing ${startIndex + 1}-${Math.min(endIndex, filteredTransactions.length)} of ${filteredTransactions.length} filtered (${transactions.length} total)`
            )}
          </p>
          {(searchText || filterAccount || filterType || filterCategory || filterCategoryIds.length > 0 || filterDateFrom || filterDateTo || showOnlySelected) && (
            <button
              onClick={() => {
                setSearchText('');
                setFilterAccount('');
                setFilterType('');
                setFilterCategory('');
                setFilterCategoryIds([]);
                setFilterDateFrom('');
                setFilterDateTo('');
                setShowOnlySelected(false);
                // Clear URL parameters
                window.history.replaceState({}, '', '/transactions');
              }}
              className="btn btn-secondary btn-sm"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Show Only Selected Notice */}
      {showOnlySelected && selectedIds.size > 0 && (
        <div className="card bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-blue-600 dark:text-blue-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  Showing {selectedIds.size} selected transaction{selectedIds.size !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  These transactions were sent to you for categorization
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowOnlySelected(false);
                window.history.replaceState({}, '', '/transactions');
              }}
              className="btn btn-secondary btn-sm"
            >
              Show All Transactions
            </button>
          </div>
        </div>
      )}

      {/* Transactions List */}
      {filteredTransactions.length > 0 ? (
        <>
          <TransactionList 
            transactions={paginatedTransactions} 
            accounts={accounts}
            categories={categories}
            onEdit={setEditingTransaction}
            onInlineEdit={handleInlineEdit}
            onDelete={handleDeleteTransaction}
            onCategoryChange={handleCategoryChange}
            selectedIds={selectedIds}
            onSelectOne={handleSelectOne}
            onSelectAll={handleSelectAll}
            showBulkSelect={true}
          />
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="card">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex gap-2 items-center flex-wrap justify-center">
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <button
                        onClick={() => handlePageChange(1)}
                        className="btn btn-secondary"
                      >
                        1
                      </button>
                      {currentPage > 4 && <span className="text-gray-500">...</span>}
                    </>
                  )}
                  
                  {/* Pages around current */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => 
                      page === currentPage ||
                      page === currentPage - 1 ||
                      page === currentPage - 2 ||
                      page === currentPage + 1 ||
                      page === currentPage + 2
                    )
                    .map(page => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`btn ${
                          page === currentPage
                            ? 'btn-primary'
                            : 'btn-secondary'
                        }`}
                      >
                        {page}
                      </button>
                    ))
                  }
                  
                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="text-gray-500">...</span>}
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        className="btn btn-secondary"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              
              <p className="text-center text-sm text-gray-600 mt-4">
                Page {currentPage} of {totalPages}
              </p>
            </div>
          )}
        </>
      ) : transactions.length > 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No transactions match your search criteria.</p>
          <button
            onClick={() => {
              setSearchText('');
              setFilterAccount('');
              setFilterType('');
              setFilterCategoryIds([]);
              setFilterCategory('');
              setFilterDateFrom('');
              setFilterDateTo('');
            }}
            className="btn btn-secondary"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No transactions yet. Add your first transaction to get started.</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            Add Transaction
          </button>
        </div>
      )}

      </>)}

      {/* ── Categories Tab ─────────────────────────────────────────────────────── */}
      {pageTab === 'categories' && (
        <div className="space-y-6">
          {/* Category sub-tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-4">
              <button onClick={() => setCatSubTab('categories')} className={catSubTabCls('categories')}>
                Categories ({categories.length})
              </button>
              <button onClick={() => setCatSubTab('rules')} className={catSubTabCls('rules')}>
                Auto-Categorization Rules ({categories.reduce((s, c) => s + (c.rules?.length || 0), 0)})
              </button>
            </div>
          </div>

          {showAddCategoryForm && (
            <div id="category-form" className="card">
              <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <form onSubmit={handleCategorySubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Category Name *</label>
                    <input type="text" className="input" value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      required placeholder="e.g., Groceries" />
                  </div>
                  <div>
                    <label className="label">Type *</label>
                    <select className="input" value={categoryFormData.type}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, type: e.target.value as TransactionType })} required>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Color</label>
                    <input type="color" className="input h-10"
                      value={categoryFormData.parentId ? (categories.find(c => c.id === categoryFormData.parentId)?.color || categoryFormData.color) : categoryFormData.color}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                      disabled={!!categoryFormData.parentId} />
                    {categoryFormData.parentId && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Inherits color from parent category</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Parent Category</label>
                    <select className="input" value={categoryFormData.parentId || ''}
                      onChange={(e) => {
                        const parentId = e.target.value ? parseInt(e.target.value) : null;
                        const parentColor = parentId ? categories.find(c => c.id === parentId)?.color : categoryFormData.color;
                        setCategoryFormData({ ...categoryFormData, parentId, isParent: false, color: parentColor || categoryFormData.color });
                      }}
                      disabled={categoryFormData.isParent}>
                      <option value="">None (Top-level category)</option>
                      {categories
                        .filter(c => c.isParent && c.type === categoryFormData.type && c.id !== editingCategory?.id)
                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Make this a subcategory under a parent group</p>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={categoryFormData.isParent || false}
                        onChange={(e) => setCategoryFormData({ ...categoryFormData, isParent: e.target.checked, parentId: e.target.checked ? null : categoryFormData.parentId })}
                        className="w-4 h-4" />
                      <span className="text-sm">This is a parent category (can have subcategories)</span>
                    </label>
                  </div>
                </div>
                <RulesManager categoryId={editingCategory?.id || 0} rules={categoryFormData.rules}
                  onRulesChange={(rules) => setCategoryFormData({ ...categoryFormData, rules })} />
                <div className="flex gap-3">
                  <button type="button" onClick={handleCancelCategoryEdit} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">{editingCategory ? 'Update Category' : 'Add Category'}</button>
                </div>
              </form>
            </div>
          )}

          {catSubTab === 'categories' && (
            <>
              {Object.keys(groupedCategories).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(groupedCategories).map(([type, typeCats]) => {
                    const parentCats = typeCats.filter(c => c.isParent);
                    const childCats = typeCats.filter(c => c.parentId);
                    const standaloneCats = typeCats.filter(c => !c.isParent && !c.parentId);
                    return (
                      <div key={type} className="card">
                        <h2 className="text-xl font-semibold mb-4 capitalize">{type} Categories ({typeCats.length})</h2>
                        <div className="space-y-4">
                          {parentCats.map((parentCat) => {
                            const children = childCats.filter(c => c.parentId === parentCat.id);
                            return (
                              <div key={parentCat.id} className="border dark:border-gray-700 rounded-lg">
                                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                                  <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: parentCat.color || '#3b82f6' }} />
                                      <span className="font-semibold text-lg dark:text-gray-100">{parentCat.name}</span>
                                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">Parent</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => handleEditCategory(parentCat)} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Edit2 size={18} /></button>
                                      <button onClick={() => handleDeleteCategory(parentCat.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"><Trash2 size={18} /></button>
                                    </div>
                                  </div>
                                  {parentCat.rules && parentCat.rules.length > 0 && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 ml-8 mt-1">{parentCat.rules.length} auto-categorization rule{parentCat.rules.length !== 1 ? 's' : ''}</div>
                                  )}
                                </div>
                                {children.length > 0 ? (
                                  <div className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {children.map((childCat) => (
                                        <div key={childCat.id} className="p-3 border dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
                                          <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-sm dark:text-gray-100">{childCat.name}</span>
                                            <div className="flex gap-1">
                                              <button onClick={() => handleEditCategory(childCat)} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Edit2 size={14} /></button>
                                              <button onClick={() => handleDeleteCategory(childCat.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                          </div>
                                          {childCat.rules && childCat.rules.length > 0 && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{childCat.rules.length} rule{childCat.rules.length !== 1 ? 's' : ''}</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400 italic">No subcategories yet.</div>
                                )}
                              </div>
                            );
                          })}
                          {standaloneCats.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {standaloneCats.map((category) => (
                                <div key={category.id} className="p-4 border dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color || '#3b82f6' }} />
                                      <span className="font-medium dark:text-gray-100">{category.name}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => handleEditCategory(category)} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Edit2 size={18} /></button>
                                      <button onClick={() => handleDeleteCategory(category.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"><Trash2 size={18} /></button>
                                    </div>
                                  </div>
                                  {category.rules && category.rules.length > 0 && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 ml-7">{category.rules.length} auto-categorization rule{category.rules.length !== 1 ? 's' : ''}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No categories yet.</p>
                  <button onClick={() => { setShowAddCategoryForm(true); scrollToCategoryForm(); }} className="btn btn-primary">Add Category</button>
                </div>
              )}
            </>
          )}

          {catSubTab === 'rules' && (() => {
            const categoriesWithRules = categories.filter(c => c.rules && c.rules.length > 0);
            return categoriesWithRules.length > 0 ? (
              <div className="space-y-4">
                {categoriesWithRules.map((category) => {
                  const parentCategory = category.parentId ? categories.find(c => c.id === category.parentId) : null;
                  const displayColor = parentCategory?.color || category.color || '#3b82f6';
                  return (
                    <div key={category.id} className="card border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          {!category.parentId && <div className="w-4 h-4 rounded-full" style={{ backgroundColor: displayColor }} />}
                          <div className="flex flex-col">
                            <h3 className="font-semibold text-lg dark:text-gray-100">{category.name}</h3>
                            {parentCategory && <span className="text-sm text-gray-500 dark:text-gray-400">{parentCategory.name}</span>}
                          </div>
                          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">{category.type}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setAddingRuleToCategoryId(category.id)} className="btn btn-sm btn-secondary flex items-center gap-1"><Plus size={14} />Add Rule</button>
                          <button onClick={() => handleRunCategoryRules(category.id)} disabled={runningCategoryId === category.id} className="btn btn-sm btn-primary flex items-center gap-2">
                            {runningCategoryId === category.id ? (<><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Running...</>) : (<><PlayCircle size={16} />Run Rules</>)}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {category.rules?.map((rule) => (
                          <div key={rule.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-gray-700 dark:text-gray-200">{rule.field === 'description' ? 'Description' : rule.field === 'merchant' ? 'Merchant' : 'Amount'}</span>
                                <span className="text-gray-500 dark:text-gray-400">{rule.matchType === 'contains' ? 'contains' : 'matches regex'}</span>
                              </div>
                              <code className="text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded mt-1 inline-block dark:text-gray-300">{rule.pattern}</code>
                            </div>
                            <button onClick={() => handleDeleteRule(category.id, rule.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-3"><Trash2 size={16} /></button>
                          </div>
                        ))}
                        {addingRuleToCategoryId === category.id && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Add New Rule</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label text-xs">Match Field</label>
                                <select className="input input-sm" value={newRuleData.field} onChange={(e) => setNewRuleData({ ...newRuleData, field: e.target.value as any })}>
                                  <option value="description">Description</option>
                                  <option value="merchant">Merchant</option>
                                  <option value="amount">Amount</option>
                                </select>
                              </div>
                              <div>
                                <label className="label text-xs">Match Type</label>
                                <select className="input input-sm" value={newRuleData.matchType} onChange={(e) => setNewRuleData({ ...newRuleData, matchType: e.target.value as any })}>
                                  <option value="contains">Contains</option>
                                  <option value="regex">Regex</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="label text-xs">Pattern</label>
                              <input type="text" className="input input-sm" value={newRuleData.pattern}
                                onChange={(e) => setNewRuleData({ ...newRuleData, pattern: e.target.value })}
                                placeholder={newRuleData.matchType === 'contains' ? 'e.g., Amazon' : 'e.g., ^Amazon.*'} autoFocus />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleAddRule(category.id)} className="btn btn-primary btn-sm" disabled={!newRuleData.pattern}>Add Rule</button>
                              <button onClick={() => { setAddingRuleToCategoryId(null); setNewRuleData({ pattern: '', field: 'description', matchType: 'contains' }); }} className="btn btn-secondary btn-sm">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                  <strong>💡 Tip:</strong> Click "Run Rules" to apply that category&apos;s rules to uncategorized transactions. Use "Auto-Categorize All" above to run all rules at once.
                </div>
              </div>
            ) : (
              <div className="card text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No auto-categorization rules defined yet.</p>
                <button onClick={() => { setCatSubTab('categories'); setShowAddCategoryForm(true); scrollToCategoryForm(); }} className="btn btn-primary">Add a Category with Rules</button>
              </div>
            );
          })()}

          {showAutoCategorizationModal && autoCategorizationPreview && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                  <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">Auto-Categorization Preview</h2>
                  {autoCategorizationPreview.total > 0 ? (
                    <>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        {autoCategorizationPreview.total} uncategorized transaction{autoCategorizationPreview.total !== 1 ? 's' : ''} will be categorized:
                      </p>
                      <div className="space-y-2 mb-6">
                        {Object.entries(autoCategorizationPreview.byCategory).map(([cat, count]: [string, any]) => (
                          <div key={cat} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded">
                            <span className="font-medium dark:text-gray-100">{cat}</span>
                            <span className="text-gray-600 dark:text-gray-300">{count} transaction{count !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => setShowAutoCategorizationModal(false)} className="btn btn-secondary" disabled={isRunningAutoCategorization}>Cancel</button>
                        <button onClick={handleRunAutoCategorization} className="btn btn-primary" disabled={isRunningAutoCategorization}>{isRunningAutoCategorization ? 'Categorizing...' : 'Apply Categorization'}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 dark:text-gray-300 mb-6">No transactions match your categorization rules.</p>
                      <div className="flex justify-end"><button onClick={() => setShowAutoCategorizationModal(false)} className="btn btn-primary">Close</button></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddTransactionModal
          accounts={accounts}
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleTransactionAdded}
        />
      )}

      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditingTransaction(null)}
          onSuccess={handleTransactionEdited}
        />
      )}

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white shadow-2xl border-t border-gray-700 z-50">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-center gap-4 flex-wrap">
                {(() => {
                  const selected = filteredTransactions.filter(t => selectedIds.has(t.id));
                  const expenses = selected.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
                  const income = selected.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
                  const transfers = selected.filter(t => t.type === 'transfer').reduce((s, t) => s + Math.abs(t.amount), 0);
                  const net = income - expenses;
                  return (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold leading-none tabular-nums">{selectedIds.size}</span>
                        <span className="text-xs text-gray-400 leading-tight">transaction{selectedIds.size !== 1 ? 's' : ''}<br/>selected</span>
                      </div>
                      <div className="w-px h-8 bg-gray-600" />
                      {income > 0 && (
                        <div className="flex flex-col items-start bg-emerald-950 border border-emerald-800 rounded-md px-3 py-1">
                          <span className="text-xs uppercase tracking-widest text-emerald-500 font-semibold">Income</span>
                          <span className="font-semibold text-emerald-400 tabular-nums">+${income.toFixed(2)}</span>
                        </div>
                      )}
                      {expenses > 0 && (
                        <div className="flex flex-col items-start bg-red-950 border border-red-900 rounded-md px-3 py-1">
                          <span className="text-xs uppercase tracking-widest text-red-500 font-semibold">Expenses</span>
                          <span className="font-semibold text-red-400 tabular-nums">-${expenses.toFixed(2)}</span>
                        </div>
                      )}
                      {transfers > 0 && (
                        <div className="flex flex-col items-start bg-gray-800 border border-gray-600 rounded-md px-3 py-1">
                          <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Transfers</span>
                          <span className="font-semibold text-gray-200 tabular-nums">${transfers.toFixed(2)}</span>
                        </div>
                      )}
                      {(income > 0 || expenses > 0) && (
                        <>
                          <div className="w-px h-8 bg-gray-600" />
                          <div className="flex flex-col items-start">
                            <span className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Net</span>
                            <span className={`font-bold tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {net >= 0 ? '+' : ''}${net.toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
                
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-transparent border border-red-800 text-red-400 rounded-md hover:bg-red-950 hover:border-red-700 hover:text-red-300 font-medium text-sm transition-colors"
                >
                  Delete Selected
                </button>

                <button
                  onClick={() => setShowEmailModal(true)}
                  className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:border-gray-500 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors"
                  title="Send categorization request via email"
                >
                  <Mail size={16} />
                  Send Email
                </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 rounded-md hover:bg-gray-800 text-sm transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowEmailModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Send Categorization Email</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="label">Recipient Email Address</label>
                <input
                  type="email"
                  className="input"
                  placeholder="recipient@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !sendingEmail) {
                      handleSendEmail();
                    }
                  }}
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The recipient will receive an email with a link to categorize these transactions.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>📧 What will be sent:</strong>
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 ml-4">
                  <li>• List of all selected transactions</li>
                  <li>• Direct link to categorize them</li>
                  <li>• Transaction details (date, amount, description)</li>
                </ul>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                disabled={sendingEmail}
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !recipientEmail}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendingEmail ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
