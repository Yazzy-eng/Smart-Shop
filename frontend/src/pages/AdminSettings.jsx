import { useState, useEffect } from 'react';
import api from '../api/client';

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function AdminSettings() {
  const [currentRate, setCurrentRate] = useState(null);
  const [newRate, setNewRate] = useState('');
  const [rateSaving, setRateSaving] = useState(false);
  const [rateMessage, setRateMessage] = useState('');
  const [rateError, setRateError] = useState('');

  const [shopInfo, setShopInfo] = useState({ shop_name: '', shop_address: '', shop_phone: '' });
  const [shopSaving, setShopSaving] = useState(false);
  const [shopMessage, setShopMessage] = useState('');

  const [expenseForm, setExpenseForm] = useState({ category: '', description: '', amountUsd: '', expenseDate: '' });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseMessage, setExpenseMessage] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [recentExpenses, setRecentExpenses] = useState([]);

  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    loadRate();
    loadShopInfo();
    loadExpenses();
    loadAuditLogs();
  }, []);

  function loadRate() {
    api.get('/exchange-rates/current').then(({ data }) => setCurrentRate(data.rate)).catch(() => setCurrentRate(null));
  }

  function loadShopInfo() {
    api.get('/admin/shop-settings').then(({ data }) => {
      setShopInfo({
        shop_name: data.settings.shop_name || '',
        shop_address: data.settings.shop_address || '',
        shop_phone: data.settings.shop_phone || '',
      });
    }).catch(() => {});
  }

  function loadExpenses() {
    api.get('/expenses').then(({ data }) => setRecentExpenses(data.expenses.slice(0, 10))).catch(() => {});
  }

  function loadAuditLogs() {
    api.get('/admin/audit-logs', { params: { limit: 30 } }).then(({ data }) => setAuditLogs(data.logs)).catch(() => {});
  }

  async function handleSaveRate(e) {
    e.preventDefault();
    setRateError(''); setRateMessage('');
    const rateValue = Number(newRate);
    if (!rateValue || rateValue <= 0) {
      setRateError('Enter a valid positive number, e.g. 8700');
      return;
    }
    setRateSaving(true);
    try {
      await api.post('/exchange-rates', { rate: rateValue, baseCurrency: 'USD', targetCurrency: 'SOS' });
      setRateMessage('Exchange rate updated successfully.');
      setNewRate('');
      loadRate();
    } catch (err) {
      setRateError(err.response?.data?.error || 'Could not update the exchange rate.');
    } finally {
      setRateSaving(false);
    }
  }

  async function handleSaveShopInfo(e) {
    e.preventDefault();
    setShopMessage('');
    setShopSaving(true);
    try {
      await api.put('/admin/shop-settings', shopInfo);
      setShopMessage('Shop information updated.');
    } catch {
      setShopMessage('Could not update shop information.');
    } finally {
      setShopSaving(false);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    setExpenseError(''); setExpenseMessage('');
    if (!expenseForm.category || !expenseForm.amountUsd) {
      setExpenseError('Category and amount are required.');
      return;
    }
    setExpenseSaving(true);
    try {
      await api.post('/expenses', {
        category: expenseForm.category,
        description: expenseForm.description || null,
        amountUsd: Number(expenseForm.amountUsd),
        expenseDate: expenseForm.expenseDate || null,
      });
      setExpenseForm({ category: '', description: '', amountUsd: '', expenseDate: '' });
      setExpenseMessage('Expense recorded.');
      loadExpenses();
    } catch (err) {
      setExpenseError(err.response?.data?.error || 'Could not record expense.');
    } finally {
      setExpenseSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Settings & Administration</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Exchange Rate (USD to SOS)</h2>
        <div className="text-sm">
          Current rate:{' '}
          {currentRate ? (
            <span className="font-medium text-slate-800">1 USD = {Number(currentRate.rate).toLocaleString()} SOS</span>
          ) : (
            <span className="text-amber-600">Not set yet</span>
          )}
        </div>
        <form onSubmit={handleSaveRate} className="flex gap-2">
          <input type="number" step="0.01" placeholder="e.g. 8700" value={newRate} onChange={(e) => setNewRate(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={rateSaving}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">
            {rateSaving ? 'Saving...' : 'Update Rate'}
          </button>
        </form>
        {rateMessage && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{rateMessage}</div>}
        {rateError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{rateError}</div>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Shop Information</h2>
        <form onSubmit={handleSaveShopInfo} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-slate-600 mb-1">Shop name</label>
            <input value={shopInfo.shop_name} onChange={(e) => setShopInfo({ ...shopInfo, shop_name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-slate-600 mb-1">Address</label>
            <input value={shopInfo.shop_address} onChange={(e) => setShopInfo({ ...shopInfo, shop_address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Phone</label>
            <input value={shopInfo.shop_phone} onChange={(e) => setShopInfo({ ...shopInfo, shop_phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={shopSaving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">
              {shopSaving ? 'Saving...' : 'Save Shop Info'}
            </button>
          </div>
        </form>
        {shopMessage && <div className="text-sm text-slate-600">{shopMessage}</div>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Record an Expense</h2>
        <form onSubmit={handleAddExpense} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Category *</label>
            <input placeholder="e.g. Rent, Utilities" value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Amount (USD) *</label>
            <input type="number" step="0.01" value={expenseForm.amountUsd}
              onChange={(e) => setExpenseForm({ ...expenseForm, amountUsd: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-slate-600 mb-1">Description</label>
            <input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Date</label>
            <input type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {expenseError && <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{expenseError}</div>}
          <div className="col-span-2">
            <button type="submit" disabled={expenseSaving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">
              {expenseSaving ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>
        {expenseMessage && <div className="text-sm text-emerald-700">{expenseMessage}</div>}

        {recentExpenses.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Recent expenses</h3>
            {recentExpenses.map((exp) => (
              <div key={exp.id} className="flex justify-between text-sm py-1">
                <span className="text-slate-600">{exp.category} — {new Date(exp.expense_date).toLocaleDateString()}</span>
                <span className="font-medium">${money(exp.amount_usd)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Audit Log (most recent 30 actions)</h2>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {auditLogs.length === 0 && <p className="text-sm text-slate-400">No activity recorded yet.</p>}
          {auditLogs.map((log) => (
            <div key={log.id} className="flex justify-between text-sm border-b border-slate-50 py-1">
              <span className="text-slate-600">
                <span className="font-medium">{log.user_name || 'System'}</span> — {log.action.replace(/_/g, ' ').toLowerCase()}
              </span>
              <span className="text-slate-400 text-xs">{new Date(log.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
        <h2 className="font-semibold text-slate-800">Database Backups</h2>
        <p className="text-sm text-slate-500">
          Your database (hosted on Supabase) takes automatic daily backups on their end.
          You can view or restore from a backup directly in your Supabase project dashboard
          under Database → Backups.
        </p>
      </div>
    </div>
  );
}
