import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { reloadDatabase, getLocalTimestamp } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const netWorthPath = path.join(dataDir, 'net-worth-history.json');

interface NetWorthSnapshot {
  date: string;
  netWorth: number;
  accountBalances?: Record<string, number>;
  totalAssets?: number;
  totalLiabilities?: number;
  retirementAssets?: number;
  source: string;
  importedAt?: string;
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
    logger.error('Error loading net worth history:', error);
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
    fs.writeFileSync(netWorthPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    logger.error('Error saving net worth history:', error);
    throw new Error('Failed to save net worth history: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// GET - Retrieve net worth history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '365');
    
    const history = loadNetWorthHistory();

    // Build id → name lookup from current accounts
    const db = reloadDatabase();
    const idToName: Record<string, string> = {};
    db.accounts.forEach(a => { idToName[String(a.id)] = a.name; });

    // Enrich accountBalances: replace numeric ID keys with current account names
    const enrichSnapshot = (snapshot: NetWorthSnapshot): NetWorthSnapshot => {
      if (!snapshot.accountBalances) return snapshot;
      const enriched: Record<string, number> = {};
      Object.entries(snapshot.accountBalances).forEach(([key, balance]) => {
        enriched[idToName[key] ?? key] = balance;
      });
      return { ...snapshot, accountBalances: enriched };
    };

    // Filter to last N days if requested
    if (days > 0 && history.snapshots.length > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = getLocalDateString(cutoffDate);
      
      const filtered = history.snapshots
        .filter(s => s.date >= cutoffStr)
        .map(enrichSnapshot);
      
      return NextResponse.json({
        ...history,
        totalSnapshots: filtered.length,
        snapshots: filtered,
      });
    }
    
    return NextResponse.json({
      ...history,
      snapshots: history.snapshots.map(enrichSnapshot),
    });
  } catch (error) {
    logger.error('Error fetching net worth history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch net worth history' },
      { status: 500 }
    );
  }
}

// POST - Add/update today's snapshot
export async function POST(request: NextRequest) {
  try {
    const { force } = await request.json();
    
    const db = reloadDatabase();
    const now = new Date();
    const today = getLocalDateString(now);
    const timestamp = getLocalTimestamp();
    
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
    
    // If force=true (manual snapshot), always create a new entry with timestamp
    // If force=false (automatic/scheduled), check if today's snapshot exists
    if (force) {
      // Manual snapshot - always create new entry
      const snapshot: NetWorthSnapshot = {
        date: today,
        netWorth,
        totalAssets,
        totalLiabilities,
        retirementAssets,
        accountBalances,
        source: 'manual',
        createdAt: timestamp,
      };
      
      history.snapshots.push(snapshot);
      history.snapshots.sort((a, b) => {
        // Sort by date first, then by createdAt for same-day entries
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.createdAt || a.date).localeCompare(b.createdAt || b.date);
      });
      
      // Update metadata
      history.lastUpdated = timestamp;
      history.totalSnapshots = history.snapshots.length;
      history.dateRange = {
        start: history.snapshots[0]?.date || null,
        end: history.snapshots[history.snapshots.length - 1]?.date || null,
      };
      
      saveNetWorthHistory(history);
      
      return NextResponse.json({
        success: true,
        snapshot,
        message: 'Created new snapshot',
      });
    }
    
    // Automatic snapshot - check for existing today's snapshot and update/create
    const existingIndex = history.snapshots.findIndex(s => s.date === today && s.source !== 'manual');
    
    const snapshot: NetWorthSnapshot = {
      date: today,
      netWorth,
      totalAssets,
      totalLiabilities,
      retirementAssets,
      accountBalances,
      source: 'automatic',
      createdAt: timestamp,
    };
    
    if (existingIndex >= 0) {
      // Update existing automatic snapshot
      history.snapshots[existingIndex] = snapshot;
    } else {
      // Add new automatic snapshot
      history.snapshots.push(snapshot);
      history.snapshots.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.createdAt || a.date).localeCompare(b.createdAt || b.date);
      });
    }
    
    // Update metadata
    history.lastUpdated = timestamp;
    history.totalSnapshots = history.snapshots.length;
    history.dateRange = {
      start: history.snapshots[0]?.date || null,
      end: history.snapshots[history.snapshots.length - 1]?.date || null,
    };
    
    saveNetWorthHistory(history);
    
    return NextResponse.json({
      success: true,
      snapshot,
      message: existingIndex >= 0 ? 'Updated today\'s automatic snapshot' : 'Created new automatic snapshot',
    });
  } catch (error) {
    logger.error('Error updating net worth snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to update snapshot' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a snapshot by date and optionally timestamp
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const createdAt = searchParams.get('createdAt');
    
    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }
    
    const history = loadNetWorthHistory();
    const initialCount = history.snapshots.length;
    
    // If createdAt is provided, delete specific snapshot; otherwise delete all for that date
    if (createdAt) {
      history.snapshots = history.snapshots.filter(s => 
        !(s.date === date && s.createdAt === createdAt)
      );
    } else {
      // Remove all snapshots with matching date
      history.snapshots = history.snapshots.filter(s => s.date !== date);
    }
    
    if (history.snapshots.length === initialCount) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }
    
    // Update metadata
    history.lastUpdated = getLocalTimestamp();
    history.totalSnapshots = history.snapshots.length;
    history.dateRange = {
      start: history.snapshots[0]?.date || null,
      end: history.snapshots[history.snapshots.length - 1]?.date || null,
    };
    
    saveNetWorthHistory(history);
    
    return NextResponse.json({
      success: true,
      message: `Deleted snapshot for ${date}`,
      remainingSnapshots: history.totalSnapshots,
    });
  } catch (error) {
    logger.error('Error deleting net worth snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to delete snapshot' },
      { status: 500 }
    );
  }
}
