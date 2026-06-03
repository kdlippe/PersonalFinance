import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DEFAULT_SETTINGS, PlanningSettings } from '@/lib/planningService';

export const dynamic = 'force-dynamic';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const settingsPath = path.join(dataDir, 'planning-settings.json');

function loadSettings(): PlanningSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

export async function GET() {
  try {
    const settings = loadSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load planning settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const current = loadSettings();
    const settings: PlanningSettings = { ...current, ...body };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save planning settings' }, { status: 500 });
  }
}
