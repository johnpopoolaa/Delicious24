'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { listAuditLogs, type AuditLog } from '@/lib/api';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isPending, startTransition] = useTransition();

  const TAKE = 50;

  const load = useCallback(
    (s: number) => {
      startTransition(async () => {
        setError('');
        try {
          const res = await listAuditLogs({ skip: s, take: TAKE });
          if (s === 0) {
            setItems(res.data.items);
          } else {
            setItems((prev) => [...prev, ...res.data.items]);
          }
          setHasMore(res.data.items.length === TAKE);
          setSkip(s);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to load audit log');
        }
      });
    },
    [],
  );

  useEffect(() => { load(0); }, [load]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Audit Log</h1>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {items.length === 0 && !isPending && (
        <p className="text-sm text-gray-400">No audit log entries.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Target</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-400">{fmt(entry.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{entry.actor}</td>
                    <td className="px-4 py-3 text-gray-700">{entry.action}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {entry.targetTable}
                      {entry.targetId && (
                        <span className="ml-1 font-mono text-xs text-gray-400">
                          {entry.targetId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                      {expanded === entry.id ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expanded === entry.id && (
                    <tr key={`${entry.id}-payload`} className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-3 text-xs text-gray-700">
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => load(skip + TAKE)}
          disabled={isPending}
          className="mt-4 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          {isPending ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
