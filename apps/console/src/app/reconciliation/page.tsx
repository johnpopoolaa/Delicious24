'use client';

import { useState, useEffect, useTransition, useCallback, Fragment } from 'react';
import { listReconciliationTasks, resolveReconciliationTask, type ReconciliationTask, type ReconciliationTaskStatus } from '@/lib/api';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  RESOLVED: 'bg-green-100 text-green-700',
  DISMISSED: 'bg-gray-100 text-gray-500',
};

export default function ReconciliationPage() {
  const [filter, setFilter] = useState<ReconciliationTaskStatus | ''>('OPEN');
  const [items, setItems] = useState<ReconciliationTask[]>([]);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const load = useCallback(
    () => {
      startTransition(async () => {
        setError('');
        try {
          const res = await listReconciliationTasks(filter || undefined);
          setItems(res.data.items);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to load tasks');
        }
      });
    },
    [filter],
  );

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: string, status: 'RESOLVED' | 'DISMISSED') {
    const label = status === 'RESOLVED' ? 'resolve' : 'dismiss';
    if (!window.confirm(`Are you sure you want to ${label} this task?`)) return;
    setActionError((prev) => ({ ...prev, [id]: '' }));
    try {
      await resolveReconciliationTask(id, status);
      load();
    } catch (e) {
      setActionError((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : 'Action failed' }));
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Reconciliation Queue</h1>
      <p className="mb-4 text-sm text-gray-500">
        Financial conflicts created during offline sync. Review each task and resolve or dismiss.
      </p>

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        {(['', 'OPEN', 'RESOLVED', 'DISMISSED'] as (ReconciliationTaskStatus | '')[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
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

      {items.length === 0 && !isPending && (
        <p className="text-sm text-gray-400">No reconciliation tasks found.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Entity type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((task) => (
                <Fragment key={task.id}>
                  <tr
                    onClick={() => setExpanded(expanded === task.id ? null : task.id)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-400">{fmt(task.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{task.entityType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {task.clientId ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[task.status] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                      {expanded === task.id ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expanded === task.id && (
                    <tr key={`${task.id}-detail`} className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-3 text-xs text-gray-700">
                          {JSON.stringify(task.payload, null, 2)}
                        </pre>
                        {task.resolvedAt && (
                          <p className="mt-2 text-xs text-gray-400">
                            Resolved: {fmt(task.resolvedAt)}
                          </p>
                        )}
                        {task.status === 'OPEN' && (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleAction(task.id, 'RESOLVED'); }}
                              className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                            >
                              Mark Resolved
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleAction(task.id, 'DISMISSED'); }}
                              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                        {actionError[task.id] && (
                          <p className="mt-2 text-xs text-red-600">{actionError[task.id]}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
