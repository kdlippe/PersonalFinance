'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Position } from '@/lib/types';

interface EditPositionModalProps {
  position: Position;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditPositionModal({ position, onClose, onSuccess }: EditPositionModalProps) {
  const [formData, setFormData] = useState({
    symbol: position.symbol,
    description: position.description || '',
    quantity: position.quantity.toString(),
    costBasis: position.costBasis.toString(),
    currentValue: position.currentValue.toString(),
    assetType: position.assetType,
    manualPriceUpdate: position.manualPriceUpdate || false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const currentPrice = parseFloat(formData.quantity) > 0 
        ? parseFloat(formData.currentValue) / parseFloat(formData.quantity) 
        : undefined;

      const response = await fetch(`/api/positions/${position.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: formData.symbol.toUpperCase(),
          description: formData.description || formData.symbol,
          quantity: parseFloat(formData.quantity),
          costBasis: parseFloat(formData.costBasis),
          currentValue: parseFloat(formData.currentValue),
          currentPrice: currentPrice,
          assetType: formData.assetType,
          manualPriceUpdate: formData.manualPriceUpdate,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert('Failed to update position: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating position:', error);
      alert('Failed to update position');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Position</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Symbol *</label>
              <input
                type="text"
                className="input"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                placeholder="e.g., AAPL"
                required
              />
            </div>

            <div>
              <label className="label">Description</label>
              <input
                type="text"
                className="input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Apple Inc."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity *</label>
              <input
                type="number"
                step="0.001"
                className="input"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Asset Type</label>
              <select
                className="input"
                value={formData.assetType}
                onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
              >
                <option value="stock">Stock</option>
                <option value="etf">ETF</option>
                <option value="mutual_fund">Mutual Fund</option>
                <option value="bond">Bond</option>
                <option value="crypto">Cryptocurrency</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Cost Basis *</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={formData.costBasis}
                onChange={(e) => setFormData({ ...formData, costBasis: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Original purchase price</p>
            </div>

            <div>
              <label className="label">Current Value *</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={formData.currentValue}
                onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Total market value</p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Current Price:</strong> {parseFloat(formData.quantity) > 0 
                ? `$${(parseFloat(formData.currentValue) / parseFloat(formData.quantity)).toFixed(2)}`
                : 'N/A'}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Automatically calculated from current value ÷ quantity
            </p>
          </div>

          {/* Manual Price Update Checkbox */}
          {['stock', 'etf', 'mutual_fund', 'crypto'].includes(formData.assetType) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="manualPriceUpdate"
                  checked={formData.manualPriceUpdate}
                  onChange={(e) => setFormData({ ...formData, manualPriceUpdate: e.target.checked })}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <label htmlFor="manualPriceUpdate" className="text-sm font-medium text-yellow-900 dark:text-yellow-200 cursor-pointer">
                    Manual Price Updates Only
                  </label>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    When checked, this position will be excluded from automatic price updates. You'll need to manually refresh prices or update values.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
