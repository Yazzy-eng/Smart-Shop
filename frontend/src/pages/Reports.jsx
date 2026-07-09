import { useState, useEffect } from 'react';
import api from '../api/client';

function money(n) {
  return Number(n || 0).toFixed(2);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoIso() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function downloadCsv(filename, headers, rows) {
  const escape = (val) => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(','), ...rows.map((row) => row.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const TABS = [
  { key: 'sales', label: 'Sales' },
  { key: 'profitLoss', label: 'Profit & Loss' },
  { key: 'bestSellers', label: 'Best Sellers' },
  { key: 'cashierPerformance', label: 'Cashier Performance' },
  { key: 'customerBalances', label: 'Customer Balances' },
  { key: 'inventory', label: 'Inventory' },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [from, setFrom] = useState(monthAgoIso());
  const [to, setTo] = useState(todayIso());
  const [groupBy, setGroupBy] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function loadReport() {
    setLoading(true);
    setError('');
    try {
      let res;
      switch (activeTab) {
        case 'sales':
          res = await api.get('/reports/sales', { params: { from, to, groupBy } });
          break;
        case 'profitLoss':
          res = await api.get('/reports/profit-loss', { params: { from, to } });
          break;
        case 'bestSellers':
          res = await api.get('/reports/best-sellers', { params: { from, to } });
          break;
        case 'cashierPerformance':
          res = await api.get('/reports/cashier-performance', { params: { from, to } });
          break;
        case 'customerBalances':
          res = await api.get('/reports/customer-balances');
          break;
        case 'inventory':
          res = await api.get('/reports/inventory');
          break;
        default:
          return;
      }
      setData(res.data);
    } catch {
      setError('Could not load this report.');
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!data) return;
    switch (activeTab) {
      case 'sales':
        downloadCsv('sales-report.csv', ['Period', 'Sales', 'Subtotal', 'Discount', 'Tax', 'Total'],
          data.rows.map(r => [r.period, r.saleCount, money(r.subtotalUsd), money(r.discountUsd), money(r.taxUsd), money(r.totalUsd)]));
        break;
      case 'bestSellers':
        downloadCsv('best-sellers.csv', ['Product', 'Units Sold', 'Revenue (USD)'],
          data.products.map(p => [p.name, p.unitsSold, money(p.revenueUsd)]));
        break;
      case 'cashierPerformance':
        downloadCsv('cashier-performance.csv', ['Cashier', 'Sales', 'Total (USD)'],
          data.cashiers.map(c => [c.fullName, c.saleCount, money(c.totalUsd)]));
        break;
      case 'customerBalances':
        downloadCsv('customer-balances.csv', ['Customer', 'Phone', 'Credit Limit', 'Outstanding Balance'],
          data.customers.map(c => [c.name, c.phone, money(c.creditLimitUsd), money(c.outstandingBalanceUsd)]));
        break;
      case 'inventory':
        downloadCsv('inventory-report.csv', ['Product', 'SKU', 'Barcode', 'Category', 'Stock', 'Reorder Level', 'Cost (USD)', 'Sell Price (USD)', 'Stock Value (USD)'],
          data.products.map(p => [p.name, p.sku, p.barcode, p.categoryName, p.quantityOnHand, p.reorderLevel, money(p.costPriceUsd), money(p.sellPriceUsd), money(p.stockValueUsd)]));
        break;
      default:
        break;
    }
  }

  const needsDateRange = activeTab !== 'customerBalances' && activeTab !== 'inventory';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Reports</h1>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${activeTab === tab.key ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {needsDateRange && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            {activeTab === 'sales' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Group by</label>
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
            )}
            <button onClick={loadReport} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium">Apply</button>
            <button onClick={handleExport} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium ml-auto">Export CSV</button>
          </div>
        )}
        {!needsDateRange && (
          <div className="flex justify-end">
            <button onClick={handleExport} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium">Export CSV</button>
          </div>
        )}

        {loading && <p className="text-sm text-slate-400">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && data && activeTab === 'sales' && (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-100">
              <tr><th className="py-2">Period</th><th>Sales</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Total</th></tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2">{r.period}</td><td>{r.saleCount}</td>
                  <td>${money(r.subtotalUsd)}</td><td>${money(r.discountUsd)}</td>
                  <td>${money(r.taxUsd)}</td><td className="font-medium">${money(r.totalUsd)}</td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No sales in this range.</td></tr>}
            </tbody>
          </table>
        )}

        {!loading && data && activeTab === 'profitLoss' && (
          <div className="grid grid-cols-2 gap-4 text-sm max-w-md">
            <div className="text-slate-500">Revenue</div><div className="text-right">${money(data.revenue)}</div>
            <div className="text-slate-500">Cost of Goods</div><div className="text-right">-${money(data.costOfGoods)}</div>
            <div className="font-medium border-t border-slate-100 pt-2">Gross Profit</div>
            <div className="text-right font-medium border-t border-slate-100 pt-2">${money(data.grossProfit)}</div>
            <div className="text-slate-500">Expenses</div><div className="text-right">-${money(data.expenses)}</div>
            <div className="font-bold border-t border-slate-100 pt-2">Net Profit</div>
            <div className={`text-right font-bold border-t border-slate-100 pt-2 ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              ${money(data.netProfit)}
            </div>
          </div>
        )}

        {!loading && data && activeTab === 'bestSellers' && (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-100">
              <tr><th className="py-2">Product</th><th>Units Sold</th><th>Revenue</th></tr>
            </thead>
            <tbody>
              {data.products.map((p, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2">{p.name}</td><td>{p.unitsSold}</td><td>${money(p.revenueUsd)}</td>
                </tr>
              ))}
              {data.products.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400">No sales in this range.</td></tr>}
            </tbody>
          </table>
        )}

        {!loading && data && activeTab === 'cashierPerformance' && (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-100">
              <tr><th className="py-2">Cashier</th><th>Sales</th><th>Total</th></tr>
            </thead>
            <tbody>
              {data.cashiers.map((c, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2">{c.fullName}</td><td>{c.saleCount}</td><td>${money(c.totalUsd)}</td>
                </tr>
              ))}
              {data.cashiers.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400">No cashiers with sales yet.</td></tr>}
            </tbody>
          </table>
        )}

        {!loading && data && activeTab === 'customerBalances' && (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b border-slate-100">
              <tr><th className="py-2">Customer</th><th>Phone</th><th>Credit Limit</th><th>Outstanding</th></tr>
            </thead>
            <tbody>
              {data.customers.map((c, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2">{c.name}</td><td>{c.phone}</td>
                  <td>${money(c.creditLimitUsd)}</td>
                  <td className={c.outstandingBalanceUsd > 0 ? 'text-red-600 font-medium' : ''}>${money(c.outstandingBalanceUsd)}</td>
                </tr>
              ))}
              {data.customers.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">No account customers yet.</td></tr>}
            </tbody>
          </table>
        )}

        {!loading && data && activeTab === 'inventory' && (
          <>
            <p className="text-sm text-slate-500 mb-2">Total stock valuation: <span className="font-semibold text-slate-800">${money(data.totalValuationUsd)}</span></p>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-100">
                <tr><th className="py-2">Product</th><th>Category</th><th>Stock</th><th>Cost</th><th>Sell Price</th><th>Value</th></tr>
              </thead>
              <tbody>
                {data.products.map((p, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2">{p.name}</td><td>{p.categoryName || '-'}</td>
                    <td className={p.lowStock ? 'text-red-600 font-medium' : ''}>{p.quantityOnHand}</td>
                    <td>${money(p.costPriceUsd)}</td><td>${money(p.sellPriceUsd)}</td><td>${money(p.stockValueUsd)}</td>
                  </tr>
                ))}
                {data.products.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No products yet.</td></tr>}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
