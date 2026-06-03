// Background Net Worth Snapshot Service
// This service runs automatically when the app starts and creates daily snapshots

import { reloadDatabase, getLocalTimestamp } from './db';
import { netWorthLogger as logger } from './logger';
import fs from 'fs';
import path from 'path';

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let lastSnapshotDate: string | null = null;

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const netWorthPath = path.join(dataDir, 'net-worth-history.json');
const logPath = path.join(process.cwd(), 'logs', 'net-worth.log');

function logToFile(message: string) {
  try {
    const timestamp = getLocalTimestamp();
    const line = `[${timestamp}] ${message}\n`;
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (err) {
    // don't let logging failures break the service
  }
}

// Schedule configuration - take snapshot at 6:00 AM daily
const SNAPSHOT_HOUR = 6;
const SNAPSHOT_MINUTE = 0;

interface NetWorthSnapshot {
  date: string;
  netWorth: number;
  accountBalances?: Record<string, number>;
  totalAssets?: number;
  totalLiabilities?: number;
  retirementAssets?: number;
  source: string;
  createdAt?: string;
}

interface NetWorthHistory {
  lastUpdated: string;
  totalSnapshots: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  snapshots: NetWorthSnapshot[];
}

function loadNetWorthHistory(): NetWorthHistory {
  try {
    if (fs.existsSync(netWorthPath)) {
      const data = fs.readFileSync(netWorthPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Error loading history:', error);
  }

  return {
    lastUpdated: getLocalTimestamp(),
    totalSnapshots: 0,
    dateRange: { start: null, end: null },
    snapshots: [],
  };
}

function saveNetWorthHistory(history: NetWorthHistory) {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(netWorthPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    logger.error('Error saving history:', error);
    throw error;
  }
}

async function createSnapshot(): Promise<{ success: boolean; snapshot?: NetWorthSnapshot; message: string }> {
  try {
    const db = reloadDatabase();
    const today = getLocalDateString();
    
    // Calculate current net worth from accounts
    const totalAssets = db.accounts
      .filter(a => ['checking', 'savings', 'brokerage', 'investment', 'crypto'].includes(a.type))
      .reduce((sum, a) => sum + a.balance, 0);
      
    const retirementAssets = db.accounts
      .filter(a => a.type === 'retirement')
      .reduce((sum, a) => sum + a.balance, 0);
      
    const totalLiabilities = db.accounts
      .filter(a => ['credit_card', 'loan'].includes(a.type))
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);
      
    const netWorth = totalAssets + retirementAssets - totalLiabilities;
    
    // Get account balances keyed by account ID (stable across renames)
    const accountBalances: Record<string, number> = {};
    db.accounts.forEach(account => {
      if (account.balance !== 0) {
        accountBalances[String(account.id)] = account.balance;
      }
    });
    
    // Load history
    const history = loadNetWorthHistory();
    
    // Check if snapshot for today already exists
    const existingIndex = history.snapshots.findIndex(s => s.date === today);
    
    const snapshot: NetWorthSnapshot = {
      date: today,
      netWorth,
      totalAssets,
      totalLiabilities,
      retirementAssets,
      accountBalances,
      source: 'automatic',
      createdAt: getLocalTimestamp(),
    };
    
    if (existingIndex >= 0) {
      // Update existing snapshot
      history.snapshots[existingIndex] = snapshot;
    } else {
      // Add new snapshot
      history.snapshots.push(snapshot);
      history.snapshots.sort((a, b) => a.date.localeCompare(b.date));
    }
    
    // Update metadata
    history.lastUpdated = getLocalTimestamp();
    history.totalSnapshots = history.snapshots.length;
    history.dateRange = {
      start: history.snapshots[0]?.date || null,
      end: history.snapshots[history.snapshots.length - 1]?.date || null,
    };
    
    saveNetWorthHistory(history);
    
    const message = existingIndex >= 0 ? 'Updated today\'s snapshot' : 'Created new snapshot';
    const logLine = `${message} - Net Worth: $${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Assets: $${totalAssets.toLocaleString()}, Retirement: $${retirementAssets.toLocaleString()}, Liabilities: $${totalLiabilities.toLocaleString()})`;
    logger.info(logLine);
    logToFile(logLine);
    
    return {
      success: true,
      snapshot,
      message,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to create snapshot - ${errorMessage}`, error);
    return {
      success: false,
      message: errorMessage,
    };
  }
}

function shouldCreateSnapshot(): boolean {
  const now = new Date();
  const today = getLocalDateString(now);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Check if it's time to create snapshot (6:00 AM)
  if (currentHour === SNAPSHOT_HOUR && currentMinute === SNAPSHOT_MINUTE) {
    // Check if we haven't created a snapshot today
    if (lastSnapshotDate !== today) {
      return true;
    }
  }
  
  return false;
}

async function checkAndCreateSnapshot() {
  if (!isRunning) return;
  
  if (shouldCreateSnapshot()) {
    const today = getLocalDateString();
    logger.info('Scheduled snapshot time reached, creating daily snapshot...');
    
    try {
      const result = await createSnapshot();
      lastSnapshotDate = today;
      
      if (result.success) {
        // Already logged in createSnapshot()
      } else {
        // Already logged in createSnapshot()
      }
    } catch (error) {
      logger.error(`Unexpected error during snapshot creation - ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }
}

export function startNetWorthService() {
  if (isRunning) {
    logger.info('Already running');
    return;
  }
  
  const scheduleStr = `${SNAPSHOT_HOUR.toString().padStart(2, '0')}:${SNAPSHOT_MINUTE.toString().padStart(2, '0')}`;
  logger.info('Service starting - Schedule: Daily at ' + scheduleStr);
  logger.info('Starting background net worth snapshot service...');
  logger.info(`Schedule: Daily at ${scheduleStr}`);
  logToFile(`Service starting - Schedule: Daily at ${scheduleStr}`);
  
  isRunning = true;
  
  // Check every minute if it's time to create a snapshot
  intervalId = setInterval(checkAndCreateSnapshot, 60000); // 60 seconds
  
  // Also check immediately on startup if we missed today's snapshot
  checkMissedSnapshot();
  
  logger.info('Service started successfully');
  logToFile('Service started successfully');
}

async function checkMissedSnapshot() {
  const now = new Date();
  const today = getLocalDateString(now);
  const currentHour = now.getHours();
  
  // If it's past snapshot time and we haven't created one today, create it now
  if (currentHour >= SNAPSHOT_HOUR) {
    try {
      const history = loadNetWorthHistory();
      const hasSnapshotToday = history.snapshots.some(s => s.date === today);
      
      if (!hasSnapshotToday) {
        logger.info('Missed snapshot detected on startup, creating now...');
        logToFile('Missed snapshot detected on startup, creating now...');
        const result = await createSnapshot();
        if (result.success) {
          lastSnapshotDate = today;
          // Already logged in createSnapshot()
        }
      }
    } catch (error) {
      logger.error(`Failed to check for missed snapshot - ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }
}

export function stopNetWorthService() {
  if (!isRunning) {
    logger.info('Not running');
    return;
  }
  
  logger.info('Service stopping...');
  
  isRunning = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  logger.info('Service stopped');
}

export function getNetWorthServiceStatus() {
  const actuallyRunning = intervalId !== null || isRunning;
  
  return {
    isRunning: actuallyRunning,
    lastSnapshotDate: lastSnapshotDate,
    scheduleTime: `${SNAPSHOT_HOUR.toString().padStart(2, '0')}:${SNAPSHOT_MINUTE.toString().padStart(2, '0')}`,
  };
}
