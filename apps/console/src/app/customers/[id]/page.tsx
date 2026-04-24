'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getCustomerLedger, type CustomerLedger } from '@/lib/api';

const CREDIT_STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-blue-100 text-blue-800',
  PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
  SETTLED: 'bg-green-100 text-green-800',
  DEFAULTED: 'bg-red-100 text-red-800',
};

const RISK_BADGE: Record<string, string> = {
  VIP: 'bg-purple-100 text-purple-800',
  SAFE: 'bg-green-100 text-green-800',
  RISK: 'bg-yellow-100 text-yellow-800',
  BANNED: 'bg-red-100 text-red-800',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
}

export default function CustomerLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCustomerLedger(id)
      .then((res) => setLedger(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load ledger'));
  }, [id]);

  function downloadCsv() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    window.open(`${apiUrl}/api/customers/${id}/ledger/export.csv`, '_blank');
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!ledger) return <p className="text-sm text-gray-400">Loading…</p>;

  const { customer, credits, transactions, running_balance } = ledger;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/customers" className="text-sm text-orange-600 hover:underline">
            ← Customers
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-gray-500">{customer.phone}{customer.email ? ` · ${customer.email}` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/sales/new?customer_id=${customer.id}`}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            + New Sale
          </Link>
          <button
            onClick={downloadCsv}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card label="Running Balance" value={`₦${running_balance}`} highlight />
        <Card label="Store Credit" value={`₦${customer.store_credit_balance}`} />
        <Card
          label="Risk"
          value={
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RISK_BADGE[customer.risk_segment] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {customer.risk_segment}
            </span>
          }
        />
        <Card label="Trust Score" value={String(customer.trust_score)} />
      </div>

      {/* Notification channel */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs text-gray-500">Notification channel</p>
        <p className="mt-0.5 text-sm font-medium text-gray-800">{customer.notif_channel ?? '—'}</p>
      </div>

      {/* Credits */}
      <Section title="Credits">
        {credits.length === 0 ? (
          <p className="text-sm text-gray-400">No credits on record.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Due date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Principal</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Balance</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Reminders sent</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {credits.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{fmt(c.dueDate)}</td>
                  <td className="px-4 py-3">₦{c.principal}</td>
                  <td className="px-4 py-3 font-medium">₦{c.balance}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CREDIT_STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.remindersSent}</td>
                  <td className="px-4 py-3 text-gray-400">{fmt(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Transactions */}
      <Section title="Transactions">
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400">No transactions on record.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Kind</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{fmt(t.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.kind === 'PAYMENT'
                          ? 'bg-green-100 text-green-800'
                          : t.kind === 'REFUND'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {t.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">₦{t.amount}</td>
                  <td className="px-4 py-3 text-gray-400">{t.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Card({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${highlight ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? 'text-orange-700' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
