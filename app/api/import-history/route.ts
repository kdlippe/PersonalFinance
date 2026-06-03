import { NextResponse } from 'next/server';
import { getImportHistory } from '@/lib/db';
import { apiLogger as logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const history = getImportHistory();
    return NextResponse.json(history);
  } catch (error) {
    logger.error('Error fetching import history:', error);
    return NextResponse.json({ error: 'Failed to fetch import history' }, { status: 500 });
  }
}
