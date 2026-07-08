import { useState, useEffect } from 'react';
import api from '../api/client';

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', customerType: 'monthly_account', creditLimitUsd: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [statement, setStatement] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => { loadCustomers(); }, [search]);

  function loadCustomers() {
    api.get('/customers', { params: search ? { search } : {} })
      .then(({ data }) => setCustomers(data.customers))
      .catch(() => {});
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddCustomer(e) {
    e.preventDefault();
    setError('');
    if (!form.name) {
      setError('Customer name is required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/customers', {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        customerType: form.customerType,
        creditLimitUsd: Number(form.creditLimitUsd || 0),
      });
      setForm({ name: '', phone: '', email: '', address: '', customerType: 'monthly_account', creditLimitUsd: '' });
      setShowForm(false);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add customer.');
    } finally {
      setSaving(false);
    }
  }

  async function openStatement(customer) {
    setSelectedCustomer(customer);
    setStatement(null);
    setPaymentError('');
    try {
      const { data } = await api.get(`/customers/${customer.id}/statement`);
      setStatement(data);
    } catch {
      setStatement({ error: true });
    }
  }

  async function handleRecordPayment(e) {
    e.preventDefault();
    setPaymentError('');
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setPaymentError('Enter a valid payment amount.');
      return;
    }
    setRecordingPayment(true);
    try {
      await api.post(`/customers/${selectedCustomer.id}/payments`, {
        method: paymentMethod,
        amountUsd: amount,
        referenceNote: paymentNote || null,
      });
      setPaymentAmount('');
      setPaymentNote('');
      openStatement(selectedCustomer);
      loadCustomers();
    } catch (err) {
      setPaymentError(err.response?.data?.error || 'Could not record payment.');
    } finally {
      setRecordingPayment(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-800">Customers</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
          >
            {showForm ? 'Cancel' : '+ Add Customer'}
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        {showForm && (
          <form onSubmit={handleAddCustomer} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Name *</label>
              <input value={form.name} onChange={(e) => updateField('name', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email</label>
              <input value={form.email} onChange={(e) => updateField('email', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Address</label>
              <input value={form.address} onChange={(e) => updateField('address', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Customer type</label>
              <select value={form.customerType} onChange={(e) => updateField('customerType', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="monthly_account">Monthly Account</option>
                <option value="walkin">Walk-in</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Credit limit (USD)</label>
              <input type="number" step="0.01" value={form.creditLimitUsd} onChange={(e) => updateField('creditLimitUsd', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            {error && <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <div className="col-span-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">
                {saving ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">No customers yet - add your first one above</td></tr>
              )}
              {customers.map((c) => (
                <tr key={c.id} onClick={() => openStatement(c)}
                  className="border-t border-slate-100 cursor-pointer hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-slate-500">{c.phone || '-'}</td>
                  <td className="px-3 py-2 text-slate-500 capitalize">{c.customer_type.replace('_', ' ')}</td>
                  <td className={`px-3 py-2 ${Number(c.outstanding_balance_usd) > 0 ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                    ${money(c.outstanding_balance_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        {!selectedCustomer && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-sm text-slate-400 text-center">
            Select a customer to view their statement
          </div>
        )}

        {selectedCustomer && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-slate-800">{selectedCustomer.name}</h2>
              <p className="text-sm text-slate-500">{selectedCustomer.phone}</p>
            </div>

            {!statement && <p className="text-sm text-slate-400">Loading statement...</p>}
            {statement?.error && <p className="text-sm text-red-600">Could not load statement.</p>}

            {statement && !statement.error && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-slate-500">Charged</div>
                    <div className="font-semibold">${money(statement.summary.totalChargedUsd)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-slate-500">Paid</div>
                    <div className="font-semibold">${money(statement.summary.totalPaidUsd)}</div>
                  </div>
                  <div className="col-span-2 bg-red-50 rounded-lg p-3">
                    <div className="text-red-600">Outstanding balance</div>
                    <div className="font-bold text-lg text-red-700">${money(statement.summary.outstandingBalanceUsd)}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Recent sales on account</h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {statement.sales.length === 0 && <p className="text-sm text-slate-400">No sales yet.</p>}
                    {statement.sales.map((s) => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span className="text-slate-600">{s.invoice_number}</span>
                        <span>${money(s.total_usd)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Payment history</h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {statement.payments.length === 0 && <p className="text-sm text-slate-400">No payments recorded yet.</p>}
                    {statement.payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span className="text-slate-600 capitalize">{p.method.replace('_', ' ')}</span>
                        <span>${money(p.amount_usd)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleRecordPayment} className="border-t border-slate-100 pt-4 space-y-2">
                  <h3 className="text-sm font-medium text-slate-700">Record a payment</h3>
                  <input type="number" step="0.01" placeholder="Amount (USD)" value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="bank">Bank</option>
                  </select>
                  <input type="text" placeholder="Note (optional)" value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  {paymentError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{paymentError}</div>}
                  <button type="submit" disabled={recordingPayment}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm">
                    {recordingPayment ? 'Saving...' : 'Record Payment'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
