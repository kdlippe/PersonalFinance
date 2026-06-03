'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Clock, CheckCircle, AlertCircle, Activity } from 'lucide-react';

interface PriceUpdateEvent {
  id: number;
  timestamp: string;
  trigger: 'manual' | 'automatic' | 'scheduled';
  updated: number;
  errors: number;
  duration: number;
  errorDetails?: Array<{
    symbol: string;
    error: string;
  }>;
}

interface ServiceStatus {
  isRunning: boolean;
  lastUpdateTime: string | null;
  schedule: Array<{ hour: number; minute: number }>;
}

export default function PriceUpdateSettingsPage() {
  const [history, setHistory] = useState<PriceUpdateEvent[]>([]);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHistory();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/price-update-history');
      const data = await response.json();
      setHistory(data.history || []);
      setServiceStatus(data.serviceStatus || null);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/positions/refresh-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`Successfully updated ${result.updated} positions (${result.errors} errors)`);
        fetchHistory();
      } else {
        alert('Failed to update positions: ' + result.error);
      }
    } catch (error) {
      console.error('Error refreshing prices:', error);
      alert('Failed to refresh prices');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400 mt-4">Loading...</p>
      </div>
    );
  }

  const totalUpdates = history.reduce((sum, h) => sum + h.updated, 0);
  const totalErrors = history.reduce((sum, h) => sum + h.errors, 0);
  const avgDuration = history.length > 0
    ? history.reduce((sum, h) => sum + h.duration, 0) / history.length
    : 0;

  const recentHistory = history.slice(0, 20);
  
  // Get the most recent update from history (manual or automatic)
  const lastUpdate = history.length > 0 ? history[0] : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Automatic Price Updates</h1>
            <p className="text-gray-600 dark:text-gray-400">Background service updating stock, ETF, mutual fund, and crypto prices</p>
          </div>
          
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="btn btn-primary flex items-center gap-2"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Updating...' : 'Update Now'}
          </button>
        </div>
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            {serviceStatus?.isRunning ? (
              <Activity size={20} className="text-green-600 dark:text-green-400 animate-pulse" />
            ) : (
              <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400" />
            )}
            <h3 className="font-semibold">Service Status</h3>
          </div>
          <p className={`text-2xl font-bold ${serviceStatus?.isRunning ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
            {serviceStatus?.isRunning ? 'Running' : 'Unknown'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {serviceStatus?.isRunning 
              ? 'Background service active' 
              : 'Check server logs to verify (may show incorrect in dev mode)'}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Clock size={20} className="text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold">Last Update</h3>
          </div>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {lastUpdate
              ? new Date(lastUpdate.timestamp).toLocaleTimeString()
              : 'Never'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {lastUpdate
              ? `${new Date(lastUpdate.timestamp).toLocaleDateString()} - ${lastUpdate.trigger === 'automatic' ? '🤖 Auto' : '👆 Manual'}`
              : 'No updates yet'}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
            <h3 className="font-semibold">Total Updates</h3>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {totalUpdates.toLocaleString()}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Across {history.length} runs
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <RefreshCw size={20} className="text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold">Avg Duration</h3>
          </div>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {avgDuration > 0 ? `${(avgDuration / 1000).toFixed(1)}s` : 'N/A'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Per update run
          </p>
        </div>
      </div>

      {/* Update Schedule */}
      {serviceStatus?.schedule && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock size={20} />
            Update Schedule
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Automatic price updates run every 30 minutes during market hours (9:30 AM - 4:00 PM), plus at 6:00 AM:
          </p>
          <div className="flex flex-wrap gap-2">
            {serviceStatus.schedule.map((time, idx) => (
              <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                {time.hour.toString().padStart(2, '0')}:{time.minute.toString().padStart(2, '0')}
              </span>
            ))}
          </div>
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200">
            <strong>✅ Service Running:</strong> Prices will update automatically at scheduled times. No action needed.
          </div>
        </div>
      )}

      {/* Recent Update History */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Recent Update History</h2>
        
        {recentHistory.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No updates yet. Click "Update Now" to run your first update.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentHistory.map((event) => (
              <div key={event.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        event.trigger === 'automatic' 
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                          : event.trigger === 'manual'
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {event.trigger === 'automatic' ? '🤖 Auto' : event.trigger === 'manual' ? '👆 Manual' : '⏰ Scheduled'}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600 dark:text-green-400">✅ {event.updated} updated</span>
                      {event.errors > 0 && <span className="text-red-600 dark:text-red-400">❌ {event.errors} errors</span>}
                      <span className="text-gray-500 dark:text-gray-400">⏱️ {(event.duration / 1000).toFixed(1)}s</span>
                    </div>
                    
                    {event.errorDetails && event.errorDetails.length > 0 && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                        <strong>Failed symbols:</strong> {event.errorDetails.map(e => e.symbol).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs Location */}
      <div className="card bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-2">📄 Log Files</h3>
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <p><strong>Detailed log:</strong> <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded">c:\Backups\Finance\logs\price-updates.log</code></p>
          <p><strong>Database history:</strong> <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded">c:\Backups\Finance\data\price-update-history.json</code></p>
        </div>
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          View logs in PowerShell: <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded ml-1">Get-Content c:\Backups\Finance\logs\price-updates.log -Tail 50</code>
        </div>
      </div>
    </div>
  );
}
