'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { searchCustomers, getCustomerLedger, scheduleManualReminder, type Customer, type Credit } from '@/lib/api';

export default function ManualReminderPage() {
  const router = useRouter();
  const [customerQuery, setCustomerQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [creditId, setCreditId] = useState('');
  const [runAt, setRunAt] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function searchDebounced(q: string) {
    setCustomerQuery(q);
    setSelectedCustomer(null);
    setCredits([]);
    setCreditId('');
    if (!q.trim()) { setSuggestions([]); return; }
    searchCustomers(q, 1, 5)
      .then((res) => setSuggestions(res.data.items))
      .catch(() => {});
  }

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustomerQuery(c.name);
    setSuggestions([]);
    getCustomerLedger(c.id)
      .then((res) => {
        const active = res.data.credits.filter((cr) => cr.status === 'ACTIVE');
        setCredits(active);
        if (active.length === 1) setCreditId(active[0].id);
      })
      .catch(() => {});
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!creditId) { setError('Select a credit.'); return; }
    if (!runAt) { setError('Set the send date/time.'); return; }

    startTransition(async () => {
      try {
        await scheduleManualReminder({ credit_id: creditId, run_at: new Date(runAt).toISOString() });
        router.push('/scheduled-jobs');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to schedule reminder');
      }
    });
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">Manual Reminder</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Customer */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">Customer</label>
          <div className="relative">
            <input
              value={customerQuery}
              onChange={(e) => searchDebounced(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                {suggestions.map((c) => (
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
        </div>

        {/* Credit */}
        {selectedCustomer && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Active credit</label>
            {credits.length === 0 ? (
              <p className="text-sm text-gray-400">No active credits for this customer.</p>
            ) : (
              <select
                value={creditId}
                onChange={(e) => setCreditId(e.target.value)}
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Select a credit…</option>
                {credits.map((c) => (
                  <option key={c.id} value={c.id}>
                    ₦{c.balance} — due {new Date(c.dueDate).toLocaleDateString('en-NG')}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Date/time */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Send at (WAT)
          </label>
          <input
            type="datetime-local"
            required
            value={runAt}
            onChange={(e) => setRunAt(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending || !creditId}
            className="rounded-md bg-orange-500 px-6 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {isPending ? 'Scheduling…' : 'Schedule Reminder'}
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
    </div>
  );
}
