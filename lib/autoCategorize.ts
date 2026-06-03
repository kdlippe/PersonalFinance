import { Transaction, Category, CategorizationRule } from './types';

/**
 * Test if a transaction matches a categorization rule
 */
function testRule(transaction: Transaction, rule: CategorizationRule): boolean {
  let value: string | number;
  
  switch (rule.field) {
    case 'description':
      value = transaction.description || '';
      break;
    case 'merchant':
      value = transaction.merchant || '';
      break;
    case 'amount':
      value = Math.abs(transaction.amount);
      break;
    default:
      return false;
  }

  if (rule.matchType === 'contains') {
    return String(value).toLowerCase().includes(rule.pattern.toLowerCase());
  } else if (rule.matchType === 'regex') {
    try {
      const regex = new RegExp(rule.pattern, 'i');
      return regex.test(String(value));
    } catch (error) {
      console.error('Invalid regex pattern:', rule.pattern, error);
      return false;
    }
  }

  return false;
}

/**
 * Find the best matching category for a transaction based on categorization rules
 */
export function findCategoryForTransaction(
  transaction: Transaction,
  categories: Category[]
): Category | null {
  // Only auto-categorize if transaction doesn't have a category or has default category
  const hasCustomCategory = transaction.category && 
    transaction.category !== 'Uncategorized' &&
    transaction.category !== 'Other';
  
  if (hasCustomCategory) {
    return null; // Don't override user-set categories
  }

  // Don't filter by transaction type since imported transactions may be 'pending'
  // The matched category will set the correct type
  const relevantCategories = categories;

  // Find first category with matching rule
  for (const category of relevantCategories) {
    if (!category.rules || category.rules.length === 0) continue;

    for (const rule of category.rules) {
      if (testRule(transaction, rule)) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Auto-categorize multiple transactions based on category rules
 */
export function autoCategorizeTransactions(
  transactions: Transaction[],
  categories: Category[],
  options: {
    overrideExisting?: boolean; // If true, override all categories, not just Uncategorized/Other
  } = {}
): { transactions: Transaction[]; changed: number; byCategory: Record<string, number> } {
  let changed = 0;
  const byCategory: Record<string, number> = {};

  const updatedTransactions = transactions.map(transaction => {
    // Skip if transaction already has a category and we're not overriding
    if (!options.overrideExisting) {
      const hasCustomCategory = transaction.category && 
        transaction.category !== 'Uncategorized' &&
        transaction.category !== 'Other';
      
      if (hasCustomCategory) {
        return transaction;
      }
    }

    // Find matching category
    const matchedCategory = findCategoryForTransaction(transaction, categories);

    if (matchedCategory) {
      changed++;
      byCategory[matchedCategory.name] = (byCategory[matchedCategory.name] || 0) + 1;
      
      return {
        ...transaction,
        category: matchedCategory.name,
        categoryId: matchedCategory.id,
        type: matchedCategory.type, // Set type from matched category
      };
    }

    return transaction;
  });

  return {
    transactions: updatedTransactions,
    changed,
    byCategory,
  };
}

/**
 * Count how many transactions would be affected by auto-categorization
 */
export function countAffectedTransactions(
  transactions: Transaction[],
  categories: Category[],
  options: { overrideExisting?: boolean } = {}
): { total: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  let total = 0;

  for (const transaction of transactions) {
    // Skip if transaction already has a category and we're not overriding
    if (!options.overrideExisting) {
      const hasCustomCategory = transaction.category && 
        transaction.category !== 'Uncategorized' &&
        transaction.category !== 'Other';
      
      if (hasCustomCategory) {
        continue;
      }
    }

    const matchedCategory = findCategoryForTransaction(transaction, categories);

    if (matchedCategory) {
      byCategory[matchedCategory.name] = (byCategory[matchedCategory.name] || 0) + 1;
      total++;
    }
  }

  return { total, byCategory };
}
