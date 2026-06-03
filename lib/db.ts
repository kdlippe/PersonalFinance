import fs from 'fs';
import path from 'path';
import { Account, Transaction, Position, Category, NetWorthSnapshot } from './types';

/**
 * Database Structure:
 * 
 * data/
 *   accounts.json - Account data and nextId counter
 *   positions.json - Investment positions and nextId counter
 *   categories.json - Transaction categories and nextId counter
 *   net-worth-history.json - Historical net worth snapshots
 *   transactions/
 *     account-1.json - All transactions for account ID 1
 *     account-2.json - All transactions for account ID 2
 *     ... etc
 * 
 * This architecture separates concerns for:
 * - Better organization and clarity
 * - Better performance when loading/saving
 * - Reduced risk of data corruption
 * - Easier to manage and backup individual data types
 */

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const accountsPath = path.join(dataDir, 'accounts.json');
const positionsPath = path.join(dataDir, 'positions.json');
const categoriesPath = path.join(dataDir, 'categories.json');
const transactionsDir = path.join(dataDir, 'transactions');
const dataLogsDir = path.join(dataDir, 'logs');

// Helper function to log database file changes
// This NEVER throws errors - logging failures are silent
function logDatabaseChange(fileName: string, operation: string, details?: any, customTimestamp?: string) {
  try {
    // Ensure logs directory exists
    if (!fs.existsSync(dataLogsDir)) {
      fs.mkdirSync(dataLogsDir, { recursive: true });
    }
    
    const timestamp = customTimestamp || getLocalTimestamp(); // Use provided timestamp or generate new one
    const logEntry = {
      timestamp,
      file: fileName,
      operation,
      details: details || {}
    };
    
    const logFileName = `${fileName.replace('.json', '')}-changes.log`;
    const logPath = path.join(dataLogsDir, logFileName);
    const logLine = JSON.stringify(logEntry) + '\n';
    
    fs.appendFileSync(logPath, logLine, 'utf8');
  } catch (error) {
    // Silent failure - don't let logging errors break the app
    console.error(`[logDatabaseChange] Warning: Failed to log change to ${fileName}:`, error instanceof Error ? error.message : 'Unknown error');
    // DO NOT throw - just log and continue
  }
}

interface Database {
  accounts: Account[];
  transactions: Transaction[];
  positions: Position[];
  categories: Category[];
  netWorthSnapshots: NetWorthSnapshot[];
  nextId: {
    accounts: number;
    transactions: number;
    positions: number;
    categories: number;
    netWorthSnapshots: number;
  };
}

let db: Database | null = null;

