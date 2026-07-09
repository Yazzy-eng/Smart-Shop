import { useState, useEffect } from 'react';
import api from '../api/client';

export default function AdminSettings() {
  const [currentRate, setCurrentRate] = useState(null);
  const [newRate, setNewRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadRate();
  }, []);

  function loadRate() {
    api.get('/exchange-rates/current')
      .then(({ data }) => setCurrentRate(data.rate))
      .catch(() => setCurrentRate(null));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    const rateValue = Number(newRate);
    if (!rateValue || rateValue <= 0) {
      setError('Enter a valid positive number, e.g. 8700');
      return;
    }
    setSaving(true);
    try {
      await api.post('/exchange-rates', { rate: rateValue, baseCurrency: 'USD', targetCurrency: 'SOS' });
      setMessage('Exchange rate updated successfully.');
      setNewRate('');
      loadRate();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update the exchange rate.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Settings</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Exchange Rate (USD to SOS)</h2>
        <p className="text-sm text-slate-500">
          This rate is used everywhere in the app to convert between US Dollars and Somali Shillings,
          including at checkout in Sales / POS.
        </p>

        <div className="text-sm">
          Current rate:{' '}
          {currentRate ? (
            <span className="font-medium text-slate-800">1 USD = {Number(currentRate.rate).toLocaleString()} SOS</span>
          ) : (
            <span className="text-amber-600">Not set yet</span>
          )}
        </div>

        <form onSubmit={handleSave} className="flex gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="e.g. 8700"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Update Rate'}
          </button>
        </form>

        {message && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{message}</div>}
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      </div>
    </div>
  );
}
