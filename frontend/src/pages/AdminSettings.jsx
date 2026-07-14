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

  const [shopInfo, setShopInfo] = useState({ shop_name: '', shop_address: '', shop_phone: '', receipt_width: '80mm' });
  const [shopSaving, setShopSaving] = useState(false);
  const [shopMessage, setShopMessage] = useState('');

  const [expenseForm, setExpenseForm] = useState({ category: '', description: '', amountUsd: '', expenseDate: '' });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseMessage, setExpenseMessage] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [recentExpenses, setRecentExpenses] = useState([]);

  const [auditLogs, setAuditLogs] = useState([]);

  const [roles, setRoles] = useState([]);
  const [roleSaving, setRoleSaving] = useState(null);
  const [roleMessage, setRoleMessage] = useState('');

  const [backupDownloading, setBackupDownloading] = useState(false);
  const [backupError, setBackupError] = useState('');

  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const PERMISSION_KEYS = [
    'sales.create', 'sales.void', 'products.manage', 'customers.manage',
    'reports.view', 'expenses.manage', 'users.manage', 'settings.manage',
  ];

  useEffect(() => {
    loadRate();
    loadShopInfo();
    loadExpenses();
    loadAuditLogs();
    loadRoles();
  }, []);

  function loadRoles() {
    api.get('/admin/roles').then(({ data }) => setRoles(data.roles)).catch(() => {});
  }

  function loadRate() {
    api.get('/exchange-rates/current').then(({ data }) => setCurrentRate(data.rate)).catch(() => setCurrentRate(null));
  }

  function loadShopInfo() {
    api.get('/admin/shop-settings').then(({ data }) => {
      setShopInfo({
        shop_name: data.settings.shop_name || '',
        shop_address: data.settings.shop_address || '',
        shop_phone: data.settings.shop_phone || '',
        receipt_width: data.settings.receipt_width || '80mm',
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

  async function handleTogglePermission(role, key) {
    const currentValue = role.permissions?.[key] === true;
    const updatedPermissions = { ...role.permissions, [key]: !currentValue };
    setRoleSaving(role.id);
    setRoleMessage('');
    try {
      await api.put(`/admin/roles/${role.id}`, { permissions: updatedPermissions });
      loadRoles();
    } catch {
      setRoleMessage('Could not update that permission.');
    } finally {
      setRoleSaving(null);
    }
  }

  async function handleDownloadBackup() {
    setBackupError('');
    setBackupDownloading(true);
    try {
      const { data } = await api.get('/admin/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `deeqsan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setBackupError('Could not generate backup. Please try again.');
    } finally {
      setBackupDownloading(false);
    }
  }

  async function handleResetRevenue() {
    setResetError('');
    setResetMessage('');
    if (resetConfirmText !== 'RESET REVENUE') {
      setResetError('Type "RESET REVENUE" exactly (in capitals) to confirm.');
      return;
    }
    setResetting(true);
    try {
      const { data } = await api.delete('/admin/reset-revenue', { data: { confirmation: resetConfirmText } });
      setResetMessage(data.message);
      setResetConfirmText('');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Could not reset revenue.');
    } finally {
      setResetting(false);
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
          <div>
            <label className="block text-sm text-slate-600 mb-1">Receipt printer width</label>
            <select value={shopInfo.receipt_width} onChange={(e) => setShopInfo({ ...shopInfo, receipt_width: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="58mm">58mm thermal printer</option>
              <option value="80mm">80mm thermal printer</option>
              <option value="normal">Normal paper (A4 / Letter)</option>
            </select>
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

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Role Permissions</h2>
        <p className="text-sm text-slate-500">
          Turn permissions on or off for the Manager and Cashier roles. Admin always has full access
          and can't be restricted here, to prevent accidentally locking yourself out.
        </p>
        {roleMessage && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{roleMessage}</div>}
        <div className="space-y-4">
          {roles.filter((r) => r.name !== 'admin').map((role) => (
            <div key={role.id} className="border border-slate-100 rounded-lg p-3">
              <h3 className="text-sm font-medium text-slate-800 capitalize mb-2">{role.name}</h3>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={role.permissions?.[key] === true}
                      disabled={roleSaving === role.id}
                      onChange={() => handleTogglePermission(role, key)}
                    />
                    {key}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {roles.length === 0 && <p className="text-sm text-slate-400">Loading roles...</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
        <h2 className="font-semibold text-slate-800">Download a Backup</h2>
        <p className="text-sm text-slate-500">
          Download a copy of all your shop's data (products, sales, customers, expenses, etc.) as a
          file you can keep for your own records. This is in addition to Supabase's automatic daily backups.
        </p>
        <button onClick={handleDownloadBackup} disabled={backupDownloading}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">
          {backupDownloading ? 'Preparing...' : 'Download Backup (JSON)'}
        </button>
        {backupError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{backupError}</div>}
      </div>

      <div className="bg-white rounded-xl border border-red-200 p-5 space-y-3">
        <h2 className="font-semibold text-red-700">Reset Revenue History (Danger Zone)</h2>
        <p className="text-sm text-slate-500">
          This permanently deletes every sale, sale item, and sale-linked payment — this is what your
          Dashboard and Reports revenue figures are calculated from. Products, stock quantities, and
          customer profiles are not affected. <strong>This cannot be undone.</strong> Consider downloading
          a backup above first.
        </p>
        <p className="text-sm text-slate-600">
          Type <span className="font-mono font-semibold">RESET REVENUE</span> below to confirm:
        </p>
        <input
          type="text"
          value={resetConfirmText}
          onChange={(e) => setResetConfirmText(e.target.value)}
          placeholder="RESET REVENUE"
          className="w-full max-w-xs rounded-lg border border-red-300 px-3 py-2 text-sm"
        />
        {resetError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resetError}</div>}
        {resetMessage && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{resetMessage}</div>}
        <button
          onClick={handleResetRevenue}
          disabled={resetting || resetConfirmText !== 'RESET REVENUE'}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium"
        >
          {resetting ? 'Resetting...' : 'Permanently Reset Revenue'}
        </button>
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
