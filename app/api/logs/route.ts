import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { apiLogger as logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logType = searchParams.get('type');
    const lines = parseInt(searchParams.get('lines') || '100');
    
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Available log files
    const logFiles: Record<string, string> = {
      'price-updates': path.join(logsDir, 'price-updates.log'),
      'net-worth': path.join(logsDir, 'net-worth.log'),
      'service-output': path.join(logsDir, 'service-output.log'),
      'service-error': path.join(logsDir, 'service-error.log'),
    };
    
    // If no type specified, return list of available logs
    if (!logType) {
      const availableLogs = [];
      
      for (const [name, filePath] of Object.entries(logFiles)) {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          availableLogs.push({
            name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            exists: true
          });
        } else {
          availableLogs.push({
            name,
            size: 0,
            modified: null,
            exists: false
          });
        }
      }
      
      return NextResponse.json({ logs: availableLogs });
    }
    
    // Get specific log file
    const filePath = logFiles[logType];
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'Invalid log type' },
        { status: 400 }
      );
    }
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        content: '',
        exists: false,
        message: 'Log file not yet created'
      });
    }
    
    // Read the file
    const content = fs.readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim());
    
    // Get last N lines
    const lastLines = allLines.slice(-lines);
    
    return NextResponse.json({
      content: lastLines.join('\n'),
      totalLines: allLines.length,
      returnedLines: lastLines.length,
      exists: true,
      modified: fs.statSync(filePath).mtime.toISOString()
    });
    
  } catch (error) {
    logger.error('Error reading log file:', error);
    return NextResponse.json(
      { error: 'Failed to read log file' },
      { status: 500 }
    );
  }
}
