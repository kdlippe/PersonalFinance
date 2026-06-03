'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Upload, CheckCircle, AlertCircle, FileText, HelpCircle, X } from 'lucide-react';
import { Account } from '@/lib/types';

interface CsvUploadProps {
  accounts: Account[];
  onSuccess: (result: ImportResult) => void;
}

interface ImportResult {
  imported: number;
  updated?: number;
  skipped: number;
  errors: number;
  message: string;
  format?: string;
  csvType?: 'transaction' | 'position';
  rowResults?: Array<{
    row: number;
    status: 'success' | 'updated' | 'skipped' | 'error';
    data?: {
      symbol?: string;
      description?: string;
      quantity?: number;
      value?: number;
      amount?: number;
      date?: string;
    };
    reason?: string;
  }>;
}

export default function CsvUpload({ accounts, onSuccess }: CsvUploadProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [formatMismatch, setFormatMismatch] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedAccount) {
      setError('Please select both a file and an account');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('accountId', selectedAccount);
      
      // Use account's default parser if available
      const account = accounts.find(a => a.id === parseInt(selectedAccount));
      if (account?.defaultParser) {
        formData.append('parser', account.defaultParser);
      }

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        setFile(null);
        setSelectedAccount('');
        // Reset file input
        const fileInput = document.getElementById('csv-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        // Call success callback with result data
        onSuccess(data);
      } else {
        if (data.formatMismatch && data.validation) {
          setFormatMismatch(data.validation);
        } else {
          setError(data.error || 'Failed to upload CSV');
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload CSV. Please check your connection.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <FileText className="text-blue-600 dark:text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold dark:text-gray-100">Import Transactions from CSV</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Upload transaction history from your bank or credit card</p>
          </div>
        </div>
        <button
          onClick={() => setShowHelpModal(true)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="How to import"
        >
          <HelpCircle className="text-gray-600 dark:text-gray-400" size={20} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Select Account *</label>
          <select
            className="input"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            disabled={uploading}
          >
            <option value="">Choose an account...</option>
            {(() => {
              // Group accounts by type
              const accountsByType = accounts.reduce((acc, account) => {
                if (!acc[account.type]) {
                  acc[account.type] = [];
                }
                acc[account.type].push(account);
                return acc;
              }, {} as Record<string, Account[]>);

              // Define type labels
              const typeLabels: Record<string, string> = {
                checking: 'Checking',
                savings: 'Savings',
                credit_card: 'Credit Cards',
                brokerage: 'Brokerage',
                retirement: 'Retirement',
                loan: 'Loans',
                other: 'Other'
              };

              // Sort types in preferred order
              const typeOrder = ['checking', 'savings', 'credit_card', 'brokerage', 'retirement', 'loan', 'other'];
              const sortedTypes = Object.keys(accountsByType).sort((a, b) => {
                const aIndex = typeOrder.indexOf(a);
                const bIndex = typeOrder.indexOf(b);
                if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
              });

              return sortedTypes.map(type => (
                <optgroup key={type} label={typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)}>
                  {accountsByType[type].map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {account.institution || 'No institution'}
                    </option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
          {accounts.length === 0 && (
            <p className="text-sm text-amber-600 mt-2">
              ⚠️ No accounts found. Please create an account first.
            </p>
          )}
        </div>

        {selectedAccount && (() => {
          const account = accounts.find(a => a.id === parseInt(selectedAccount));
          return account?.defaultParser ? (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                    CSV Parser: <span className="font-mono">{account.defaultParser}</span>
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Each account is configured with a specific CSV parser that matches your institution's format.
                  </p>
                </div>
                <Link href="/settings/parsers" className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
                  View all →
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
              <p className="text-sm text-amber-900 dark:text-amber-300">
                <strong>⚠️ No parser assigned to this account</strong>
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                This account needs a CSV parser configured. <Link href="/settings/parsers" className="underline">Assign one in Settings</Link>
              </p>
            </div>
          );
        })()}

        <div>
          <label className="label">CSV File *</label>
          <div className="mt-1">
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
            />
          </div>
          {file && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="flex items-start gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
            <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{result.message}</p>
              {result.format && (
                <p className="text-sm mt-1">
                  📋 Detected format: <strong>{result.format}</strong>
                  {result.csvType && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                      result.csvType === 'transaction' 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' 
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}>
                      {result.csvType === 'transaction' ? '📊 Transaction Activity' : '💼 Account Positions'}
                    </span>
                  )}
                </p>
              )}
              <div className="text-sm mt-2 space-y-1">
                {result.csvType === 'position' ? (
                  <>
                    <p>✅ Imported: {result.imported} new positions</p>
                    {result.updated !== undefined && result.updated > 0 && (
                      <p>🔄 Updated: {result.updated} existing positions</p>
                    )}
                    <p>⏭️ Skipped: {result.skipped}</p>
                    {result.errors > 0 && <p>⚠️ Errors: {result.errors} rows</p>}
                  </>
                ) : (
                  <>
                    <p>✅ Imported: {result.imported} transactions</p>
                    <p>⏭️ Skipped: {result.skipped} duplicates</p>
                    {result.errors > 0 && <p>⚠️ Errors: {result.errors} rows</p>}
                  </>
                )}
              </div>
              <p className="text-xs mt-2 text-green-600 dark:text-green-400">
                📊 Detailed results shown below
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || !selectedAccount || uploading || accounts.length === 0}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload size={20} />
              <span>Import Transactions</span>
            </>
          )}
        </button>
      </div>
    </div>

    {/* Help Modal */}
    {showHelpModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold dark:text-gray-100 flex items-center gap-2">
                <FileText size={24} />
                How to Import Transactions
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Step 1: Export from Your Bank</h4>
              <p>Download a CSV export of your transactions from your bank's website. Most banks offer this under "Export" or "Download" options.</p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Step 2: Select Account</h4>
              <p>Choose which account in your finance app should receive these transactions.</p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Step 3: Choose CSV Format</h4>
              <p>Select "Auto-detect" to let the system figure it out, or manually choose your bank's format (JDCU Checking, Fidelity Brokerage Activity, etc.) for guaranteed accuracy.</p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Step 4: Upload CSV</h4>
              <p>Click "Choose File" and select your downloaded CSV file.</p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Step 5: Import</h4>
              <p>Click "Import Transactions" and the system will automatically categorize and add them to your account.</p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium mb-3 text-gray-900 dark:text-gray-100">💡 Tips</h4>
              <ul className="space-y-2">
                <li>• <strong>Duplicate Detection:</strong> The system automatically skips transactions that already exist</li>
                <li>• <strong>Auto-Categorization:</strong> Transactions are automatically categorized based on your rules and merchant names</li>
                <li>• <strong>Parser Selection:</strong> Auto-detect works well, but manually selecting your bank ensures 100% accuracy</li>
                <li>• <strong>Review After Import:</strong> Check the transactions page to verify imported data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Format Mismatch Modal */}
    {formatMismatch && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle size={24} />
                CSV Format Mismatch
              </h3>
              <button
                onClick={() => setFormatMismatch(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6 text-sm">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-900 dark:text-red-300 font-medium">
                The CSV file you uploaded does not match the expected format for the <strong>{formatMismatch.parserName}</strong> parser.
              </p>
            </div>

            {/* Missing Headers */}
            {formatMismatch.missingHeaders && formatMismatch.missingHeaders.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle size={18} />
                  Missing Required Columns ({formatMismatch.missingHeaders.length})
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                  <div className="flex flex-wrap gap-2">
                    {formatMismatch.missingHeaders.map((header: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded font-mono text-xs">
                        {header}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CSV Headers Found */}
            <div>
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Columns Found in Your CSV ({formatMismatch.csvHeaders.length})</h4>
              <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                <div className="flex flex-wrap gap-2">
                  {formatMismatch.csvHeaders.map((header: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded font-mono text-xs">
                      {header}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Required Headers */}
            <div>
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Required Columns for {formatMismatch.parserName}</h4>
              <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                <div className="flex flex-wrap gap-2">
                  {formatMismatch.requiredHeaders.map((header: string, idx: number) => {
                    const isMissing = formatMismatch.missingHeaders.includes(header);
                    return (
                      <span 
                        key={idx} 
                        className={`px-3 py-1 rounded font-mono text-xs ${
                          isMissing 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}
                      >
                        {isMissing && '❌ '}{!isMissing && '✅ '}{header}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Suggestions */}
            {formatMismatch.suggestions && formatMismatch.suggestions.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">💡 Suggested Parsers</h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                  Based on the columns in your CSV, these parsers might work better:
                </p>
                <div className="flex flex-wrap gap-2">
                  {formatMismatch.suggestions.map((suggestion: string, idx: number) => (
                    <span key={idx} className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg font-medium text-sm">
                      {suggestion}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Help Text */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">What to do:</h4>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">1.</span>
                  <span>Check if you downloaded the correct CSV format from your bank/institution</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">2.</span>
                  <span>Verify that the account you selected matches the CSV file's source</span>
                </li>
                {formatMismatch.suggestions && formatMismatch.suggestions.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">3.</span>
                    <span>Try importing to an account with one of the suggested parsers above</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">{formatMismatch.suggestions && formatMismatch.suggestions.length > 0 ? '4' : '3'}.</span>
                  <span>Visit <Link href="/settings/parsers" className="text-blue-600 dark:text-blue-400 hover:underline">Settings → Parsers</Link> to see the expected format for each parser</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end gap-3">
            <button
              onClick={() => setFormatMismatch(null)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
