'use client';

import { useState } from 'react';
import { RefreshCw, Settings, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface NetWorthUpdateProps {
  onUpdate?: () => void;
}

export default function NetWorthUpdate({ onUpdate }: NetWorthUpdateProps) {
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<any>(null);

  const handleUpdate = async (force: boolean = true) => {
    setUpdating(true);
    try {
      const response = await fetch('/api/net-worth-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });

      const data = await response.json();
      setLastUpdate(data);
      
      if (data.success) {
        alert(`✅ Net Worth Updated!\n\n$${data.snapshot.netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nSnapshot saved for ${data.snapshot.date}`);
        if (onUpdate) {
          onUpdate();
        }
      } else if (data.existing) {
        const update = confirm(
          `A snapshot already exists for today:\n\nCurrent: $${data.existing.netWorth.toLocaleString()}\nNew calculation: $${data.current.netWorth.toLocaleString()}\n\nUpdate today's snapshot?`
        );
        if (update) {
          handleUpdate(true);
        }
      }
    } catch (error) {
      console.error('Error updating net worth:', error);
      alert('Failed to update net worth snapshot');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp size={20} className="text-green-600" />
              Net Worth Tracker
            </h3>
            <Link 
              href="/net-worth-settings" 
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Configure automatic updates"
            >
              <Settings size={16} />
            </Link>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Daily snapshots at 6:00 AM • Auto-calculated from all accounts
          </p>
          {lastUpdate && lastUpdate.success && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Latest: ${lastUpdate.snapshot.netWorth.toLocaleString()} on {lastUpdate.snapshot.date}
            </p>
          )}
        </div>
        <button
          onClick={() => handleUpdate(false)}
          disabled={updating}
          className="btn btn-primary flex items-center gap-2"
        >
          <RefreshCw size={18} className={updating ? 'animate-spin' : ''} />
          {updating ? 'Updating...' : 'Update Now'}
        </button>
      </div>
    </div>
  );
}
