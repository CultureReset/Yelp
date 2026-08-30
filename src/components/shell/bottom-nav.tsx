'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { NavItem } from '@/lib/nav';

/**
 * Phone navigation. A hamburger at the top of a tall screen is the hardest
 * thing on the device to reach one-handed, so the sections owners use daily
 * live in a thumb-reachable bar at the bottom instead. Everything else stays
 * behind "More".
 *
 * Targets are 48px tall, which is the Android accessibility minimum.
 */
const ICONS: Record<string, React.ReactNode> = {
  '/dashboard': (
    <path d="M3 10.5L12 3l9 7.5M5.5 9.5V20h13V9.5" />
  ),
  '/dashboard/inbox': (
    <path d="M3 6.5h18v11H3zM3 7l9 6.5L21 7" />
  ),
  '/dashboard/reviews': (
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z" />
  ),
  '/dashboard/analytics': (
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  ),
  more: (
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  ),
};

export function BottomNav({
  items, counts, onMore, moreOpen,
}: {
  items: NavItem[];
  counts: Record<string, number>;
  onMore: () => void;
  moreOpen: boolean;
}) {
  const pathname = usePathname();

  // The four daily-use sections, filtered to what this role can reach.
  const primary = ['/dashboard', '/dashboard/inbox', '/dashboard/reviews', '/dashboard/analytics']
    .map((href) => items.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 4);

  return (
    <nav
      aria-label="Main sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {primary.map((item) => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
          const count = item.badgeKey ? counts[item.badgeKey] ?? 0 : 0;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active && !moreOpen ? 'page' : undefined}
                className={clsx(
                  'relative flex h-14 flex-col items-center justify-center gap-0.5',
                  active && !moreOpen ? 'text-brand-700' : 'text-ink-500',
                )}
              >
                <span className="relative">
                  <svg
                    width="21" height="21" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={active && !moreOpen ? 2.1 : 1.7}
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                  >
                    {ICONS[item.href]}
                  </svg>
                  {count > 0 && (
                    <span className="tnum absolute -right-2.5 -top-1.5 min-w-[16px] rounded-full bg-brand-700 px-1 text-center text-[10px] font-bold leading-4 text-white">
                      {count > 99 ? '99' : count}
                    </span>
                  )}
                </span>
                <span className={clsx('text-[10.5px]', active && !moreOpen && 'font-semibold')}>
                  {item.label.split(' ')[0]}
                </span>
                {count > 0 && <span className="sr-only">{count} needing attention</span>}
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={onMore}
            aria-expanded={moreOpen}
            className={clsx(
              'flex h-14 w-full flex-col items-center justify-center gap-0.5',
              moreOpen ? 'text-brand-700' : 'text-ink-500',
            )}
          >
            <svg
              width="21" height="21" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={moreOpen ? 3 : 2.4}
              strokeLinecap="round" aria-hidden="true"
            >
              {ICONS.more}
            </svg>
            <span className={clsx('text-[10.5px]', moreOpen && 'font-semibold')}>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
