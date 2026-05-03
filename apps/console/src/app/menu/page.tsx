'use client';

import { useState, useEffect, useTransition } from 'react';
import { listMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, type MenuItem } from '@/lib/api';

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState('');
  const [loadPending, startLoad] = useTransition();

  // New item form
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newInStock, setNewInStock] = useState(true);
  const [newError, setNewError] = useState('');
  const [newPending, startNewTransition] = useTransition();

  // Inline edit state keyed by item id
  const [editing, setEditing] = useState<Record<number, { name: string; price: string }>>({});
  const [savePending, startSaveTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    startLoad(async () => {
      setError('');
      try {
        const res = await listMenuItems();
        setItems(res.data.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load menu');
      }
    });
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inline edit ──────────────────────────────────────────────────────────────

  function startEdit(item: MenuItem) {
    setEditing((prev) => ({ ...prev, [item.id]: { name: item.name, price: item.price } }));
  }

  function cancelEdit(id: number) {
    setEditing((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function handleSaveEdit(item: MenuItem) {
    const draft = editing[item.id];
    if (!draft) return;
    startSaveTransition(async () => {
      try {
        const res = await updateMenuItem(item.id, { name: draft.name, price: parseFloat(draft.price).toFixed(2) });
        setItems((prev) => prev.map((m) => (m.id === item.id ? res.data : m)));
        cancelEdit(item.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  // ── Archive (delete) ─────────────────────────────────────────────────────────

  async function handleDelete(item: MenuItem) {
    if (!confirm(`Archive "${item.name}"? It will no longer appear on the menu.`)) return;
    setDeletingId(item.id);
    try {
      await deleteMenuItem(item.id);
      setItems((prev) => prev.filter((m) => m.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to archive item');
    } finally {
      setDeletingId(null);
    }
  }

  // ── In-stock toggle ───────────────────────────────────────────────────────────

  function toggleInStock(item: MenuItem) {
    startSaveTransition(async () => {
      try {
        const res = await updateMenuItem(item.id, { in_stock: !item.inStock });
        setItems((prev) => prev.map((m) => (m.id === item.id ? res.data : m)));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Update failed');
      }
    });
  }

  // ── Add new item ─────────────────────────────────────────────────────────────

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setNewError('');
    if (isNaN(parseFloat(newPrice)) || parseFloat(newPrice) < 0) {
      setNewError('Enter a valid price.');
      return;
    }
    startNewTransition(async () => {
      try {
        const res = await createMenuItem({
          name: newName.trim(),
          price: parseFloat(newPrice).toFixed(2),
          in_stock: newInStock,
        });
        setItems((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
        setNewName('');
        setNewPrice('');
        setNewInStock(true);
      } catch (e) {
        setNewError(e instanceof Error ? e.message : 'Failed to create item');
      }
    });
  }

  const inStockCount = items.filter((m) => m.inStock).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Menu</h1>
          {items.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {inStockCount} in stock · {items.length - inStockCount} out of stock
            </p>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* ── Add new item form ── */}
      <form
        onSubmit={handleCreate}
        className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Add new item</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Name *</label>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Jollof Rice"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Price (₦)*</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex flex-col justify-end">
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newInStock}
                onChange={(e) => setNewInStock(e.target.checked)}
                className="rounded border-gray-300"
              />
              In stock
            </label>
            <button
              type="submit"
              disabled={newPending}
              className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {newPending ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </div>
        {newError && <p className="mt-2 text-xs text-red-600">{newError}</p>}
      </form>

      {/* ── Items table ── */}
      {items.length === 0 && !loadPending ? (
        <p className="text-sm text-gray-400">No menu items yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Price</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const isEditing = !!editing[item.id];
                const draft = editing[item.id];
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${!item.inStock ? 'opacity-60' : ''}`}>
                    {/* Name */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={draft.name}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], name: e.target.value },
                            }))
                          }
                          className="rounded border border-orange-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      ) : (
                        <span className="font-medium text-gray-900">{item.name}</span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">₦</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.price}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], price: e.target.value },
                              }))
                            }
                            className="w-28 rounded border border-orange-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                      ) : (
                        <span className="text-gray-700">₦{item.price}</span>
                      )}
                    </td>

                    {/* In-stock toggle */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleInStock(item)}
                        disabled={savePending}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                          item.inStock
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${item.inStock ? 'bg-green-500' : 'bg-gray-400'}`}
                        />
                        {item.inStock ? 'In stock' : 'Out of stock'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item)}
                            disabled={savePending}
                            className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelEdit(item.id)}
                            className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="text-xs text-orange-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            disabled={deletingId === item.id}
                            className="text-xs text-red-500 hover:underline disabled:opacity-50"
                          >
                            {deletingId === item.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