// Helper function to load transactions for a specific account
function loadAccountTransactions(accountId: number): Transaction[] {
  const accountTransactionsPath = path.join(transactionsDir, `account-${accountId}.json`);
  try {
    if (fs.existsSync(accountTransactionsPath)) {
      const data = fs.readFileSync(accountTransactionsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading transactions for account ${accountId}:`, error);
  }
  return [];
}

// Helper function to load all transactions from separate account files
function loadAllTransactions(accountIds: number[]): Transaction[] {
  const allTransactions: Transaction[] = [];
  for (const accountId of accountIds) {
    const accountTransactions = loadAccountTransactions(accountId);
    allTransactions.push(...accountTransactions);
  }
  return allTransactions;
}

// Helper function to save transactions for a specific account
function saveAccountTransactions(accountId: number, transactions: Transaction[]) {
  try {
    // Ensure transactions directory exists
    if (!fs.existsSync(transactionsDir)) {
      console.log(`[saveAccountTransactions] Creating transactions directory: ${transactionsDir}`);
      fs.mkdirSync(transactionsDir, { recursive: true });
    }
    
    const accountTransactionsPath = path.join(transactionsDir, `account-${accountId}.json`);
    const jsonData = JSON.stringify(transactions, null, 2);
    
    console.log(`[saveAccountTransactions] Writing ${transactions.length} transactions to account-${accountId}.json (${jsonData.length} bytes)`);
    fs.writeFileSync(accountTransactionsPath, jsonData, 'utf8');
    
    // Verify the write was successful
    if (!fs.existsSync(accountTransactionsPath)) {
      throw new Error(`File was not created at ${accountTransactionsPath}`);
    }
    
    const stats = fs.statSync(accountTransactionsPath);
    console.log(`[saveAccountTransactions] Successfully wrote ${stats.size} bytes to account-${accountId}.json`);
    
    // Verify we can read it back
    const readBack = fs.readFileSync(accountTransactionsPath, 'utf8');
    const parsed = JSON.parse(readBack);
    if (!Array.isArray(parsed) || parsed.length !== transactions.length) {
      throw new Error(`Verification failed: expected ${transactions.length} transactions, got ${Array.isArray(parsed) ? parsed.length : 'invalid data'}`);
    }
    
  } catch (error) {
    console.error(`[saveAccountTransactions] ERROR saving transactions for account ${accountId}:`, error);
    throw new Error(`Failed to save transactions for account ${accountId}: ` + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Helper function to delete an account's transaction file
export function deleteAccountTransactions(accountId: number) {
  const accountTransactionsPath = path.join(transactionsDir, `account-${accountId}.json`);
  try {
    if (fs.existsSync(accountTransactionsPath)) {
      fs.unlinkSync(accountTransactionsPath);
      console.log(`Deleted transaction file for account ${accountId}`);
    }
  } catch (error) {
    console.error(`Error deleting transactions for account ${accountId}:`, error);
  }
}

// Helper functions to load individual data files
function loadAccounts(): { accounts: Account[], nextId: number } {
  try {
    if (fs.existsSync(accountsPath)) {
      const data = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
      return {
        accounts: data.accounts || [],
        nextId: data.nextId || 1
      };
    }
  } catch (error) {
    console.error('Error loading accounts:', error);
  }
  return { accounts: [], nextId: 1 };
}

function loadPositions(): { positions: Position[], nextId: number } {
  try {
    if (fs.existsSync(positionsPath)) {
      const data = JSON.parse(fs.readFileSync(positionsPath, 'utf8'));
      return {
        positions: data.positions || [],
        nextId: data.nextId || 1
      };
    }
  } catch (error) {
    console.error('Error loading positions:', error);
  }
  return { positions: [], nextId: 1 };
}

function loadCategories(): { categories: Category[], nextId: number } {
  try {
    if (fs.existsSync(categoriesPath)) {
      const data = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
      return {
        categories: data.categories || [],
        nextId: data.nextId || 13
      };
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
  return { categories: getDefaultCategories(), nextId: 13 };
}

// Initialize database
function initializeDatabase(): Database {
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Ensure transactions directory exists
  if (!fs.existsSync(transactionsDir)) {
    fs.mkdirSync(transactionsDir, { recursive: true });
  }

  // Load data from separate files
  const accountsData = loadAccounts();
  const positionsData = loadPositions();
  const categoriesData = loadCategories();
  
  // Load transactions from separate account files
  const accountIds = accountsData.accounts.map((a: Account) => a.id);
  const transactions = loadAllTransactions(accountIds);
  
  // Combine into unified database structure
  const database: Database = {
    accounts: accountsData.accounts,
    transactions: transactions,
    positions: positionsData.positions,
    categories: categoriesData.categories,
    netWorthSnapshots: [], // Net worth snapshots are stored in net-worth-history.json
    nextId: {
      accounts: accountsData.nextId,
      transactions: 1, // Will be calculated from existing transactions
      positions: positionsData.nextId,
      categories: categoriesData.nextId,
      netWorthSnapshots: 1, // NetWorth snapshots managed separately
    },
  };
  
  // Calculate next transaction ID from all existing transactions
  if (transactions.length > 0) {
    const maxId = Math.max(...transactions.map(t => t.id));
    database.nextId.transactions = maxId + 1;
  }
  
  // If no data exists, create default structure
  if (accountsData.accounts.length === 0 && positionsData.positions.length === 0) {
    saveDatabase(database);
  }
  
  return database;
}

function getDefaultCategories(): Category[] {
  return [
    { id: 1, name: 'Salary', type: 'income', color: '#10b981' },
    { id: 2, name: 'Investment Income', type: 'income', color: '#3b82f6' },
    { id: 3, name: 'Groceries', type: 'expense', color: '#f59e0b' },
    { id: 4, name: 'Dining Out', type: 'expense', color: '#f59e0b' },
    { id: 5, name: 'Rent/Mortgage', type: 'expense', color: '#ef4444' },
    { id: 6, name: 'Utilities', type: 'expense', color: '#ef4444' },
    { id: 7, name: 'Transportation', type: 'expense', color: '#8b5cf6' },
    { id: 8, name: 'Entertainment', type: 'expense', color: '#ec4899' },
    { id: 9, name: 'Healthcare', type: 'expense', color: '#06b6d4' },
    { id: 10, name: 'Shopping', type: 'expense', color: '#f97316' },
    { id: 11, name: 'Transfer', type: 'transfer', color: '#6b7280' },
    { id: 12, name: 'Uncategorized', type: 'expense', color: '#9ca3af' },
  ];
}

function saveDatabase(data: Database) {
  try {
    console.log(`[saveDatabase] Starting save operation with ${data.transactions.length} transactions, ${data.accounts.length} accounts`);
    
    // Group transactions by account
    const transactionsByAccount = new Map<number, Transaction[]>();
    for (const transaction of data.transactions) {
      if (!transactionsByAccount.has(transaction.accountId)) {
        transactionsByAccount.set(transaction.accountId, []);
      }
      transactionsByAccount.get(transaction.accountId)!.push(transaction);
    }
    
    console.log(`[saveDatabase] Grouped transactions into ${transactionsByAccount.size} account files`);
    
    // Save each account's transactions to its own file
    for (const [accountId, transactions] of transactionsByAccount) {
      console.log(`[saveDatabase] Saving ${transactions.length} transactions for account ${accountId}`);
      saveAccountTransactions(accountId, transactions);
      
      // Verify the file was written
      const accountTransactionsPath = path.join(transactionsDir, `account-${accountId}.json`);
      if (!fs.existsSync(accountTransactionsPath)) {
        throw new Error(`Failed to write transaction file for account ${accountId}`);
      }
      const writtenData = JSON.parse(fs.readFileSync(accountTransactionsPath, 'utf8'));
      if (!Array.isArray(writtenData) || writtenData.length !== transactions.length) {
        throw new Error(`Transaction file verification failed for account ${accountId}: expected ${transactions.length} transactions, found ${Array.isArray(writtenData) ? writtenData.length : 'invalid data'}`);
      }
    }
    
    console.log('[saveDatabase] All transaction files saved and verified');
    
    // Save accounts to accounts.json
    const accountsData = JSON.stringify({
      accounts: data.accounts,
      nextId: data.nextId.accounts
    }, null, 2);
    fs.writeFileSync(accountsPath, accountsData, 'utf8');
    console.log(`[saveDatabase] Saved ${data.accounts.length} accounts to accounts.json`);
    
    // Save positions to positions.json
    const positionsData = JSON.stringify({
      positions: data.positions,
      nextId: data.nextId.positions
    }, null, 2);
    fs.writeFileSync(positionsPath, positionsData, 'utf8');
    console.log(`[saveDatabase] Saved ${data.positions.length} positions to positions.json`);
    
    // Save categories to categories.json
    const categoriesData = JSON.stringify({
      categories: data.categories,
      nextId: data.nextId.categories
    }, null, 2);
    fs.writeFileSync(categoriesPath, categoriesData, 'utf8');
    console.log(`[saveDatabase] Saved ${data.categories.length} categories to categories.json`);
    
    console.log('[saveDatabase] Save operation completed successfully');
    // Net worth snapshots are managed separately in net-worth-history.json
  } catch (error) {
    console.error('[saveDatabase] CRITICAL ERROR saving database:', error);
    throw new Error('Failed to save database: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export function getDatabase(): Database {
  if (!db) {
    db = initializeDatabase();
  }
  return db;
}

export function reloadDatabase(): Database {
  db = initializeDatabase();
  return db;
}

// Invalidate the cache to force reload on next getDatabase() call
export function invalidateCache() {
  db = null;
  console.log('[invalidateCache] Database cache invalidated - next access will reload from disk');
}

// Save only positions (for price updates)
export function savePositions(skipInvalidate = false, sharedTimestamp?: string) {
  if (!db) return;
  try {
    const positionsData = JSON.stringify({
      positions: db.positions,
      nextId: db.nextId.positions
    }, null, 2);
    fs.writeFileSync(positionsPath, positionsData, 'utf8');
    console.log(`[savePositions] Saved ${db.positions.length} positions`);
    
    // Log the change (never throws)
    logDatabaseChange('positions.json', 'save', {
      positionCount: db.positions.length,
      skipInvalidate,
      caller: 'savePositions'
    }, sharedTimestamp);
    
    // Invalidate cache to prevent stale data on next operation
    if (!skipInvalidate) {
      invalidateCache();
    }
  } catch (error) {
    console.error('[savePositions] ERROR:', error);
    throw error;
  }
}

// Save only accounts (for balance updates)
export function saveAccounts(skipInvalidate = false, sharedTimestamp?: string) {
  if (!db) return;
  try {
    const accountsData = JSON.stringify({
      accounts: db.accounts,
      nextId: db.nextId.accounts
    }, null, 2);
    fs.writeFileSync(accountsPath, accountsData, 'utf8');
    console.log(`[saveAccounts] Saved ${db.accounts.length} accounts`);
    
    // Log the change (never throws)
    logDatabaseChange('accounts.json', 'save', {
      accountCount: db.accounts.length,
      skipInvalidate,
      caller: 'saveAccounts'
    }, sharedTimestamp);
    
    // Invalidate cache to prevent stale data on next operation
    if (!skipInvalidate) {
      invalidateCache();
    }
  } catch (error) {
    console.error('[saveAccounts] ERROR:', error);
    throw error;
  }
}

// Save both positions and accounts together (for operations that modify both)
export function savePositionsAndAccounts() {
  if (!db) {
    console.error('[savePositionsAndAccounts] ERROR: db is null! Cannot save.');
    throw new Error('Database is null - cannot save positions and accounts');
  }
  try {
    console.log('[savePositionsAndAccounts] Saving positions and accounts...');
    console.log('[savePositionsAndAccounts] DB has', db.positions.length, 'positions and', db.accounts.length, 'accounts');
    
    // Generate one timestamp for both saves so they match in the logs
    const timestamp = getLocalTimestamp();
    
    savePositions(true, timestamp);  // Skip invalidate, use shared timestamp
    saveAccounts(true, timestamp);   // Skip invalidate, use shared timestamp
    invalidateCache();    // Invalidate once after both saves
    
    console.log('[savePositionsAndAccounts] Both files saved, cache invalidated');
  } catch (error) {
    console.error('[savePositionsAndAccounts] ERROR:', error);
    throw error;
  }
}

// Save both transactions and accounts together (for transaction add/edit/delete operations).
// CRITICAL: saveTransactions() calls invalidateCache() which sets db=null, so calling
// saveAccounts() after it is a silent no-op. This function saves both safely by deferring
// cache invalidation until after both writes are complete.
export function saveTransactionsAndAccounts() {
  if (!db) {
    console.error('[saveTransactionsAndAccounts] ERROR: db is null! Cannot save.');
    throw new Error('Database is null - cannot save transactions and accounts');
  }
  try {
    console.log('[saveTransactionsAndAccounts] Saving transactions and accounts...');

    // Save transactions to per-account files (skip invalidate so db stays non-null)
    const transactionsByAccount = new Map<number, Transaction[]>();
    for (const transaction of db.transactions) {
      if (!transactionsByAccount.has(transaction.accountId)) {
        transactionsByAccount.set(transaction.accountId, []);
      }
      transactionsByAccount.get(transaction.accountId)!.push(transaction);
    }
    for (const [accountId, transactions] of transactionsByAccount) {
      saveAccountTransactions(accountId, transactions);
    }
    console.log(`[saveTransactionsAndAccounts] Saved transactions for ${transactionsByAccount.size} account files`);

    // Generate one timestamp for both log entries so they match
    const timestamp = getLocalTimestamp();

    logDatabaseChange('transactions', 'save', {
      accountCount: transactionsByAccount.size,
      transactionCount: db.transactions.length,
      caller: 'saveTransactionsAndAccounts'
    }, timestamp);

    // Save accounts (must happen before invalidateCache nulls db)
    saveAccounts(true, timestamp);  // skipInvalidate=true — we invalidate below

    // Invalidate once after both writes are complete
    invalidateCache();

    console.log('[saveTransactionsAndAccounts] Both files saved, cache invalidated');
  } catch (error) {
    console.error('[saveTransactionsAndAccounts] ERROR:', error);
    throw error;
  }
}

// Save only transactions (for transaction operations)
// CRITICAL DATA INTEGRITY RULE: Once transactions are committed to disk, they should 
// NEVER be removed or modified except by explicit user action (delete/edit transaction).
// This function saves ALL transactions currently in memory to their respective account files.
// Always verify transaction counts match before calling this function after operations
// that reassign db.transactions to avoid accidental data loss.
export function saveTransactions() {
  if (!db) return;
  try {
    const transactionsByAccount = new Map<number, Transaction[]>();
    for (const transaction of db.transactions) {
      if (!transactionsByAccount.has(transaction.accountId)) {
        transactionsByAccount.set(transaction.accountId, []);
      }
      transactionsByAccount.get(transaction.accountId)!.push(transaction);
    }
    
    for (const [accountId, transactions] of transactionsByAccount) {
      saveAccountTransactions(accountId, transactions);
    }
    console.log(`[saveTransactions] Saved transactions for ${transactionsByAccount.size} accounts`);
    // Invalidate cache to prevent stale data on next operation
    invalidateCache();
  } catch (error) {
    console.error('[saveTransactions] ERROR:', error);
    throw error;
  }
}

// Save only categories
export function saveCategories() {
  if (!db) return;
  try {
    const categoriesData = JSON.stringify({
      categories: db.categories,
      nextId: db.nextId.categories
    }, null, 2);
    fs.writeFileSync(categoriesPath, categoriesData, 'utf8');
    console.log(`[saveCategories] Saved ${db.categories.length} categories`);
    // Invalidate cache to prevent stale data on next operation
    invalidateCache();
  } catch (error) {
    console.error('[saveCategories] ERROR:', error);
    throw error;
  }
}

// Save everything (use sparingly - only when multiple data types are changed)
export function saveDb() {
  if (db) {
    try {
      console.log('[saveDb] Initiating full database save...');
      saveDatabase(db);
      console.log('[saveDb] Database save completed successfully');
      // Invalidate cache to prevent stale data on next operation
      invalidateCache();
    } catch (error) {
      console.error('[saveDb] CRITICAL: Failed to save database:', error);
      throw error; // Re-throw to let caller handle the error
    }
  } else {
    console.warn('[saveDb] No database instance to save');
  }
}

// Helper function to convert snake_case to camelCase
export function toCamelCase<T>(obj: any): T {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase) as T;
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {} as any) as T;
  }
  return obj;
}

// Helper function to convert camelCase to snake_case
export function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = toSnakeCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

// Helper function to calculate and save current net worth snapshot
export function saveNetWorthSnapshot() {
  const db = getDatabase();
  
  // Ensure netWorthSnapshots array exists
  if (!db.netWorthSnapshots) {
    db.netWorthSnapshots = [];
  }
  if (!db.nextId.netWorthSnapshots) {
    db.nextId.netWorthSnapshots = 1;
  }
  
  const nowDate = new Date();
  const now = getLocalTimestamp();
  const today = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
  
  // Check if we already have a snapshot for today
  const existingToday = db.netWorthSnapshots.find(s => s.date === today);
  
  // Calculate current values
  const totalAssets = db.accounts
    .filter(a => ['checking', 'savings', 'brokerage', 'investment'].includes(a.type))
    .reduce((sum, a) => sum + a.balance, 0);
    
  const retirementAssets = db.accounts
    .filter(a => a.type === 'retirement')
    .reduce((sum, a) => sum + a.balance, 0);
    
  const totalLiabilities = db.accounts
    .filter(a => ['credit_card', 'loan'].includes(a.type))
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);
    
  const netWorth = totalAssets + retirementAssets - totalLiabilities;
  
  if (existingToday) {
    // Update existing snapshot for today
    existingToday.netWorth = netWorth;
    existingToday.totalAssets = totalAssets;
    existingToday.totalLiabilities = totalLiabilities;
    existingToday.retirementAssets = retirementAssets;
  } else {
    // Create new snapshot
    const snapshot: NetWorthSnapshot = {
      id: db.nextId.netWorthSnapshots++,
      date: today,
      netWorth,
      totalAssets,
      totalLiabilities,
      retirementAssets,
      createdAt: now,
    };
    db.netWorthSnapshots.push(snapshot);
  }
  
  saveDb();
}

// Import History Management
const importHistoryPath = path.join(dataDir, 'import-history.json');

export interface ImportEvent {
  id: number;
  timestamp: string;
  accountId: number;
  accountName: string;
  fileName: string;
  csvType: 'transaction' | 'position';
  format: string;
  imported: number;
  updated?: number;
  skipped: number;
  errors: number;
  rowResults?: Array<{
    row: number;
    status: 'success' | 'updated' | 'skipped' | 'error';
    data?: any;
    reason?: string;
  }>;
}

interface ImportHistory {
  imports: ImportEvent[];
  nextId: number;
}

function loadImportHistory(): ImportHistory {
  try {
    if (fs.existsSync(importHistoryPath)) {
      const data = JSON.parse(fs.readFileSync(importHistoryPath, 'utf8'));
      return {
        imports: data.imports || [],
        nextId: data.nextId || 1
      };
    }
  } catch (error) {
    console.error('Error loading import history:', error);
  }
  return { imports: [], nextId: 1 };
}

function saveImportHistory(history: ImportHistory) {
  try {
    fs.writeFileSync(importHistoryPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving import history:', error);
    throw new Error('Failed to save import history: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export function logImportEvent(event: Omit<ImportEvent, 'id' | 'timestamp'>) {
  const history = loadImportHistory();
  
  const importEvent: ImportEvent = {
    id: history.nextId++,
    timestamp: getLocalTimestamp(),
    ...event
  };
  
  history.imports.unshift(importEvent); // Add to beginning for reverse chronological order
  saveImportHistory(history);
  
  return importEvent;
}

export function getImportHistory(): ImportEvent[] {
  const history = loadImportHistory();
  return history.imports;
}

// Price Update History Management
const priceUpdateHistoryPath = path.join(dataDir, 'price-update-history.json');

export interface PriceUpdateEvent {
  id: number;
  timestamp: string;
  trigger: 'manual' | 'automatic' | 'scheduled';
  updated: number;
  errors: number;
  duration: number; // milliseconds
  errorDetails?: Array<{
    symbol: string;
    error: string;
  }>;
}

interface PriceUpdateHistory {
  updates: PriceUpdateEvent[];
  nextId: number;
}

function loadPriceUpdateHistory(): PriceUpdateHistory {
  try {
    if (fs.existsSync(priceUpdateHistoryPath)) {
      const data = JSON.parse(fs.readFileSync(priceUpdateHistoryPath, 'utf8'));
      return {
        updates: data.updates || [],
        nextId: data.nextId || 1
      };
    }
  } catch (error) {
    console.error('Error loading price update history:', error);
  }
  return { updates: [], nextId: 1 };
}

function savePriceUpdateHistory(history: PriceUpdateHistory) {
  try {
    fs.writeFileSync(priceUpdateHistoryPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving price update history:', error);
    // DO NOT throw - logging should never break the app
  }
}

export function getLocalTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function logPriceUpdate(event: Omit<PriceUpdateEvent, 'id' | 'timestamp'>) {
  try {
    const history = loadPriceUpdateHistory();
    
    const updateEvent: PriceUpdateEvent = {
      id: history.nextId++,
      timestamp: getLocalTimestamp(),
      ...event
    };
    
    history.updates.unshift(updateEvent); // Add to beginning for reverse chronological order
    
    // Keep only last 1000 updates to prevent file from growing too large
    if (history.updates.length > 1000) {
      history.updates = history.updates.slice(0, 1000);
    }
    
    savePriceUpdateHistory(history);
    
    // Also append to dedicated log file for easy viewing
    const logPath = path.join(dataDir, '..', 'logs', 'price-updates.log');
    const logDir = path.dirname(logPath);
    
    // Ensure logs directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logLine = `[${updateEvent.timestamp}] ${updateEvent.trigger.toUpperCase()} - Updated: ${updateEvent.updated}, Errors: ${updateEvent.errors}, Duration: ${updateEvent.duration}ms${updateEvent.errorDetails && updateEvent.errorDetails.length > 0 ? ` | Failed: ${updateEvent.errorDetails.map(e => e.symbol).join(', ')}` : ''}\n`;
    
    try {
      fs.appendFileSync(logPath, logLine, 'utf8');
    } catch (error) {
      console.error('Error writing to price update log:', error);
    }
    
    return updateEvent;
  } catch (error) {
    console.error('Error in logPriceUpdate:', error);
    // Return a dummy event on error so callers don't break
    return {
      id: 0,
      timestamp: getLocalTimestamp(),
      ...event
    };
  }
}

export function getPriceUpdateHistory(limit: number = 100): PriceUpdateEvent[] {
  const history = loadPriceUpdateHistory();
  return history.updates.slice(0, limit);
}
