'use client';

import { useEffect, useState } from 'react';
import { Category, TransactionType, CategorizationRule } from '@/lib/types';
import { Plus, Edit2, Trash2, Zap, PlayCircle } from 'lucide-react';
import RulesManager from '@/components/RulesManager';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    type: TransactionType;
    color: string;
    rules: CategorizationRule[];
    parentId?: number | null;
    isParent?: boolean;
  }>({
    name: '',
    type: 'expense' as TransactionType,
    color: '#3b82f6',
    rules: [],
    parentId: null,
    isParent: false,
  });
  const [showAutoCategorizationModal, setShowAutoCategorizationModal] = useState(false);
  const [autoCategorizationPreview, setAutoCategorizationPreview] = useState<any>(null);
  const [isRunningAutoCategorization, setIsRunningAutoCategorization] = useState(false);
  const [runningCategoryId, setRunningCategoryId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'rules'>('categories');
  const [addingRuleToCategoryId, setAddingRuleToCategoryId] = useState<number | null>(null);
  const [newRuleData, setNewRuleData] = useState({
    pattern: '',
    field: 'description' as 'description' | 'merchant' | 'amount',
    matchType: 'contains' as 'contains' | 'regex',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      
      const payload = editingCategory 
        ? { id: editingCategory.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        fetchCategories();
        setShowAddForm(false);
        setEditingCategory(null);
        setFormData({ name: '', type: 'expense', color: '#3b82f6', rules: [], parentId: null, isParent: false });
      } else {
        alert('Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category');
    }
  };

  const scrollToForm = () => {
    setTimeout(() => {
      const formElement = document.getElementById('category-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color || '#3b82f6',
      rules: category.rules || [],
      parentId: category.parentId || null,
      isParent: category.isParent || false,
    });
    setShowAddForm(true);
    scrollToForm();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingCategory(null);
    setFormData({ name: '', type: 'expense', color: '#3b82f6', rules: [], parentId: null, isParent: false });
  };

  const handlePreviewAutoCategorization = async () => {
    setIsRunningAutoCategorization(true);
    try {
      const response = await fetch('/api/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', overrideExisting: false }),
      });

      const result = await response.json();
      setAutoCategorizationPreview(result);
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
        window.location.reload();
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
        body: JSON.stringify({ 
          action: 'apply', 
          overrideExisting: false,
          categoryId 
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        const category = categories.find(c => c.id === categoryId);
        alert(`Successfully categorized ${result.total} transactions with "${category?.name}" rules!`);
        window.location.reload();
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
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;

      const updatedRules = (category.rules || []).filter(r => r.id !== ruleId);

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
        fetchCategories();
      } else {
        alert('Failed to delete rule');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    }
  };

  const handleAddRule = async (categoryId: number) => {
    if (!newRuleData.pattern) {
      alert('Please enter a pattern');
      return;
    }

    try {
      const category = categories.find(c => c.id === categoryId);
      if (!category) return;

      const newRule: CategorizationRule = {
        id: Date.now(),
        pattern: newRuleData.pattern,
        field: newRuleData.field,
        matchType: newRuleData.matchType,
      };

      const updatedRules = [...(category.rules || []), newRule];

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

  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.type]) {
      acc[cat.type] = [];
    }
    acc[cat.type].push(cat);
    return acc;
  }, {} as Record<string, Category[]>);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">Categories</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage your transaction categories</p>
        </div>
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
            onClick={() => { setShowAddForm(true); setActiveTab('categories'); scrollToForm(); }} 
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Add Category
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'categories'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'rules'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Auto-Categorization Rules ({categories.reduce((sum, c) => sum + (c.rules?.length || 0), 0)})
          </button>
        </div>
      </div>

      {showAddForm && (
        <div id="category-form" className="card">
          <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">
            {editingCategory ? 'Edit Category' : 'Add New Category'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Category Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Groceries"
                />
              </div>
              <div>
                <label className="label">Type *</label>
                <select
                  className="input"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType })}
                  required
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="label">Color</label>
                <input
                  type="color"
                  className="input h-10"
                  value={formData.parentId ? (categories.find(c => c.id === formData.parentId)?.color || formData.color) : formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  disabled={!!formData.parentId}
                />
                {formData.parentId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Inherits color from parent category
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Parent Category</label>
                <select
                  className="input"
                  value={formData.parentId || ''}
                  onChange={(e) => {
                    const parentId = e.target.value ? parseInt(e.target.value) : null;
                    const parentColor = parentId ? categories.find(c => c.id === parentId)?.color : formData.color;
                    setFormData({ 
                      ...formData, 
                      parentId,
                      isParent: false, // Can't be both parent and child
                      color: parentColor || formData.color // Inherit parent's color
                    });
                  }}
                  disabled={formData.isParent}
                >
                  <option value="">None (Top-level category)</option>
                  {categories
                    .filter(c => c.isParent && c.type === formData.type && c.id !== editingCategory?.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Make this a subcategory under a parent group
                </p>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isParent || false}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      isParent: e.target.checked,
                      parentId: e.target.checked ? null : formData.parentId // Clear parent if making this a parent
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    This is a parent category (can have subcategories)
                  </span>
                </label>
              </div>
            </div>

            <RulesManager
              categoryId={editingCategory?.id || 0}
              rules={formData.rules}
              onRulesChange={(rules) => setFormData({ ...formData, rules })}
            />

            <div className="flex gap-3">
              <button type="button" onClick={handleCancel} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingCategory ? 'Update Category' : 'Add Category'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <>
          {Object.keys(groupedCategories).length > 0 ? (
            <div className="space-y-6">
          {Object.entries(groupedCategories).map(([type, typeCats]) => {
            // Separate parent categories and orphaned categories
            const parentCats = typeCats.filter(c => c.isParent);
            const childCats = typeCats.filter(c => c.parentId);
            const standaloneCats = typeCats.filter(c => !c.isParent && !c.parentId);

            return (
              <div key={type} className="card">
                <h2 className="text-xl font-semibold mb-4 capitalize">
                  {type} Categories ({typeCats.length})
                </h2>
                <div className="space-y-4">
                  {/* Parent categories with their children */}
                  {parentCats.map((parentCat) => {
                    const children = childCats.filter(c => c.parentId === parentCat.id);
                    return (
                      <div key={parentCat.id} className="border dark:border-gray-700 rounded-lg">
                        {/* Parent category */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-5 h-5 rounded-full"
                                style={{ backgroundColor: parentCat.color || '#3b82f6' }}
                              />
                              <span className="font-semibold text-lg dark:text-gray-100">{parentCat.name}</span>
                              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                                Parent
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(parentCat)}
                                className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Edit category"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(parentCat.id)}
                                className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                title="Delete category"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                          {parentCat.rules && parentCat.rules.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 ml-8 mt-1">
                              {parentCat.rules.length} auto-categorization rule{parentCat.rules.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                        
                        {/* Child categories */}
                        {children.length > 0 && (
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {children.map((childCat) => (
                                <div
                                  key={childCat.id}
                                  className="p-3 border dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm dark:text-gray-100">{childCat.name}</span>
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleEdit(childCat)}
                                        className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                        title="Edit subcategory"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(childCat.id)}
                                        className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                        title="Delete subcategory"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  {childCat.rules && childCat.rules.length > 0 && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {childCat.rules.length} rule{childCat.rules.length !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {children.length === 0 && (
                          <div className="p-4 text-sm text-gray-500 dark:text-gray-400 italic">
                            No subcategories yet. Add a subcategory to organize transactions under {parentCat.name}.
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Standalone categories (no parent) */}
                  {standaloneCats.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {standaloneCats.map((category) => (
                        <div
                          key={category.id}
                          className="p-4 border dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: category.color || '#3b82f6' }}
                              />
                              <span className="font-medium dark:text-gray-100">{category.name}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(category)}
                                className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Edit category"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(category.id)}
                                className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                title="Delete category"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                          {category.rules && category.rules.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                              {category.rules.length} auto-categorization rule{category.rules.length !== 1 ? 's' : ''}
                            </div>
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
          <p className="text-gray-500 dark:text-gray-400 mb-4">No categories yet. Add your first category to get started.</p>
          <button onClick={() => { setShowAddForm(true); scrollToForm(); }} className="btn btn-primary">
            Add Category
          </button>
        </div>
      )}
        </>
      )}

      {/* Auto-Categorization Rules Tab */}
      {activeTab === 'rules' && (() => {
        const categoriesWithRules = categories.filter(c => c.rules && c.rules.length > 0);

        return (
          <>
            {categoriesWithRules.length > 0 ? (
              <div className="space-y-4">
              {categoriesWithRules.map((category) => {
                const parentCategory = category.parentId ? categories.find(c => c.id === category.parentId) : null;
                const displayColor = parentCategory?.color || category.color || '#3b82f6';
                
                return (
                  <div key={category.id} className="card border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        {!category.parentId && (
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: displayColor }}
                          />
                        )}
                        <div className="flex flex-col">
                          <h3 className="font-semibold text-lg dark:text-gray-100">{category.name}</h3>
                          {parentCategory && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {parentCategory.name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                          {category.type}
                        </span>
                      </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAddingRuleToCategoryId(category.id)}
                        className="btn btn-sm btn-secondary flex items-center gap-1"
                        title="Add new rule"
                      >
                        <Plus size={14} />
                        Add Rule
                      </button>
                      <button
                        onClick={() => handleRunCategoryRules(category.id)}
                        disabled={runningCategoryId === category.id}
                        className="btn btn-sm btn-primary flex items-center gap-2"
                        title={`Run all rules for ${category.name}`}
                      >
                        {runningCategoryId === category.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            Running...
                          </>
                        ) : (
                          <>
                            <PlayCircle size={16} />
                            Run Rules
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {category.rules?.map((rule) => (
                      <div
                        key={rule.id}
                        className="bg-gray-50 dark:bg-gray-800 p-3 rounded flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-700 dark:text-gray-200">
                              {rule.field === 'description' ? 'Description' : 
                               rule.field === 'merchant' ? 'Merchant' : 'Amount'}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {rule.matchType === 'contains' ? 'contains' : 'matches regex'}
                            </span>
                          </div>
                          <code className="text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded mt-1 inline-block dark:text-gray-300">
                            {rule.pattern}
                          </code>
                        </div>
                        <button
                          onClick={() => handleDeleteRule(category.id, rule.id)}
                          className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-3"
                          title="Delete rule"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}

                    {addingRuleToCategoryId === category.id && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Add New Rule</h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label text-xs">Match Field</label>
                            <select
                              className="input input-sm"
                              value={newRuleData.field}
                              onChange={(e) => setNewRuleData({ ...newRuleData, field: e.target.value as any })}
                            >
                              <option value="description">Description</option>
                              <option value="merchant">Merchant</option>
                              <option value="amount">Amount</option>
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">Match Type</label>
                            <select
                              className="input input-sm"
                              value={newRuleData.matchType}
                              onChange={(e) => setNewRuleData({ ...newRuleData, matchType: e.target.value as any })}
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
                            value={newRuleData.pattern}
                            onChange={(e) => setNewRuleData({ ...newRuleData, pattern: e.target.value })}
                            placeholder={newRuleData.matchType === 'contains' ? 'e.g., Amazon' : 'e.g., ^Amazon.*'}
                            autoFocus
                          />
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {newRuleData.matchType === 'contains'
                              ? `Match when ${newRuleData.field} contains this text (case-insensitive)`
                              : `Match when ${newRuleData.field} matches this regex pattern`
                            }
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddRule(category.id)}
                            className="btn btn-primary btn-sm"
                            disabled={!newRuleData.pattern}
                          >
                            Add Rule
                          </button>
                          <button
                            onClick={() => {
                              setAddingRuleToCategoryId(null);
                              setNewRuleData({ pattern: '', field: 'description', matchType: 'contains' });
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
              );
              })}

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                  <strong>💡 Tip:</strong> Click "Run Rules" to apply that category's rules to uncategorized transactions. 
                  Use "Auto-Categorize All" above to run all rules at once.
                </div>
              </div>
            ) : (
              <div className="card text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No auto-categorization rules defined yet.</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Rules help automatically categorize transactions based on description, merchant, or amount patterns.
                </p>
                <button 
                  onClick={() => { 
                    setActiveTab('categories'); 
                    setShowAddForm(true); 
                    scrollToForm(); 
                  }} 
                  className="btn btn-primary"
                >
                  Add a Category with Rules
                </button>
              </div>
            )}
          </>
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
                    {Object.entries(autoCategorizationPreview.byCategory).map(([category, count]: [string, any]) => (
                      <div key={category} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        <span className="font-medium dark:text-gray-100">{category}</span>
                        <span className="text-gray-600 dark:text-gray-300">{count} transaction{count !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowAutoCategorizationModal(false)}
                      className="btn btn-secondary"
                      disabled={isRunningAutoCategorization}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRunAutoCategorization}
                      className="btn btn-primary"
                      disabled={isRunningAutoCategorization}
                    >
                      {isRunningAutoCategorization ? 'Categorizing...' : 'Apply Categorization'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    No transactions match your categorization rules. 
                    All transactions are already categorized or no rules are defined.
                  </p>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowAutoCategorizationModal(false)}
                      className="btn btn-primary"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
