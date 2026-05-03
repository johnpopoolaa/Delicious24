'use client';

import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { searchCustomers, createCustomer, type Customer } from '@/lib/api';

const RISK_BADGE: Record<string, string> = {
  VIP: 'bg-purple-100 text-purple-800',
  SAFE: 'bg-green-100 text-green-800',
  PROBATION: 'bg-amber-100 text-amber-800',
  RISK: 'bg-yellow-100 text-yellow-800',
  BANNED: 'bg-red-100 text-red-800',
};

export default function CustomersPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  // New customer form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [formPending, startFormTransition] = useTransition();

  const LIMIT = 20;

  const runSearch = useCallback(
    (q: string, p: number) => {
      startTransition(async () => {
        setError('');
        try {
          const res = await searchCustomers(q, p, LIMIT);
          setResults(res.data.items);
          setTotal(res.data.total);
          setPage(p);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Search failed');
        }
      });
    },
    [],
  );

  // Load recent customers on mount, then debounce live search on query change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query, 1), query ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query, 1);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    startFormTransition(async () => {
      try {
        await createCustomer({ name: newName, phone: newPhone, email: newEmail || undefined });
        setShowForm(false);
        setNewName('');
        setNewPhone('');
        setNewEmail('');
        // Show the newly created customer by searching their phone (unique identifier)
        setQuery(newPhone);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to create customer');
      }
    });
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          + New Customer
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <h2 className="mb-4 text-base font-semibold">New customer</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Name *</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Phone *</label>
              <input
                required
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
          {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={formPending}
              className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {formPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or email…"
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {isPending ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <p className="mb-3 text-sm text-gray-500">
        {total === 0
          ? 'No customers found.'
          : query
          ? `${total} customer${total === 1 ? '' : 's'} found`
          : `${total} customer${total === 1 ? '' : 's'} — showing most recent`}
      </p>

      {results.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Risk</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Trust</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RISK_BADGE[c.riskSegment] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {c.riskSegment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.trustScore}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/customers/${c.id}`}
                      className="text-orange-600 hover:underline"
                    >
                      Ledger →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <button
            onClick={() => runSearch(query, page - 1)}
            disabled={page <= 1 || isPending}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => runSearch(query, page + 1)}
            disabled={page >= totalPages || isPending}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
