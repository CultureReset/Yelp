'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { logoutAction } from '@/lib/auth/actions';
import { BottomNav } from './bottom-nav';
import { MobileMore } from './mobile-more';
import type { NavItem } from '@/lib/nav';

export interface BusinessOption {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

export function Topbar({
  businesses, activeBusiness, userName, orgName, roleLabel,
  navItems, counts, publicHref, notificationCount,
}: {
  businesses: BusinessOption[];
  activeBusiness: BusinessOption | null;
  userName: string;
  orgName: string;
  roleLabel: string;
  navItems: NavItem[];
  counts: Record<string, number>;
  publicHref: string | null;
  notificationCount: number;
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/dashboard" className="shrink-0 text-[15px] font-bold tracking-tight">
            <span className="text-brand-700">◆</span>
            <span className="ml-1 hidden sm:inline">Business</span>
          </Link>

          {/* Location switcher. Every screen respects this scope. */}
          {activeBusiness && (
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => { setSwitcherOpen((v) => !v); setMenuOpen(false); }}
                aria-expanded={switcherOpen}
                className="flex max-w-[240px] items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-[13px] hover:bg-ink-50"
              >
                <span className="truncate font-medium text-ink-900">{activeBusiness.name}</span>
                {businesses.length > 1 && (
                  <span className="hidden shrink-0 text-ink-400 sm:inline">
                    ({businesses.length})
                  </span>
                )}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0 text-ink-400">
                  <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              </button>

              {switcherOpen && (
                <div className="absolute left-0 top-full mt-1 w-72 rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    {orgName}
                  </p>
                  {businesses.map((b) => (
                    <form key={b.id} action={`/dashboard/switch/${b.id}`} method="post">
                      <button
                        type="submit"
                        className={clsx(
                          'block w-full px-3 py-2 text-left text-[13px] hover:bg-ink-50',
                          b.id === activeBusiness.id && 'bg-brand-50 font-semibold text-brand-800',
                        )}
                      >
                        <span className="block truncate">{b.name}</span>
                        {b.city && (
                          <span className="block truncate text-[12px] text-ink-500">
                            {b.city}{b.state ? `, ${b.state}` : ''}
                          </span>
                        )}
                      </button>
                    </form>
                  ))}
                  <div className="my-1 border-t border-ink-100" />
                  <Link href="/dashboard/settings/locations"
                        className="block px-3 py-2 text-[13px] text-ink-600 hover:bg-ink-50">
                    Manage locations
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            {/* The most common owner question is "how does this look to customers." */}
            {publicHref && (
              <a
                href={publicHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 sm:flex"
              >
                View my public page
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M4.5 1.5h6v6M10.5 1.5L5 7M9 7.5v3h-8v-8h3"
                        stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                </svg>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}

            <Link
              href="/dashboard/notifications"
              className="relative rounded-md p-2 text-ink-600 hover:bg-ink-100"
              aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
            >
              <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 2a5 5 0 00-5 5v3.5L3.5 13h13L15 10.5V7a5 5 0 00-5-5zM8 16a2 2 0 004 0"
                      stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
              </svg>
              {notificationCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" />
              )}
            </Link>

            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => { setMenuOpen((v) => !v); setSwitcherOpen(false); }}
                aria-expanded={menuOpen}
                className="hidden items-center gap-2 rounded-md p-1 pr-2 hover:bg-ink-100 lg:flex"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-white">
                  {userName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-[13px] font-medium text-ink-800 md:inline">{userName}</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-ink-100 px-3 py-2">
                    <p className="truncate text-[13px] font-semibold text-ink-900">{userName}</p>
                    <p className="truncate text-[12px] text-ink-500">{roleLabel} · {orgName}</p>
                  </div>
                  {[
                    ['/dashboard/settings/profile', 'Your profile'],
                    ['/dashboard/settings/security', 'Security'],
                    ['/dashboard/settings/users', 'Users & permissions'],
                    ['/dashboard/settings/notifications', 'Notifications'],
                    ['/help', 'Help'],
                  ].map(([href, label]) => (
                    <Link key={href} href={href}
                          className="block px-3 py-2 text-[13px] text-ink-600 hover:bg-ink-50">
                      {label}
                    </Link>
                  ))}
                  <div className="my-1 border-t border-ink-100" />
                  <form action={logoutAction}>
                    <button type="submit"
                            className="block w-full px-3 py-2 text-left text-[13px] text-ink-600 hover:bg-ink-50">
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <BottomNav
        items={navItems}
        counts={counts}
        moreOpen={moreOpen}
        onMore={() => setMoreOpen((v) => !v)}
      />

      <MobileMore
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={navItems}
        counts={counts}
        userName={userName}
        orgName={orgName}
        roleLabel={roleLabel}
        publicHref={publicHref}
      />
    </>
  );
}
