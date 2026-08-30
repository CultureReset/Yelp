import type { Permission } from '@/lib/permissions';

export interface NavItem {
  href: string;
  label: string;
  permission: Permission;
  /** Rendered as a count chip when non-zero. */
  badgeKey?: 'unreadLeads' | 'unrepliedReviews' | 'pendingEdits';
}

/**
 * The ten dashboard sections. Each declares the permission it needs — a route
 * with no declared permission fails closed. See docs/04-dashboard-sections.md.
 */
export const NAV: NavItem[] = [
  { href: '/dashboard',            label: 'Home',            permission: 'business.read' },
  { href: '/dashboard/inbox',      label: 'Inbox',           permission: 'inbox.read',     badgeKey: 'unreadLeads' },
  { href: '/dashboard/reviews',    label: 'Reviews',         permission: 'business.read',  badgeKey: 'unrepliedReviews' },
  { href: '/dashboard/photos',     label: 'Photos',          permission: 'media.write' },
  { href: '/dashboard/business',   label: 'Business info',   permission: 'business.edit',  badgeKey: 'pendingEdits' },
  { href: '/dashboard/menu',       label: 'Menu & services', permission: 'menu.write' },
  { href: '/dashboard/programs',   label: 'Programs',        permission: 'ads.read' },
  { href: '/dashboard/analytics',  label: 'Analytics',       permission: 'analytics.read' },
  { href: '/dashboard/billing',    label: 'Billing',         permission: 'billing.read' },
  { href: '/dashboard/settings',   label: 'Settings',        permission: 'business.read' },
];
