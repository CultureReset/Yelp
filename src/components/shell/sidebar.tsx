'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { NavItem } from '@/lib/nav';

export function Sidebar({
  items, counts, onNavigate,
}: {
  items: NavItem[];
  counts: Record<string, number>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard sections" className="p-3">
      <ul className="space-y-0.5">
        {items.map((item) => {
          // '/dashboard' must not match every child route.
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
          const count = item.badgeKey ? counts[item.badgeKey] ?? 0 : 0;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-[13.5px] transition-colors',
                  active
                    ? 'bg-brand-50 font-semibold text-brand-800'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                )}
              >
                <span>{item.label}</span>
                {count > 0 && (
                  <span className={clsx(
                    'tnum min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold',
                    active ? 'bg-brand-700 text-white' : 'bg-ink-200 text-ink-700',
                  )}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
