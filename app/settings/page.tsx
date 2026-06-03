'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Clock, CheckCircle, AlertCircle, Activity, FileText, TrendingUp, PiggyBank, Upload, Mail, Send, Database, Settings, Briefcase, List, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Account } from '@/lib/types';
import CsvUpload from '@/components/CsvUpload';
import PositionsUpload from '@/components/PositionsUpload';
import { transactionParsers, positionParsers } from '@/lib/csvParsers';

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

interface LogInfo {
  name: string;
  size: number;
  modified: string | null;
  exists: boolean;
}

interface LogContent {
  content: string;
  totalLines: number;
  returnedLines: number;
  exists: boolean;
  modified?: string;
  message?: string;
}
interface ImportEvent {
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
type TabType = 'import' | 'price-updates' | 'net-worth' | 'parsers' | 'logs';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  
  // Price update state
  const [history, setHistory] = useState<PriceUpdateEvent[]>([]);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Logs state
  const [availableLogs, setAvailableLogs] = useState<LogInfo[]>([]);
  const [selectedLog, setSelectedLog] = useState<string>('price-updates');
  const [logContent, setLogContent] = useState<LogContent | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [maxLines, setMaxLines] = useState(100);

  // Import state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [importHistory, setImportHistory] = useState<ImportEvent[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [recipientEmail, setRecipientEmail] = useState('kathrynlippe@gmail.com');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Net Worth state
  const [netWorthHistory, setNetWorthHistory] = useState<any>(null);
  const [netWorthLoading, setNetWorthLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [updatingNetWorth, setUpdatingNetWorth] = useState(false);

  // Fetch price update data
  useEffect(() => {
    if (activeTab === 'price-updates') {
      fetchPriceHistory();
      const interval = setInterval(fetchPriceHistory, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Fetch logs data
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchAvailableLogs();
    } else if (activeTab === 'import') {
      fetchAccounts();
      fetchImportHistory();
    } else if (activeTab === 'net-worth') {
      fetchNetWorthHistory();
    } else if (activeTab === 'parsers') {
      fetchAccounts();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'logs' && selectedLog) {
      fetchLogContent();
    }
  }, [activeTab, selectedLog, maxLines]);

  useEffect(() => {
    if (!autoRefresh || activeTab !== 'logs') return;

    const interval = setInterval(() => {
      if (selectedLog) {
        fetchLogContent();
      }
      fetchAvailableLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, selectedLog, maxLines]);

  const fetchPriceHistory = async () => {
    try {
      const response = await fetch('/api/price-update-history');
      const data = await response.json();
      setHistory(data.history || []);
      setServiceStatus(data.serviceStatus || null);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setPriceLoading(false);
    }
  };

  const fetchAvailableLogs = async () => {
    try {
      const response = await fetch('/api/logs');
      const data = await response.json();
      setAvailableLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching available logs:', error);
    }
  };

  const fetchLogContent = async () => {
    try {
      const response = await fetch(`/api/logs?type=${selectedLog}&lines=${maxLines}`);
      const data = await response.json();
      setLogContent(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching log content:', error);
    } finally {
      setLogsLoading(false);
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
        fetchPriceHistory();
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

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setAccounts([]);
    }
  };

  const fetchImportHistory = async () => {
    try {
      const res = await fetch('/api/import-history');
      const data = await res.json();
      setImportHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching import history:', error);
      setImportHistory([]);
    }
  };

  const handleImportSuccess = (result: any) => {
    setLastResult(result);
    fetchAccounts();
    fetchImportHistory();
  };

  const handleSendInstructions = async () => {
    if (!recipientEmail) {
      alert('Please enter an email address first');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch('/api/send-csv-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          includeTransactions: true,
          includePositions: true
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Fidelity CSV instructions sent to ${recipientEmail}!`);
      } else {
        console.error('Server error:', result);
        alert(`Failed to send instructions: ${result.error || 'Unknown error'}${result.details ? '\n\nDetails: ' + JSON.stringify(result.details) : ''}`);
      }
    } catch (error) {
      console.error('Email sending error:', error);
      alert('Failed to send instructions. Please check the console for details.');
    } finally {
      setSendingEmail(false);
    }
  };

  const fetchNetWorthHistory = async () => {
    setNetWorthLoading(true);
    try {
      // Add cache-busting to ensure fresh data
      const response = await fetch(`/api/net-worth-history?_=${Date.now()}`);
      const data = await response.json();
      setNetWorthHistory(data);
    } catch (error) {
      console.error('Error fetching net worth history:', error);
    } finally {
      setNetWorthLoading(false);
    }
  };

  const handleManualNetWorthUpdate = async () => {
    setUpdatingNetWorth(true);
    try {
      const response = await fetch('/api/net-worth-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const timestamp = new Date(result.snapshot.createdAt).toLocaleString();
        alert(`✅ New snapshot created!\n\nDate: ${result.snapshot.date}\nTime: ${timestamp}\nNet Worth: $${result.snapshot.netWorth.toLocaleString()}`);
        await fetchNetWorthHistory();
      } else {
        alert('Failed to create snapshot: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating snapshot:', error);
      alert('Failed to create snapshot');
    } finally {
      setUpdatingNetWorth(false);
    }
  };

  const handleDeleteSnapshot = async (date: string, createdAt?: string) => {
    const timestamp = createdAt ? new Date(createdAt).toLocaleString() : '';
    const message = createdAt 
      ? `Are you sure you want to delete the snapshot from ${date} at ${timestamp}? This cannot be undone.`
      : `Are you sure you want to delete all snapshots for ${date}? This cannot be undone.`;
    
    if (!confirm(message)) {
      return;
    }

    try {
      const url = createdAt 
        ? `/api/net-worth-history?date=${date}&createdAt=${encodeURIComponent(createdAt)}`
        : `/api/net-worth-history?date=${date}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Snapshot deleted successfully`);
        fetchNetWorthHistory();
      } else {
        alert('Failed to delete snapshot: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting snapshot:', error);
      alert('Failed to delete snapshot');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getLogIcon = (logType: string) => {
    switch (logType) {
      case 'price-updates':
        return <TrendingUp size={18} className="text-blue-600 dark:text-blue-400" />;
      case 'net-worth':
        return <PiggyBank size={18} className="text-purple-600 dark:text-purple-400" />;
      case 'service-output':
        return <Activity size={18} className="text-green-600 dark:text-green-400" />;
      case 'service-error':
        return <AlertCircle size={18} className="text-red-600 dark:text-red-400" />;
      default:
        return <FileText size={18} className="text-gray-600 dark:text-gray-400" />;
    }
  };

  const getLogDisplayName = (logType: string) => {
    switch (logType) {
      case 'price-updates':
        return 'Price Updates';
      case 'net-worth':
        return 'Net Worth Tracker';
      case 'service-output':
        return 'Service Output';
      case 'service-error':
        return 'Service Errors';
      default:
        return logType;
    }
  };

  const totalUpdates = history.reduce((sum, h) => sum + h.updated, 0);
  const totalErrors = history.reduce((sum, h) => sum + h.errors, 0);
  const avgDuration = history.length > 0
    ? history.reduce((sum, h) => sum + h.duration, 0) / history.length
    : 0;

  const recentHistory = history.slice(0, 20);
  const lastUpdate = history.length > 0 ? history[0] : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4">
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </Link>
        
        <h1 className="text-3xl font-bold mb-2 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-300">Manage automatic updates and view system logs</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('import')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'import'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <Upload size={18} />
              Import Data
            </div>
          </button>
          <button
            onClick={() => setActiveTab('price-updates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'price-updates'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <RefreshCw size={18} />
              Automatic Price Updates
            </div>
          </button>
          <button
            onClick={() => setActiveTab('net-worth')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'net-worth'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={18} />
              Net Worth Tracking
            </div>
          </button>
          <button
            onClick={() => setActiveTab('parsers')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'parsers'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText size={18} />
              CSV Parsers
            </div>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText size={18} />
              Logs
            </div>
          </button>
        </nav>
      </div>

      {/* Price Updates Tab */}
      {activeTab === 'price-updates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold dark:text-gray-100">Automatic Price Updates</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Background service updating stock, ETF, mutual fund, and crypto prices</p>
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

          {priceLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-300 mt-4">Loading...</p>
            </div>
          ) : (
            <>
              {/* Service Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    {serviceStatus?.isRunning ? (
                      <Activity size={20} className="text-green-600 dark:text-green-400 animate-pulse" />
                    ) : (
                      <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400" />
                    )}
                    <h3 className="font-semibold dark:text-gray-100">Service Status</h3>
                  </div>
                  <p className={`text-2xl font-bold ${serviceStatus?.isRunning ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {serviceStatus?.isRunning ? 'Active' : 'Starting...'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {serviceStatus?.isRunning ? 'Monitoring schedule' : 'Background service initializing'}
                  </p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock size={20} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold dark:text-gray-100">Last Update</h3>
                  </div>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {lastUpdate ? new Date(lastUpdate.timestamp).toLocaleTimeString() : 'Never'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {lastUpdate
                      ? `${new Date(lastUpdate.timestamp).toLocaleDateString()} - ${lastUpdate.trigger === 'automatic' ? '🤖 Auto' : '👆 Manual'}`
                      : 'No updates yet'}
                  </p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold dark:text-gray-100">Total Updates</h3>
                  </div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {totalUpdates.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Across {history.length} runs</p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <RefreshCw size={20} className="text-purple-600 dark:text-purple-400" />
                    <h3 className="font-semibold dark:text-gray-100">Avg Duration</h3>
                  </div>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {avgDuration > 0 ? `${(avgDuration / 1000).toFixed(1)}s` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Per update run</p>
                </div>
              </div>

              {/* Update Schedule */}
              {serviceStatus?.schedule && (
                <div className="card">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
                    <Clock size={20} />
                    Update Schedule
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    Automatic price updates run at the following times daily:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {serviceStatus.schedule.map((time, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
                        {time.hour.toString().padStart(2, '0')}:{time.minute.toString().padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                  {serviceStatus?.isRunning ? (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-300">
                      <strong>✅ Service Active:</strong> Background service is monitoring for scheduled update times. Prices will update automatically. No action needed.
                    </div>
                  ) : (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
                      <strong>⏳ Service Starting:</strong> Background service is initializing. Updates will begin at the next scheduled time.
                    </div>
                  )}
                </div>
              )}

              {/* Recent Update History */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">Recent Update History</h2>
                
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
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                                  : event.trigger === 'manual'
                                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}>
                                {event.trigger === 'automatic' ? '🤖 Auto' : event.trigger === 'manual' ? '👆 Manual' : '⏰ Scheduled'}
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-300">
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
            </>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold dark:text-gray-100">System Logs</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">View and monitor application logs in real-time</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Clock size={16} />
                <span>Last refresh: {lastRefresh.toLocaleTimeString()}</span>
              </div>
              
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  autoRefresh 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} />
                  {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                </div>
              </button>
              
              <button
                onClick={fetchLogContent}
                className="btn btn-primary flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Refresh Now
              </button>
            </div>
          </div>

          {/* Log Type Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableLogs.map((log) => (
              <button
                key={log.name}
                onClick={() => setSelectedLog(log.name)}
                className={`card text-left transition-all ${
                  selectedLog === log.name 
                    ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getLogIcon(log.name)}
                    <h3 className="font-semibold dark:text-gray-100">{getLogDisplayName(log.name)}</h3>
                  </div>
                  {log.exists ? (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                      Empty
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <p>Size: {formatFileSize(log.size)}</p>
                  {log.modified && (
                    <p>Modified: {new Date(log.modified).toLocaleString()}</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Log Controls */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold dark:text-gray-100 flex items-center gap-2">
                {getLogIcon(selectedLog)}
                {getLogDisplayName(selectedLog)}
              </h2>
              
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Show last:</span>
                  <select
                    value={maxLines}
                    onChange={(e) => setMaxLines(parseInt(e.target.value))}
                    className="input py-1 px-2"
                  >
                    <option value={50}>50 lines</option>
                    <option value={100}>100 lines</option>
                    <option value={200}>200 lines</option>
                    <option value={500}>500 lines</option>
                    <option value={1000}>1000 lines</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Log Content */}
            {logsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-300 mt-4">Loading logs...</p>
              </div>
            ) : logContent ? (
              <div className="space-y-3">
                {logContent.exists ? (
                  <>
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded">
                      <span>Showing {logContent.returnedLines} of {logContent.totalLines} lines</span>
                      {logContent.modified && (
                        <span>Last modified: {new Date(logContent.modified).toLocaleString()}</span>
                      )}
                    </div>
                    
                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-[600px] overflow-y-auto">
                      {logContent.content ? (
                        <pre className="whitespace-pre-wrap">{logContent.content}</pre>
                      ) : (
                        <p className="text-gray-500">Log file is empty</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <FileText size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-300 font-medium">Log file not yet created</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {logContent.message || 'This log will be created when the relevant service runs'}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Log Descriptions */}
          <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">📚 Log File Guide</h3>
            <div className="space-y-3 text-sm">
              <div>
                <strong className="text-blue-800 dark:text-blue-400">Price Updates:</strong>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  Records all automatic and manual stock/ETF/mutual fund/crypto price updates. 
                  Shows timestamp, trigger type, number of positions updated, errors, and duration.
                </p>
              </div>
              <div>
                <strong className="text-green-800 dark:text-green-400">Service Output:</strong>
                <p className="text-green-700 dark:text-green-300 mt-1">
                  Standard output from the Finance app when running as a Windows service.
                  Includes startup messages, API requests, and general application logs.
                </p>
              </div>
              <div>
                <strong className="text-red-800 dark:text-red-400">Service Errors:</strong>
                <p className="text-red-700 dark:text-red-300 mt-1">
                  Error messages and stack traces from the Finance app service.
                  Check here if the app is not working correctly or has crashed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold dark:text-gray-100">Import Transactions & Positions</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Upload CSV files from your bank to automatically import data</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Import Options */}
            <div className="space-y-6">
              {/* Transaction Import */}
              <CsvUpload accounts={accounts} onSuccess={handleImportSuccess} />

              {/* Import Positions */}
              <PositionsUpload accounts={accounts} onSuccess={handleImportSuccess} />

              {/* Send CSV Instructions for Katie's Accounts */}
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Mail size={20} className="text-purple-600 dark:text-purple-400" />
                  <h3 className="text-lg font-semibold dark:text-gray-100">Send Fidelity CSV Instructions</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Email step-by-step Fidelity instructions for downloading transactions and positions from both accounts
                </p>
                
                {/* Email Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="kathrynlippe@gmail.com"
                    className="input w-full"
                  />
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSendInstructions}
                  disabled={sendingEmail || !recipientEmail}
                  className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sendingEmail ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Send Fidelity Instructions
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  📧 Includes instructions for Rollover IRA (Katie) and Athena Health 401k
                </p>
              </div>
            </div>

            {/* Right Column - Last Import Status */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
                <Clock size={20} />
                Last Import Status
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Account</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Last Import</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {accounts.map((account) => {
                      const accountImports = importHistory
                        .filter(h => h.accountId === account.id)
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                      const lastImport = accountImports[0];
                      
                      const daysSince = lastImport 
                        ? (() => {
                            const importDate = new Date(lastImport.timestamp);
                            const today = new Date();
                            const importDateOnly = new Date(importDate.getFullYear(), importDate.getMonth(), importDate.getDate());
                            const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                            return Math.floor((todayDateOnly.getTime() - importDateOnly.getTime()) / (1000 * 60 * 60 * 24));
                          })()
                        : null;

                      return (
                        <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-3 py-3">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{account.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{account.type}</div>
                          </td>
                          <td className="px-3 py-3">
                            {lastImport ? (
                              <div>
                                <div className="text-gray-900 dark:text-gray-100">
                                  {new Date(lastImport.timestamp).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </div>
                                <div className={`text-xs ${
                                  daysSince === 0 ? 'text-green-600 dark:text-green-400' :
                                  daysSince <= 7 ? 'text-blue-600 dark:text-blue-400' :
                                  daysSince <= 30 ? 'text-yellow-600 dark:text-yellow-400' :
                                  'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {daysSince === 0 ? 'Today' : 
                                   daysSince === 1 ? 'Yesterday' : 
                                   `${daysSince} days ago`}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 italic">Never imported</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {lastImport ? (
                              <div className="text-xs">
                                <div className="text-gray-700 dark:text-gray-300">
                                  <span className="text-green-600 dark:text-green-400 font-medium">{lastImport.imported} imported</span>
                                  {lastImport.skipped > 0 && (
                                    <span className="text-gray-500 dark:text-gray-400 ml-2">• {lastImport.skipped} skipped</span>
                                  )}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400 truncate">{lastImport.fileName}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detailed Row Results */}
          {lastResult && lastResult.rowResults && lastResult.rowResults.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">📊 Latest Import Details</h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Row</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {lastResult.rowResults.map((row: any, idx: number) => (
                        <tr key={idx} className={`
                          ${row.status === 'success' ? 'bg-green-50 dark:bg-green-900/20' : ''}
                          ${row.status === 'updated' ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                          ${row.status === 'skipped' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                          ${row.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' : ''}
                        `}>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.row}</td>
                          <td className="px-3 py-2">
                            {row.status === 'success' && <span className="text-green-700 dark:text-green-400 font-medium">✅ Success</span>}
                            {row.status === 'updated' && <span className="text-blue-700 dark:text-blue-400 font-medium">🔄 Updated</span>}
                            {row.status === 'skipped' && <span className="text-yellow-700 dark:text-yellow-400 font-medium">⏭️ Skipped</span>}
                            {row.status === 'error' && <span className="text-red-700 dark:text-red-400 font-medium">❌ Error</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            {row.data && lastResult.csvType === 'position' && (
                              <div className="text-xs">
                                <strong>{row.data.symbol}</strong>
                                {row.data.description && <span className="text-gray-500 dark:text-gray-400"> - {row.data.description}</span>}
                                {row.data.quantity !== undefined && (
                                  <span className="ml-2">Qty: {row.data.quantity.toLocaleString()}</span>
                                )}
                                {row.data.value !== undefined && (
                                  <span className="ml-2">Value: ${row.data.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                )}
                              </div>
                            )}
                            {row.data && lastResult.csvType === 'transaction' && (
                              <div className="text-xs">
                                {row.data.date && <span className="text-gray-500 dark:text-gray-400">{row.data.date}</span>}
                                {row.data.amount !== undefined && (
                                  <span className="ml-2 font-medium">${row.data.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                )}
                                {row.data.description && (
                                  <span className="ml-2">{row.data.description}</span>
                                )}
                              </div>
                            )}
                            {row.reason && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1">
                                {row.reason}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import Timeline */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
              <Clock size={20} />
              Import History
            </h3>
            
            {importHistory.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No imports yet. Upload a CSV file to get started.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {importHistory.map((event) => (
                  <div key={event.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            event.csvType === 'transaction' 
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          }`}>
                            {event.csvType === 'transaction' ? '📊 Transactions' : '💼 Positions'}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.accountName}</span>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          <strong>{event.fileName}</strong> • {event.format}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                          {event.csvType === 'position' ? (
                            <>
                              <span className="text-green-600 dark:text-green-400">✅ {event.imported} new</span>
                              {event.updated !== undefined && event.updated > 0 && (
                                <span className="text-blue-600 dark:text-blue-400">🔄 {event.updated} updated</span>
                              )}
                              {event.skipped > 0 && <span className="text-yellow-600 dark:text-yellow-400">⏭️ {event.skipped} skipped</span>}
                              {event.errors > 0 && <span className="text-red-600 dark:text-red-400">❌ {event.errors} errors</span>}
                            </>
                          ) : (
                            <>
                              <span className="text-green-600 dark:text-green-400">✅ {event.imported} imported</span>
                              {event.skipped > 0 && <span className="text-yellow-600 dark:text-yellow-400">⏭️ {event.skipped} duplicates</span>}
                              {event.errors > 0 && <span className="text-red-600 dark:text-red-400">❌ {event.errors} errors</span>}
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(event.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Net Worth Tab */}
      {activeTab === 'net-worth' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold dark:text-gray-100">Net Worth Tracking</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Daily snapshots are taken automatically at 6:00 AM. 
                You can also take manual snapshots anytime to track changes throughout the day.
              </p>
            </div>
            
            <button
              onClick={handleManualNetWorthUpdate}
              disabled={updatingNetWorth}
              className="btn btn-primary flex items-center gap-2"
            >
              <RefreshCw size={20} className={updatingNetWorth ? 'animate-spin' : ''} />
              {updatingNetWorth ? 'Taking Snapshot...' : 'Take Snapshot'}
            </button>
          </div>

          {netWorthLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading...</p>
            </div>
          ) : (
            <>
              {/* Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <Database size={20} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold dark:text-gray-100">Total Snapshots</h3>
                  </div>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{netWorthHistory?.totalSnapshots || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {netWorthHistory?.dateRange?.start && netWorthHistory?.dateRange?.end
                      ? `${netWorthHistory.dateRange.start} to ${netWorthHistory.dateRange.end}`
                      : 'No data yet'}
                  </p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold dark:text-gray-100">Latest Net Worth</h3>
                  </div>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {netWorthHistory?.snapshots && netWorthHistory.snapshots.length > 0
                      ? `$${netWorthHistory.snapshots[netWorthHistory.snapshots.length - 1].netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {netWorthHistory?.snapshots && netWorthHistory.snapshots.length > 0
                      ? `As of ${netWorthHistory.snapshots[netWorthHistory.snapshots.length - 1].date}`
                      : 'No snapshots yet'}
                  </p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock size={20} className="text-purple-600 dark:text-purple-400" />
                    <h3 className="font-semibold dark:text-gray-100">Auto-Update Schedule</h3>
                  </div>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">6:00 AM</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Daily (automatic)</p>
                </div>
              </div>

              {/* Snapshot History Table */}
              {netWorthHistory?.snapshots && netWorthHistory.snapshots.length > 0 && (
                <div className="card">
                  <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">Snapshot History</h2>
                  
                  {/* Pagination Info */}
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-600 dark:text-gray-300">
                    <span>
                      Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, netWorthHistory.totalSnapshots)} of {netWorthHistory.totalSnapshots} snapshots
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                          <th className="px-3 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Net Worth</th>
                          <th className="px-3 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Total Assets</th>
                          <th className="px-3 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Retirement</th>
                          <th className="px-3 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Liabilities</th>
                          <th className="px-3 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Source</th>
                          <th className="px-3 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {netWorthHistory.snapshots
                          .slice()
                          .reverse()
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((snapshot: any, idx: number) => (
                            <tr key={`${snapshot.date}-${snapshot.createdAt || idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-3 py-3 text-gray-900 dark:text-gray-100 font-medium">
                                <div>
                                  {/* Parse date manually to avoid timezone shift */}
                                  {(() => {
                                    const [year, month, day] = snapshot.date.split('-').map(Number);
                                    return new Date(year, month - 1, day).toLocaleDateString('en-US', { 
                                      year: 'numeric',
                                      month: 'short', 
                                      day: 'numeric'
                                    });
                                  })()}
                                </div>
                                {snapshot.source === 'manual' && snapshot.createdAt && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(snapshot.createdAt).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100 font-semibold">
                                ${snapshot.netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                                ${(snapshot.totalAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                                ${(snapshot.retirementAssets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-3 text-right text-red-600 dark:text-red-400">
                                ${(snapshot.totalLiabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`px-2 py-1 text-xs rounded ${
                                  snapshot.source === 'automatic' 
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                                    : snapshot.source === 'manual'
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}>
                                  {snapshot.source}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => handleDeleteSnapshot(snapshot.date, snapshot.createdAt)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                                  title="Delete snapshot"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {netWorthHistory.totalSnapshots > itemsPerPage && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      
                      {Array.from({ length: Math.ceil(netWorthHistory.totalSnapshots / itemsPerPage) }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first, last, current, and pages around current
                          return page === 1 || 
                                 page === Math.ceil(netWorthHistory.totalSnapshots / itemsPerPage) ||
                                 Math.abs(page - currentPage) <= 2;
                        })
                        .map((page, idx, arr) => (
                          <span key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-2 rounded ${
                                currentPage === page
                                  ? 'bg-blue-600 text-white'
                                  : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              {page}
                            </button>
                          </span>
                        ))}
                      
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(netWorthHistory.totalSnapshots / itemsPerPage), p + 1))}
                        disabled={currentPage === Math.ceil(netWorthHistory.totalSnapshots / itemsPerPage)}
                        className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* How It Works */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 dark:text-gray-100">
                  <Settings size={20} />
                  How It Works
                </h2>
                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold">1</div>
                    <div>
                      <h4 className="font-semibold mb-1">Automatic Background Service</h4>
                      <p>When the Finance app starts, a background service automatically begins monitoring for the daily snapshot time (6:00 AM). No external setup required!</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center font-bold">2</div>
                    <div>
                      <h4 className="font-semibold mb-1">Daily Calculation</h4>
                      <p>At 6:00 AM daily, the system calculates your total net worth by aggregating all account balances:</p>
                      <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                        <li>Total Assets (checking, savings, brokerage, investment)</li>
                        <li>Retirement Assets (retirement accounts)</li>
                        <li>Total Liabilities (credit cards, loans)</li>
                        <li><strong>Net Worth = Assets + Retirement - Liabilities</strong></li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center font-bold">3</div>
                    <div>
                      <h4 className="font-semibold mb-1">Snapshot Storage</h4>
                      <p>Each snapshot is saved to <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">data/net-worth-history.json</code> with:</p>
                      <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                        <li>Date and calculated net worth</li>
                        <li>Breakdown by account balances</li>
                        <li>Assets, liabilities, and retirement totals</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center font-bold">4</div>
                    <div>
                      <h4 className="font-semibold mb-1">Historical Tracking</h4>
                      <p>View trends over time in the dashboard chart with period filters (7d, 30d, 90d, 1y, all time).</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CSV Parsers Tab */}
      {activeTab === 'parsers' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold dark:text-gray-100">CSV Parsers Reference</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Each account is configured with a dedicated CSV parser that matches your institution's format</p>
          </div>

          {/* Transaction Parsers */}
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold dark:text-gray-100">Transaction Parsers</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">Import individual transactions (deposits, withdrawals, trades)</p>
              </div>
            </div>

            <div className="space-y-4">
              {transactionParsers.map((parser) => {
                const accountsUsingParser = accounts.filter(acc => acc.defaultParser === parser.name);
                
                return (
                  <div key={parser.name} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">{parser.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">ID: {parser.id}</p>
                      </div>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                        Transaction
                      </span>
                    </div>
                    
                    {/* Accounts using this parser */}
                    {accountsUsingParser.length > 0 ? (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                          <List size={14} className="text-gray-500 dark:text-gray-400" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            Used by {accountsUsingParser.length} account{accountsUsingParser.length !== 1 ? 's' : ''}:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {accountsUsingParser.map(acc => (
                            <span key={acc.id} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded flex items-center gap-1">
                              <Check size={12} className="text-green-600 dark:text-green-400" />
                              {acc.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">No accounts currently using this parser</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Position Parsers */}
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Briefcase className="text-green-600 dark:text-green-400" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold dark:text-gray-100">Position Parsers</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">Import current holdings (stocks, bonds, mutual funds)</p>
              </div>
            </div>

            <div className="space-y-4">
              {positionParsers.map((parser) => {
                const accountsUsingParser = accounts.filter(acc => acc.defaultPositionParser === parser.name);
                
                return (
                  <div key={parser.name} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">{parser.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">ID: {parser.id}</p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                        Position
                      </span>
                    </div>
                    
                    {/* Accounts using this parser */}
                    {accountsUsingParser.length > 0 ? (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                          <List size={14} className="text-gray-500 dark:text-gray-400" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            Used by {accountsUsingParser.length} account{accountsUsingParser.length !== 1 ? 's' : ''}:
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {accountsUsingParser.map(acc => (
                            <span key={acc.id} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded flex items-center gap-1">
                              <Check size={12} className="text-green-600 dark:text-green-400" />
                              {acc.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">No accounts currently using this parser</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
