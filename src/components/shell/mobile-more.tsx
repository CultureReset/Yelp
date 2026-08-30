'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { logoutAction } from '@/lib/auth/actions';
import type { NavItem } from '@/lib/nav';

/** Bottom sheet, the Android convention for a menu raised from a tab bar. */
export function MobileMore({
  open, onClose, items, counts, userName, orgName, roleLabel, publicHref,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  counts: Record<string, number>;
  userName: string;
  orgName: string;
  roleLabel: string;
  publicHref: string | null;
}) {
  const pathname = usePathname();

  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const primary = new Set(['/dashboard', '/dashboard/inbox', '/dashboard/reviews', '/dashboard/analytics']);
  const rest = items.filter((i) => !primary.has(i.href));

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More sections"
        className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sticky top-0 bg-white pt-2">
          <div aria-hidden="true" className="mx-auto h-1 w-9 rounded-full bg-ink-300" />
          <div className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-[14px] font-bold text-white"
            >
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink-900">{userName}</p>
              <p className="truncate text-[12.5px] text-ink-500">{roleLabel} · {orgName}</p>
            </div>
          </div>
        </div>

        <ul className="border-t border-ink-100">
          {rest.map((item) => {
            const active = pathname.startsWith(item.href);
            const count = item.badgeKey ? counts[item.badgeKey] ?? 0 : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={clsx(
                    'flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-[15px]',
                    active ? 'font-semibold text-brand-700' : 'text-ink-800',
                  )}
                >
                  {item.label}
                  {count > 0 && (
                    <span className="tnum rounded-full bg-ink-200 px-2 py-0.5 text-[12px] font-semibold text-ink-700">
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}

          {publicHref && (
            <li className="border-t border-ink-100">
              <a
                href={publicHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex min-h-12 items-center gap-2 px-4 py-3 text-[15px] text-ink-800"
              >
                View my public page
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M4.5 1.5h6v6M10.5 1.5L5 7M9 7.5v3h-8v-8h3"
                        stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                </svg>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          )}

          <li className="border-t border-ink-100">
            <form action={logoutAction}>
              <button type="submit" className="min-h-12 w-full px-4 py-3 text-left text-[15px] text-ink-800">
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </div>
    </div>
  );
}
