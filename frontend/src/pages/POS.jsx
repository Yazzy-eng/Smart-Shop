import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank', label: 'Bank' },
];

function money(n) {
  return Number(n || 0).toFixed(2);
}

export default function POS() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [displayCurrency, setDisplayCurrency] = useState('USD');

  const [customerMode, setCustomerMode] = useState('walkin');
  const [walkinName, setWalkinName] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isOnAccount, setIsOnAccount] = useState(false);

  const [discountUsd, setDiscountUsd] = useState('0');
  const [taxUsd, setTaxUsd] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const searchInputRef = useRef(null);

  useEffect(() => {
    api.get('/exchange-rates/current')
      .then(({ data }) => setExchangeRate(Number(data.rate.rate)))
      .catch(() => setExchangeRate(null));
    searchInputRef.current?.focus();
  }, []);

  async function handleSearch(e) {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const { data } = await api.get('/products', { params: { search: value } });
      setSearchResults(data.products);
    } catch {
      setSearchResults([]);
    }
  }

  async function handleBarcodeEnter(e) {
    if (e.key !== 'Enter') return;
    const value = searchTerm.trim();
    if (!value) return;
    try {
      const { data } = await api.get('/products', { params: { barcode: value } });
      if (data.products.length > 0) {
        addToCart(data.products[0]);
        setSearchTerm('');
        setSearchResults([]);
      }
    } catch {
      // no exact barcode match
    }
  }

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        unitPriceUsd: Number(product.sell_price_usd),
        quantity: 1,
        stock: Number(product.quantity_on_hand),
      }];
    });
    setSearchTerm('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  }

  function updateQty(productId, qty) {
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i)));
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function searchAccountCustomers(value) {
    setAccountSearch(value);
    if (value.trim().length < 2) {
      setAccountResults([]);
      return;
    }
    try {
      const { data } = await api.get('/customers', { params: { search: value, type: 'monthly_account' } });
      setAccountResults(data.customers);
    } catch {
      setAccountResults([]);
    }
  }

  const subtotalUsd = cart.reduce((sum, i) => sum + i.unitPriceUsd * i.quantity, 0);
  const totalUsd = subtotalUsd - Number(discountUsd || 0) + Number(taxUsd || 0);
  const rate = exchangeRate || 0;

  function fmt(usdAmount) {
    if (displayCurrency === 'SOS') {
      return `${money(usdAmount * rate)} SOS`;
    }
    return `$${money(usdAmount)}`;
  }

  async function handleCheckout() {
    setError('');
    if (cart.length === 0) {
      setError('Add at least one item to the cart.');
      return;
    }
    if (!exchangeRate) {
      setError('No exchange rate is set. Ask an admin to set one in Settings.');
      return;
    }
    if (customerMode === 'account' && !selectedCustomer) {
      setError('Select an account customer first.');
      return;
    }

    const payload = {
      customerId: customerMode === 'account' ? selectedCustomer.id : null,
      walkinCustomerName: customerMode === 'walkin' ? (walkinName || null) : null,
      items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPriceUsd: i.unitPriceUsd })),
      discountUsd: Number(discountUsd || 0),
      taxUsd: Number(taxUsd || 0),
      saleCurrency: displayCurrency,
      isOnAccount,
      payments: isOnAccount ? [] : [{ method: paymentMethod, amountUsd: totalUsd, currency: displayCurrency }],
    };

    setSubmitting(true);
    try {
      const { data } = await api.post('/sales', payload);
      setReceipt({ ...data, cartSnapshot: cart, customerName: selectedCustomer?.name || walkinName || 'Walk-in customer' });
      setCart([]);
      setDiscountUsd('0');
      setTaxUsd('0');
      setWalkinName('');
      setSelectedCustomer(null);
      setIsOnAccount(false);
      setCustomerMode('walkin');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong creating the sale.');
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return <Receipt receipt={receipt} cashierName={user.fullName} onNewSale={() => setReceipt(null)} />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-800">Sales / POS</h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Currency:</span>
            <button
              onClick={() => setDisplayCurrency('USD')}
              className={`px-3 py-1 rounded-lg ${displayCurrency === 'USD' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}
            >USD</button>
            <button
              onClick={() => setDisplayCurrency('SOS')}
              className={`px-3 py-1 rounded-lg ${displayCurrency === 'SOS' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}
            >SOS</button>
          </div>
        </div>

        {!exchangeRate && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No exchange rate is set yet. An admin needs to set the USD to SOS rate in Settings before checkout works.
          </div>
        )}

        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={handleSearch}
            onKeyDown={handleBarcodeEnter}
            placeholder="Scan barcode or search product name..."
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between text-sm"
                >
                  <span>{p.name}</span>
                  <span className="text-slate-500">${money(p.sell_price_usd)} - stock {p.quantity_on_hand}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 w-24">Qty</th>
                <th className="px-3 py-2 w-28">Price</th>
                <th className="px-3 py-2 w-28">Total</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Cart is empty - scan or search a product above</td></tr>
              )}
              {cart.map((item) => (
                <tr key={item.productId} className="border-t border-slate-100">
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      max={item.stock}
                      value={item.quantity}
                      onChange={(e) => updateQty(item.productId, Number(e.target.value))}
                      className="w-16 rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">{fmt(item.unitPriceUsd)}</td>
                  <td className="px-3 py-2 font-medium">{fmt(item.unitPriceUsd * item.quantity)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeItem(item.productId)} className="text-red-500 hover:text-red-700">X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-slate-800">Customer</h2>
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => { setCustomerMode('walkin'); setIsOnAccount(false); }}
              className={`flex-1 px-3 py-2 rounded-lg ${customerMode === 'walkin' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >Walk-in</button>
            <button
              onClick={() => setCustomerMode('account')}
              className={`flex-1 px-3 py-2 rounded-lg ${customerMode === 'account' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >Account customer</button>
          </div>

          {customerMode === 'walkin' ? (
            <input
              type="text"
              placeholder="Customer name (optional)"
              value={walkinName}
              onChange={(e) => setWalkinName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Search account customer by name/phone"
                value={selectedCustomer ? selectedCustomer.name : accountSearch}
                onChange={(e) => { setSelectedCustomer(null); searchAccountCustomers(e.target.value); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {accountResults.length > 0 && !selectedCustomer && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {accountResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setAccountResults([]); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex justify-between"
                    >
                      <span>{c.name}</span>
                      <span className="text-slate-500">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <label className="flex items-center gap-2 text-sm mt-2 text-slate-600">
                  <input type="checkbox" checked={isOnAccount} onChange={(e) => setIsOnAccount(e.target.checked)} />
                  Charge to account (no payment collected now)
                </label>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-slate-800">Totals</h2>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span><span>{fmt(subtotalUsd)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Discount ($)</span>
            <input type="number" value={discountUsd} onChange={(e) => setDiscountUsd(e.target.value)}
              className="w-24 rounded border border-slate-300 px-2 py-1 text-right" />
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Tax ($)</span>
            <input type="number" value={taxUsd} onChange={(e) => setTaxUsd(e.target.value)}
              className="w-24 rounded border border-slate-300 px-2 py-1 text-right" />
          </div>
          <div className="flex justify-between font-semibold text-lg border-t border-slate-100 pt-2">
            <span>Total</span><span>{fmt(totalUsd)}</span>
          </div>

          {!isOnAccount && (
            <div>
              <label className="block text-sm text-slate-600 mb-1">Payment method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <button
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg py-3 transition"
          >
            {submitting ? 'Processing...' : `Charge ${fmt(totalUsd)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Receipt({ receipt, cashierName, onNewSale }) {
  const { sale, items, exchangeRate, totalSos, customerName } = receipt;
  return (
    <div className="max-w-md mx-auto">
      <div className="flex justify-end gap-2 mb-4 print:hidden">
        <button onClick={onNewSale} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm">New Sale</button>
        <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm">Print Receipt</button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-6 font-mono text-sm">
        <div className="text-center mb-4">
          <div className="font-bold text-base">Deeqsan Store</div>
          <div className="text-slate-500">Hargeisa, Somaliland</div>
        </div>
        <div className="border-t border-dashed border-slate-300 my-2 pt-2">
          <div>Invoice: {sale.invoice_number}</div>
          <div>Date: {new Date(sale.created_at).toLocaleString()}</div>
          <div>Cashier: {cashierName}</div>
          <div>Customer: {customerName}</div>
        </div>
        <div className="border-t border-dashed border-slate-300 my-2 pt-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{item.productName} x{item.qty}</span>
              <span>${money(item.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-slate-300 my-2 pt-2 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>${money(sale.subtotal_usd)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-${money(sale.discount_usd)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>${money(sale.tax_usd)}</span></div>
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>${money(sale.total_usd)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Total (SOS)</span><span>{money(totalSos)} SOS</span></div>
          <div className="text-slate-400 text-xs">Rate used: 1 USD = {money(exchangeRate)} SOS</div>
        </div>
        <div className="text-center text-slate-400 text-xs mt-4">Thank you for shopping with us!</div>
      </div>
    </div>
  );
}
