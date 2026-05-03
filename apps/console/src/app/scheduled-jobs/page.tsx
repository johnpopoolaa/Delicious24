'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { listScheduledJobs, cancelJob, sendJobNow, type ScheduledJob, type ScheduledJobStatus } from '@/lib/api';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-blue-100 text-blue-800',
  RUNNING: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const TYPE_BADGE: Record<string, string> = {
  COURTESY: 'bg-sky-100 text-sky-700',
  URGENT: 'bg-orange-100 text-orange-700',
  OVERDUE: 'bg-red-100 text-red-700',
  MANUAL: 'bg-purple-100 text-purple-700',
  APPRECIATION: 'bg-green-100 text-green-700',
};

export default function ScheduledJobsPage() {
  const [statusFilter, setStatusFilter] = useState<ScheduledJobStatus | ''>('');
  const [items, setItems] = useState<ScheduledJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionLoading, setActionLoading] = useState<Record<string, 'cancel' | 'send'>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const LIMIT = 30;

  const load = useCallback(
    (p: number) => {
      startTransition(async () => {
        setError('');
        try {
          const res = await listScheduledJobs({
            status: statusFilter || undefined,
            skip: (p - 1) * LIMIT,
            take: LIMIT,
          });
          setItems(res.data.items);
          setTotal(res.data.items.length < LIMIT && p === 1 ? res.data.items.length : (p - 1) * LIMIT + res.data.items.length);
          setPage(p);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to load jobs');
        }
      });
    },
    [statusFilter],
  );

  useEffect(() => { load(1); }, [load]);

  async function handleCancel(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Cancel this scheduled job?')) return;
    setActionLoading((prev) => ({ ...prev, [id]: 'cancel' }));
    setActionError((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      await cancelJob(id);
      load(page);
    } catch (err) {
      setActionError((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Failed' }));
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function handleSendNow(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('Send this reminder now?')) return;
    setActionLoading((prev) => ({ ...prev, [id]: 'send' }));
    setActionError((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      await sendJobNow(id);
      load(page);
    } catch (err) {
      setActionError((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Failed' }));
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const failedCount = items.filter((j) => j.status === 'FAILED').length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Scheduled Jobs</h1>
        <div className="flex items-center gap-3">
          {failedCount > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              {failedCount} failed on this page
            </span>
          )}
          <Link
            href="/scheduled-jobs/manual"
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            + Manual Reminder
          </Link>
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as (ScheduledJobStatus | '')[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md border px-3 py-1 text-sm font-medium ${
              statusFilter === s
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <p className="mb-3 text-sm text-gray-500">{total} job{total === 1 ? '' : 's'}</p>

      {items.length === 0 && !isPending && (
        <p className="text-sm text-gray-400">No jobs match this filter.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Run at</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Attempts</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Job key</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((j) => (
                <>
                  <tr
                    key={j.id}
                    onClick={() => setExpanded(expanded === j.id ? null : j.id)}
                    className={`cursor-pointer hover:bg-gray-50 ${j.status === 'FAILED' ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[j.type] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {j.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[j.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmt(j.runAt)}</td>
                    <td className="px-4 py-3 text-gray-500">{j.attempts}</td>
                    <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-gray-400" title={j.jobKey}>
                      {j.jobKey}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {(j.status === 'PENDING' || j.status === 'FAILED') && (
                          <button
                            onClick={(e) => handleSendNow(e, j.id)}
                            disabled={!!actionLoading[j.id]}
                            className="rounded bg-orange-500 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            {actionLoading[j.id] === 'send' ? '...' : 'Send Now'}
                          </button>
                        )}
                        {(j.status === 'PENDING' || j.status === 'RUNNING') && (
                          <button
                            onClick={(e) => handleCancel(e, j.id)}
                            disabled={!!actionLoading[j.id]}
                            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {actionLoading[j.id] === 'cancel' ? '...' : 'Cancel'}
                          </button>
                        )}
                        {actionError[j.id] && (
                          <span className="text-xs text-red-500">{actionError[j.id]}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === j.id && j.lastError && (
                    <tr key={`${j.id}-err`} className="bg-red-50">
                      <td colSpan={6} className="px-4 py-3">
                        <p className="text-xs font-medium text-red-700">Last error:</p>
                        <pre className="mt-1 whitespace-pre-wrap text-xs text-red-600">{j.lastError}</pre>
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
