import { useState, useEffect } from 'react';
import api from '../api/client';

function money(n) {
  return Number(n || 0).toFixed(2);
}

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'categories', label: 'Categories' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'purchaseOrders', label: 'Purchase Orders (Stock In)' },
];

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('products');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Inventory</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${activeTab === tab.key ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'suppliers' && <SuppliersTab />}
      {activeTab === 'purchaseOrders' && <PurchaseOrdersTab />}
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', barcode: '', sku: '', sellPriceUsd: '', costPriceUsd: '',
    quantityOnHand: '', reorderLevel: '5', unit: 'pcs', categoryId: '', supplierId: '', expiryDate: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProducts();
    api.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
    api.get('/suppliers').then(({ data }) => setSuppliers(data.suppliers)).catch(() => {});
  }, []);

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
      // list simply won't update; user can retry
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
        categoryId: form.categoryId || null,
        supplierId: form.supplierId || null,
        expiryDate: form.expiryDate || null,
      });
      setForm({ name: '', barcode: '', sku: '', sellPriceUsd: '', costPriceUsd: '', quantityOnHand: '', reorderLevel: '5', unit: 'pcs', categoryId: '', supplierId: '', expiryDate: '' });
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
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
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
            <label className="block text-sm text-slate-600 mb-1">Category</label>
            <select value={form.categoryId} onChange={(e) => updateField('categoryId', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Supplier</label>
            <select value={form.supplierId} onChange={(e) => updateField('supplierId', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">None</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
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
          <div>
            <label className="block text-sm text-slate-600 mb-1">Expiry date (optional)</label>
            <input type="date" value={form.expiryDate} onChange={(e) => updateField('expiryDate', e.target.value)}
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
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No products yet - add your first one above</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 text-slate-500">{p.barcode || '-'}</td>
                <td className="px-3 py-2">${Number(p.sell_price_usd).toFixed(2)}</td>
                <td className={`px-3 py-2 ${Number(p.quantity_on_hand) <= Number(p.reorder_level) ? 'text-red-600 font-medium' : ''}`}>
                  {p.quantity_on_hand}
                </td>
                <td className="px-3 py-2 text-slate-500">{p.expiry_date ? new Date(p.expiry_date).toLocaleDateString() : '-'}</td>
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

function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  function load() {
    api.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Category name is required.'); return; }
    setSaving(true);
    try {
      await api.post('/categories', { name });
      setName('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving...' : 'Add'}
        </button>
      </form>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {categories.length === 0 && <p className="text-sm text-slate-400 p-4">No categories yet.</p>}
        {categories.map((c) => (
          <div key={c.id} className="px-4 py-2 text-sm">{c.name}</div>
        ))}
      </div>
    </div>
  );
}

function SuppliersTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  function load() {
    api.get('/suppliers').then(({ data }) => setSuppliers(data.suppliers)).catch(() => {});
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Supplier name is required.'); return; }
    setSaving(true);
    try {
      await api.post('/suppliers', form);
      setForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add supplier.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium">
          {showForm ? 'Cancel' : '+ Add Supplier'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm text-slate-600 mb-1">Supplier name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Contact person</label>
            <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-slate-600 mb-1">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {error && <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="col-span-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      )}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Phone</th></tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">No suppliers yet.</td></tr>}
            {suppliers.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2 text-slate-500">{s.contact_person || '-'}</td>
                <td className="px-3 py-2 text-slate-500">{s.phone || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseOrdersTab() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: '', unitCostUsd: '' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOrders();
    api.get('/products').then(({ data }) => setProducts(data.products)).catch(() => {});
    api.get('/suppliers').then(({ data }) => setSuppliers(data.suppliers)).catch(() => {});
  }, []);

  function loadOrders() {
    api.get('/purchase-orders').then(({ data }) => setOrders(data.purchaseOrders)).catch(() => {});
  }

  function updateItem(idx, key, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  }

  function addItemRow() {
    setItems((prev) => [...prev, { productId: '', quantity: '', unitCostUsd: '' }]);
  }

  function removeItemRow(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    const validItems = items.filter((it) => it.productId && it.quantity && it.unitCostUsd);
    if (validItems.length === 0) {
      setError('Add at least one item with product, quantity, and unit cost.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/purchase-orders', {
        supplierId: supplierId || null,
        notes: notes || null,
        items: validItems.map((it) => ({
          productId: it.productId, quantity: Number(it.quantity), unitCostUsd: Number(it.unitCostUsd),
        })),
      });
      setSupplierId(''); setNotes(''); setItems([{ productId: '', quantity: '', unitCostUsd: '' }]);
      setShowForm(false);
      loadOrders();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create purchase order.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive(id) {
    if (!window.confirm('Mark this purchase order as received? This will add the stock to your inventory.')) return;
    try {
      await api.post(`/purchase-orders/${id}/receive`);
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not receive this purchase order.');
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this purchase order?')) return;
    try {
      await api.post(`/purchase-orders/${id}/cancel`);
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not cancel this purchase order.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium">
          {showForm ? 'Cancel' : '+ New Purchase Order'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Supplier</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">None / not specified</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-slate-600">Items to receive</label>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select product...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input type="number" step="0.01" placeholder="Unit cost" value={item.unitCostUsd} onChange={(e) => updateItem(idx, 'unitCostUsd', e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button type="button" onClick={() => removeItemRow(idx)} className="text-red-500 text-sm">✕</button>
              </div>
            ))}
            <button type="button" onClick={addItemRow} className="text-sm text-emerald-700">+ Add another item</button>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Purchase Order'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-3 py-2">PO Number</th><th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2">Status</th><th className="px-3 py-2">Ordered</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No purchase orders yet.</td></tr>}
            {orders.map((po) => (
              <tr key={po.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{po.po_number}</td>
                <td className="px-3 py-2 text-slate-500">{po.supplier_name || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    po.status === 'received' ? 'bg-emerald-100 text-emerald-700' :
                    po.status === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                  }`}>{po.status}</span>
                </td>
                <td className="px-3 py-2 text-slate-500">{new Date(po.ordered_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                  {po.status === 'pending' && (
                    <>
                      <button onClick={() => handleReceive(po.id)} className="text-xs text-emerald-700 hover:underline">Receive Stock</button>
                      <button onClick={() => handleCancel(po.id)} className="text-xs text-red-500 hover:underline">Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
