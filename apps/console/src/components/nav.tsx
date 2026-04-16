'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/customers', label: 'Customers' },
  { href: '/sales/new', label: 'New Sale' },
  { href: '/menu', label: 'Menu' },
  { href: '/pending-payments', label: 'Pending Payments' },
  { href: '/scheduled-jobs', label: 'Scheduled Jobs' },
  { href: '/audit', label: 'Audit Log' },
  { href: '/reconciliation', label: 'Reconciliation' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <span className="py-4 text-lg font-bold text-orange-600">Delicious24</span>
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`border-b-2 py-4 text-sm font-medium transition-colors ${
                active
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
