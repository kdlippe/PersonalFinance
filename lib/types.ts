export type AccountType = 'checking' | 'savings' | 'credit_card' | 'brokerage' | 'investment' | 'retirement' | 'loan' | 'crypto';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'pending';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  institution?: string;
  accountNumber?: string;
  defaultParser?: string; // Default CSV parser name for this account
  defaultPositionParser?: string; // Default position parser for investment accounts
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  accountId: number;
  date: string;
  amount: number;
  type: TransactionType;
  category: string;
  categoryId?: number; // ID of the specific category to handle duplicates
  description: string;
  merchant?: string;
  tags?: string;
  notes?: string;
  isReconciled: boolean;
  createdAt: string;
}

export interface Position {
  id: number;
  accountId: number;
  symbol: string;
  description?: string;
  assetType: string;
  quantity: number;
  costBasis: number;
  currentValue: number;
  currentPrice?: number;
  dailyChange?: number; // Daily percentage change
  dailyChangeAmount?: number; // Daily dollar change (total for position)
  priceChange?: number; // Per-share price change
  manualPriceUpdate?: boolean; // If true, skip automatic price updates
  lastUpdated?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategorizationRule {
  id: number;
  pattern: string; // Regex pattern
  field: 'description' | 'merchant' | 'amount';
  matchType: 'contains' | 'regex';
}

export interface Category {
  id: number;
  name: string;
  type: TransactionType;
  parentId?: number | null;
  color?: string;
  rules?: CategorizationRule[];
  isParent?: boolean; // True for parent categories that can have children
}

export interface AccountSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accountsByType: Record<AccountType, number>;
}

export interface NetWorthSnapshot {
  id: number;
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  retirementAssets: number;
  createdAt: string;
}
