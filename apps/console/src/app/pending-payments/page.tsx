'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  listPendingCandidates,
  confirmPayment,
  updatePendingCandidate,
  type PendingPaymentCandidate,
  type PendingCandidateStatus,
} from '@/lib/api';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
}

const STATUS_BADGE: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  REVIEWED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function PendingPaymentsPage() {
  const [filter, setFilter] = useState<PendingCandidateStatus | ''>('NEW');
  const [items, setItems] = useState<PendingPaymentCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isConfirming, startConfirmTransition] = useTransition();

  const LIMIT = 20;

  const load = useCallback(
    (p: number) => {
      startTransition(async () => {
        setError('');
        try {
          const res = await listPendingCandidates(filter || undefined, p, LIMIT);
          setItems(res.data.items);
          setTotal(res.data.total);
          setPage(p);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
      });
    },
    [filter],
  );

  useEffect(() => { load(1); }, [load]);

  function openConfirm(candidate: PendingPaymentCandidate) {
    setConfirmId(candidate.id);
    setConfirmAmount(candidate.parsedAmount ?? '');
    setConfirmNote('');
    setConfirmError('');
  }

  function handleConfirm(candidate: PendingPaymentCandidate) {
    const amount = parseFloat(confirmAmount);
    if (isNaN(amount) || amount <= 0) {
      setConfirmError('Enter a valid amount.');
      return;
    }
    if (!candidate.matchedCreditId) {
      setConfirmError('No matched credit — cannot confirm.');
      return;
    }
    setConfirmError('');
    startConfirmTransition(async () => {
      try {
        await confirmPayment({
          credit_id: candidate.matchedCreditId!,
          amount,
          note: confirmNote || undefined,
          idempotency_key: uuidv4(),
        });
        await updatePendingCandidate(candidate.id, { status: 'REVIEWED' });
        setConfirmId(null);
        load(page);
      } catch (e) {
        setConfirmError(e instanceof Error ? e.message : 'Confirm failed');
      }
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      try {
        await updatePendingCandidate(id, { status: 'REJECTED' });
        load(page);
      } catch {
        setError('Failed to reject candidate');
      }
    });
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Pending Payments</h1>

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        {(['', 'NEW', 'REVIEWED', 'REJECTED'] as (PendingCandidateStatus | '')[]).map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); }}
            className={`rounded-md border px-3 py-1 text-sm font-medium ${
              filter === s
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <p className="mb-3 text-sm text-gray-500">{total} record{total === 1 ? '' : 's'}</p>

      {items.length === 0 && !isPending && (
        <p className="text-sm text-gray-400">No pending payment candidates.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Received</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">From</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Parsed amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Raw text</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <>
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{fmt(c.createdAt)}</td>
                    <td className="px-4 py-3">{c.fromPhone}</td>
                    <td className="px-4 py-3 font-medium">
                      {c.parsedAmount ? `₦${c.parsedAmount}` : '—'}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-400" title={c.rawText}>
                      {c.rawText}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === 'NEW' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openConfirm(c)}
                            className="rounded bg-green-500 px-3 py-1 text-xs font-medium text-white hover:bg-green-600"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleReject(c.id)}
                            disabled={isPending}
                            className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {confirmId === c.id && (
                    <tr key={`${c.id}-confirm`} className="bg-green-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700">Amount (₦) *</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={confirmAmount}
                              onChange={(e) => setConfirmAmount(e.target.value)}
                              className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700">Note</label>
                            <input
                              value={confirmNote}
                              onChange={(e) => setConfirmNote(e.target.value)}
                              className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                            />
                          </div>
                          <button
                            onClick={() => handleConfirm(c)}
                            disabled={isConfirming}
                            className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {isConfirming ? 'Confirming…' : 'Confirm Payment'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="rounded border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          {confirmError && (
                            <p className="w-full text-xs text-red-600">{confirmError}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1 || isPending}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => load(page + 1)}
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
