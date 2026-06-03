'use client';

import { useState } from 'react';
import { CategorizationRule } from '@/lib/types';
import { Plus, Trash2 } from 'lucide-react';

interface RulesManagerProps {
  categoryId: number;
  rules: CategorizationRule[];
  onRulesChange: (rules: CategorizationRule[]) => void;
}

export default function RulesManager({ categoryId, rules = [], onRulesChange }: RulesManagerProps) {
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    pattern: '',
    field: 'description' as 'description' | 'merchant' | 'amount',
    matchType: 'contains' as 'contains' | 'regex',
  });

  const handleAddRule = () => {
    const rule: CategorizationRule = {
      id: Date.now(),
      ...newRule,
    };

    onRulesChange([...rules, rule]);
    setNewRule({ pattern: '', field: 'description', matchType: 'contains' });
    setShowAddRule(false);
  };

  const handleDeleteRule = (ruleId: number) => {
    onRulesChange(rules.filter(r => r.id !== ruleId));
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'description': return 'Description';
      case 'merchant': return 'Merchant';
      case 'amount': return 'Amount';
      default: return field;
    }
  };

  return (
    <div className="mt-4 border-t dark:border-gray-700 pt-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Auto-Categorization Rules</h4>
        <button
          type="button"
          onClick={() => setShowAddRule(!showAddRule)}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
        >
          <Plus size={16} />
          Add Rule
        </button>
      </div>

      {/* Existing Rules */}
      {rules.length > 0 && (
        <div className="space-y-2 mb-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm"
            >
              <div className="flex-1">
                <span className="font-medium dark:text-gray-200">{getFieldLabel(rule.field)}</span>
                <span className="mx-2 text-gray-500 dark:text-gray-400">
                  {rule.matchType === 'contains' ? 'contains' : 'matches regex'}
                </span>
                <code className="bg-white dark:bg-gray-800 dark:text-gray-200 px-2 py-1 rounded text-xs">{rule.pattern}</code>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteRule(rule.id)}
                className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 ml-2"
                title="Delete rule"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Rule Form */}
      {showAddRule && (
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Field to Match</label>
              <select
                className="input input-sm text-sm"
                value={newRule.field}
                onChange={(e) => setNewRule({ ...newRule, field: e.target.value as any })}
              >
                <option value="description">Description</option>
                <option value="merchant">Merchant</option>
                <option value="amount">Amount</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Match Type</label>
              <select
                className="input input-sm text-sm"
                value={newRule.matchType}
                onChange={(e) => setNewRule({ ...newRule, matchType: e.target.value as any })}
              >
                <option value="contains">Contains</option>
                <option value="regex">Regex</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label text-xs">
              Pattern {newRule.matchType === 'regex' && '(Regular Expression)'}
            </label>
            <input
              type="text"
              className="input input-sm text-sm"
              value={newRule.pattern}
              onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
              placeholder={
                newRule.matchType === 'contains' 
                  ? 'e.g., walmart' 
                  : 'e.g., ^AMAZON.*|^AMZ.*'
              }
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {newRule.matchType === 'contains' 
                ? 'Matches if the field contains this text (case-insensitive)'
                : 'Matches using regular expression pattern (case-insensitive)'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddRule(false);
                setNewRule({ pattern: '', field: 'description', matchType: 'contains' });
              }}
              className="btn btn-secondary btn-sm text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddRule}
              disabled={!newRule.pattern}
              className="btn btn-primary btn-sm text-sm"
            >
              Add Rule
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 && !showAddRule && (
        <p className="text-xs text-gray-500 dark:text-gray-400">No rules defined. Add a rule to auto-categorize transactions.</p>
      )}
    </div>
  );
}
