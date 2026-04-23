'use client';

import { useState, useEffect, useTransition, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  listMenuItems,
  getCustomer,
  searchCustomers,
  createCustomer,
  createOrder,
  createMenuItem,
  type MenuItem,
  type Customer,
  type OrderType,
} from '@/lib/api';

type LineItem = { menu_item_id: number; qty: number; unitPrice: string; name: string };

// ── New item creation modal ───────────────────────────────────────────────────

function NewItemModal({
  itemName,
  onCreated,
  onCancel,
}: {
  itemName: string;
  onCreated: (item: MenuItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(itemName);
  const [price, setPrice] = useState('');
  const [inStock, setInStock] = useState(true);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!price.trim() || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      setError('Enter a valid price.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await createMenuItem({
          name: name.trim(),
          price: parseFloat(price).toFixed(2),
          in_stock: inStock,
        });
        onCreated(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create item');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleCreate}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-base font-semibold text-gray-800">
          Add &ldquo;{itemName}&rdquo; to menu?
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Price (*) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
              className="rounded border-gray-300"
            />
            In stock
          </label>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {pending ? 'Creating…' : 'Create & Add'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── New customer inline form ──────────────────────────────────────────────────

function NewCustomerInline({
  onCreated,
  onCancel,
}: {
  onCreated: (c: Customer) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        const res = await createCustomer({ name, phone, email: email || undefined });
        onCreated(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create customer');
      }
    });
  }

  return (
    <form
      onSubmit={handleCreate}
      className="mt-3 rounded border border-orange-200 bg-orange-50 p-3"
    >
      <p className="mb-2 text-xs font-semibold text-orange-700">New customer</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          required
          placeholder="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <input
          required
          placeholder="Phone *"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <input
          type="email"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create Customer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

function NewSaleForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCustomerId = searchParams.get('customer_id') ?? '';

  const [orderType, setOrderType] = useState<OrderType>('PAID');

  // Customer
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  // Menu items
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [newItemPrompt, setNewItemPrompt] = useState<string | null>(null);

  // Cash withdrawal charges
  const [charges, setCharges] = useState('');

  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listMenuItems()
      .then((res) => setMenuItems(res.data.items))
      .catch(() => {});
  }, []);

  // Pre-fill customer
  useEffect(() => {
    if (!prefillCustomerId) return;
    getCustomer(prefillCustomerId)
      .then((res) => selectCustomer(res.data))
      .catch(() => {});
  }, [prefillCustomerId]);

  // ── Customer search ──────────────────────────────────────────────────────────

  function searchCustomerDebounced(q: string) {
    setCustomerQuery(q);
    setSelectedCustomer(null);
    setShowNewCustomer(false);
    if (!q.trim()) { setCustomerSuggestions([]); return; }
    searchCustomers(q, 1, 5)
      .then((res) => setCustomerSuggestions(res.data.items))
      .catch(() => {});
  }

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerQuery(`${c.name} — ${c.phone}`);
    setCustomerSuggestions([]);
    setShowNewCustomer(false);
  }

  function handleCustomerCreated(c: Customer) {
    selectCustomer(c);
  }

  // ── Menu item handling ───────────────────────────────────────────────────────

  const filteredMenu = menuItems.filter((m) =>
    m.inStock && m.name.toLowerCase().includes(itemSearch.toLowerCase()),
  );

  const exactMatch = menuItems.some(
    (m) => m.name.toLowerCase() === itemSearch.trim().toLowerCase(),
  );

  function addLine(item: MenuItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.menu_item_id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.menu_item_id === item.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [...prev, { menu_item_id: item.id, qty: 1, unitPrice: item.price, name: item.name }];
    });
    setItemSearch('');
  }

  function updateQty(id: number, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.menu_item_id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function handleItemCreated(item: MenuItem) {
    setMenuItems((prev) => [...prev, item]);
    addLine(item);
    setNewItemPrompt(null);
  }

  // ── Totals ───────────────────────────────────────────────────────────────────

  const lineTotal = lines.reduce(
    (sum, l) => sum + parseFloat(l.unitPrice) * l.qty,
    0,
  );
  const chargeValue = parseFloat(charges) || 0;
  const grandTotal = (lineTotal + chargeValue).toFixed(2);

  // ── Submit ───────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedCustomer) {
      setError('Select or create a customer.');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one item.');
      return;
    }
    if (orderType === 'CREDIT' && !dueDate) {
      setError('Due date is required for credit orders.');
      return;
    }

    startTransition(async () => {
      try {
        await createOrder({
          type: orderType,
          customer_id: selectedCustomer.id,
          items: lines.map((l) => ({ menu_item_id: l.menu_item_id, qty: l.qty })),
          total: grandTotal,
          due_date: orderType === 'CREDIT' ? dueDate : undefined,
          note: note || undefined,
        });
        router.push(`/customers/${selectedCustomer.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create order');
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">New Sale</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Order type ── */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-3 block text-sm font-semibold text-gray-700">Order type</label>
          <div className="flex gap-3">
            {(['PAID', 'CREDIT'] as OrderType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  orderType === t
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Customer ── */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">Customer</label>
          <div className="relative">
            <input
              value={customerQuery}
              onChange={(e) => searchCustomerDebounced(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            {customerSuggestions.length > 0 && !selectedCustomer && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                {customerSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50"
                  >
                    <span className="font-medium">{c.name}</span>{' '}
                    <span className="text-gray-400">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedCustomer && (
            <p className="mt-1 text-xs text-green-600">
              Selected: {selectedCustomer.name} ({selectedCustomer.phone})
            </p>
          )}
          {!selectedCustomer && customerQuery.trim() && customerSuggestions.length === 0 && !showNewCustomer && (
            <button
              type="button"
              onClick={() => setShowNewCustomer(true)}
              className="mt-2 text-sm text-orange-600 hover:underline"
            >
              Customer not found — create new?
            </button>
          )}
          {showNewCustomer && (
            <NewCustomerInline
              onCreated={handleCustomerCreated}
              onCancel={() => setShowNewCustomer(false)}
            />
          )}
        </div>

        {/* ── Items ── */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-3 block text-sm font-semibold text-gray-700">
            What did they buy? *
          </label>

          {/* Item search */}
          <div className="relative mb-3">
            <input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search menu items…"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Filtered items */}
          {itemSearch.trim() && (
            <div className="mb-3 max-h-48 overflow-y-auto rounded border border-gray-200">
              {filteredMenu.length > 0 ? (
                filteredMenu.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addLine(m)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-orange-50"
                  >
                    <span>{m.name}</span>
                    <span className="text-gray-400">₦{m.price}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-400">No matching items.</div>
              )}
              {itemSearch.trim() && !exactMatch && (
                <button
                  type="button"
                  onClick={() => setNewItemPrompt(itemSearch.trim())}
                  className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm text-orange-600 hover:bg-orange-50"
                >
                  + Create &ldquo;{itemSearch.trim()}&rdquo; as new menu item
                </button>
              )}
            </div>
          )}

          {/* Selected lines */}
          {lines.length > 0 && (
            <div className="space-y-1">
              {lines.map((l) => (
                <div
                  key={l.menu_item_id}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
                >
                  <span>
                    {l.name}
                    <span className="ml-1 text-gray-400">₦{l.unitPrice}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateQty(l.menu_item_id, -1)} className="text-gray-500 hover:text-red-500">
                      −
                    </button>
                    <span className="w-6 text-center">{l.qty}</span>
                    <button type="button" onClick={() => updateQty(l.menu_item_id, 1)} className="text-gray-500 hover:text-green-600">
                      +
                    </button>
                    <span className="ml-2 text-gray-500">
                      ₦{(parseFloat(l.unitPrice) * l.qty).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              <p className="pt-1 text-right text-sm text-gray-600">
                Items subtotal: <span className="font-semibold">₦{lineTotal.toFixed(2)}</span>
              </p>
            </div>
          )}
        </div>

        {/* ── Charges (optional — e.g. for cash withdrawals) ── */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-semibold text-gray-700">
            Charges (₦)
            <span className="ml-1 text-xs font-normal text-gray-400">
              optional — e.g. cash withdrawal service fee
            </span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={charges}
            onChange={(e) => setCharges(e.target.value)}
            placeholder="0.00"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* ── Total + due date ── */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Total (₦)</label>
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-lg font-semibold text-orange-700">
                ₦{grandTotal}
              </p>
              {chargeValue > 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  Items ₦{lineTotal.toFixed(2)} + Charges ₦{chargeValue.toFixed(2)}
                </p>
              )}
            </div>
            {orderType === 'CREDIT' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Due date *</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            )}
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-orange-500 px-6 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Create Sale'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* New item modal */}
      {newItemPrompt && (
        <NewItemModal
          itemName={newItemPrompt}
          onCreated={handleItemCreated}
          onCancel={() => setNewItemPrompt(null)}
        />
      )}
    </div>
  );
}

export default function NewSalePage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
      <NewSaleForm />
    </Suspense>
  );
}
