import { useState, useEffect } from 'react';
import api from '../api/client';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', barcode: '', sku: '', sellPriceUsd: '', costPriceUsd: '',
    quantityOnHand: '', reorderLevel: '5', unit: 'pcs',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProducts(); }, []);

  function loadProducts() {
    api.get('/products').then(({ data }) => setProducts(data.products)).catch(() => {});
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleDeactivate(productId, productName) {
    if (!window.confirm(`Remove "${productName}" from active inventory? It will no longer show up in Sales/POS or Inventory, but past sales referencing it stay intact.`)) return;
    try {
      await api.delete(`/products/${productId}`);
      loadProducts();
    } catch {
      // If this fails, the list simply won't update; user can retry.
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.sellPriceUsd) {
      setError('Name and sell price are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/products', {
        name: form.name,
        barcode: form.barcode || null,
        sku: form.sku || null,
        sellPriceUsd: Number(form.sellPriceUsd),
        costPriceUsd: Number(form.costPriceUsd || 0),
        quantityOnHand: Number(form.quantityOnHand || 0),
        reorderLevel: Number(form.reorderLevel || 5),
        unit: form.unit,
      });
      setForm({ name: '', barcode: '', sku: '', sellPriceUsd: '', costPriceUsd: '', quantityOnHand: '', reorderLevel: '5', unit: 'pcs' });
      setShowForm(false);
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add product.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Inventory</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
        >
          {showForm ? 'Cancel' : '+ Add Product'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-slate-600 mb-1">Product name *</label>
            <input value={form.name} onChange={(e) => updateField('name', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Barcode</label>
            <input value={form.barcode} onChange={(e) => updateField('barcode', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">SKU</label>
            <input value={form.sku} onChange={(e) => updateField('sku', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Sell price (USD) *</label>
            <input type="number" step="0.01" value={form.sellPriceUsd} onChange={(e) => updateField('sellPriceUsd', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Cost price (USD)</label>
            <input type="number" step="0.01" value={form.costPriceUsd} onChange={(e) => updateField('costPriceUsd', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Quantity on hand</label>
            <input type="number" value={form.quantityOnHand} onChange={(e) => updateField('quantityOnHand', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Reorder level</label>
            <input type="number" value={form.reorderLevel} onChange={(e) => updateField('reorderLevel', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {error && <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="col-span-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Barcode</th>
              <th className="px-3 py-2">Price (USD)</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No products yet - add your first one above</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 text-slate-500">{p.barcode || '-'}</td>
                <td className="px-3 py-2">${Number(p.sell_price_usd).toFixed(2)}</td>
                <td className={`px-3 py-2 ${Number(p.quantity_on_hand) <= Number(p.reorder_level) ? 'text-red-600 font-medium' : ''}`}>
                  {p.quantity_on_hand}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => handleDeactivate(p.id, p.name)} className="text-xs text-red-500 hover:text-red-700">
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
