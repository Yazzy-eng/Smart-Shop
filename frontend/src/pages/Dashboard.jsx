import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function money(n) {
  return Number(n || 0).toFixed(2);
}

function Card({ label, value, tone = 'default' }) {
  const toneClasses = {
    default: 'text-slate-800',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    success: 'text-emerald-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${toneClasses[tone]}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { hasRole } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(({ data }) => setData(data))
      .catch(() => setError('Could not load dashboard data.'));
  }, []);

  if (error) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>;
  }

  if (!data) {
    return <p className="text-sm text-slate-400">Loading dashboard...</p>;
  }

  const isManagement = hasRole('admin', 'manager');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Today's Sales" value={`$${money(data.todaySalesUsd)}`} tone="success" />
        <Card label="Sales Today (count)" value={data.todaySalesCount} />
        {isManagement && <Card label="Total Revenue (all time)" value={`$${money(data.totalRevenueUsd)}`} />}
        {isManagement && <Card label="Expenses (this month)" value={`$${money(data.totalExpensesUsdThisMonth)}`} />}
        <Card label="Products Low on Stock" value={data.lowStockCount} tone={data.lowStockCount > 0 ? 'warning' : 'default'} />
        {isManagement && (
          <Card label="Outstanding Customer Balances" value={`$${money(data.outstandingBalancesUsd)}`}
            tone={data.outstandingBalancesUsd > 0 ? 'danger' : 'default'} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Sales — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.salesLast7Days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `$${money(v)}`} />
              <Line type="monotone" dataKey="totalUsd" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Top Products (this month)</h2>
          {data.topProducts.length === 0 && <p className="text-sm text-slate-400">No sales yet this month.</p>}
          <div className="space-y-2">
            {data.topProducts.map((p, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-slate-700">{p.name}</span>
                <span className="text-slate-500">{p.unitsSold} sold · ${money(p.revenueUsd)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
