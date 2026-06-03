import { NextResponse } from 'next/server';
import { reloadDatabase } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = reloadDatabase();
    
    // Initialize netWorthSnapshots array if it doesn't exist (for existing databases)
    if (!db.netWorthSnapshots) {
      db.netWorthSnapshots = [];
    }
    
    return NextResponse.json(db.netWorthSnapshots);
  } catch (error) {
    logger.error('Error fetching snapshots:', error);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}
