import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/guard';
import { can, ROLE_LABELS, ROLE_DESCRIPTIONS, MFA_REQUIRED_ROLES, type Role } from '@/lib/permissions';
import { db } from '@/db/client';
import {
  sessions, memberships, users, authCredentials, organizations, invitations,
} from '@/db/schema';
import { eq, and, isNull, desc, gt } from 'drizzle-orm';
import { listBusinesses } from '@/lib/business/context';
import { Card, Badge, Button, Alert, EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'Settings' };

function ago(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 2) return 'active now';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export default async function SettingsPage() {
  const ctx = await requireAuth();

  const [me] = await db.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
  const [org] = await db.select().from(organizations).where(eq(organizations.id, ctx.orgId)).limit(1);

  const [activeSessions, creds, team, pendingInvites, locations] = await Promise.all([
    db.select().from(sessions)
      .where(and(
        eq(sessions.userId, ctx.userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ))
      .orderBy(desc(sessions.lastSeenAt)),
    db.select().from(authCredentials).where(eq(authCredentials.userId, ctx.userId)),
    db.select({
      membership: memberships,
      user: { id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email },
    })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, ctx.orgId)),
    db.select().from(invitations)
      .where(and(
        eq(invitations.orgId, ctx.orgId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      )),
    listBusinesses(ctx),
  ]);

  const hasMfa = creds.some((c) => c.kind === 'totp' || c.kind === 'webauthn');
  const mfaRequired = MFA_REQUIRED_ROLES.has(ctx.role);
  const canManageUsers = can(ctx, 'users.write');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Settings</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-500">
          Your account, your team, and your organization.
        </p>
      </header>

      <Card title="Your profile" action={<Button size="sm" variant="secondary" disabled>Edit</Button>}>
        <dl className="divide-y divide-ink-100">
          {[
            ['Name', `${me.firstName} ${me.lastName}`],
            ['Email', me.emailRaw],
            ['Phone', me.phone ?? 'Not set'],
            ['Language', me.locale],
            ['Time zone', me.timezone],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
              <dt className="text-[13px] text-ink-500">{label}</dt>
              <dd className="text-[13.5px] text-ink-900">
                {value}
                {label === 'Email' && (
                  me.emailVerifiedAt
                    ? <Badge tone="good"> ✓ Verified</Badge>
                    : <Badge tone="warn"> Unverified</Badge>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-ink-100 pt-3 text-[12.5px] text-ink-500">
          Changing your email sends a confirmation to the new address. The change
          does not take effect until you click it.
        </p>
      </Card>

      <Card title="Security">
        {mfaRequired && !hasMfa && (
          <div className="mb-4">
            <Alert tone="warn" title="Two-factor authentication is required for your role">
              As {ROLE_LABELS[ctx.role]} you can reach billing or user management,
              which is where account takeover does real damage. Set up an
              authenticator app or a passkey.
            </Alert>
          </div>
        )}

        <dl className="divide-y divide-ink-100">
          <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
            <div>
              <dt className="text-[13.5px] font-medium text-ink-900">Password</dt>
              <dd className="text-[12.5px] text-ink-500">
                Changing it signs out every other device.
              </dd>
            </div>
            <Button size="sm" variant="secondary" disabled>Change</Button>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <dt className="text-[13.5px] font-medium text-ink-900">
                Authenticator app{' '}
                {hasMfa ? <Badge tone="good">On</Badge> : <Badge tone="warn">Off</Badge>}
              </dt>
              <dd className="text-[12.5px] text-ink-500">
                A six-digit code from an app on your phone.
              </dd>
            </div>
            <Button size="sm" variant="secondary" disabled>{hasMfa ? 'Manage' : 'Set up'}</Button>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5 last:pb-0">
            <div>
              <dt className="text-[13.5px] font-medium text-ink-900">Passkey</dt>
              <dd className="text-[12.5px] text-ink-500">
                Sign in with your fingerprint, face, or device PIN.
              </dd>
            </div>
            <Button size="sm" variant="secondary" disabled>Add passkey</Button>
          </div>
        </dl>
      </Card>

      <Card
        title="Where you are signed in"
        description="Revoking a session signs that device out immediately."
        action={<Button size="sm" variant="danger" disabled>Sign out everywhere</Button>}
      >
        <ul className="divide-y divide-ink-100">
          {activeSessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink-900">
                  {s.userAgent?.includes('Mobile') ? 'Mobile browser' : 'Desktop browser'}
                  {s.id === ctx.sessionId && <Badge tone="brand">This device</Badge>}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-500">
                  {s.ip ?? 'Unknown IP'} &middot; {ago(s.lastSeenAt)}
                </p>
              </div>
              {s.id !== ctx.sessionId && (
                <Button size="sm" variant="ghost" disabled>Revoke</Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card
        id="users"
        title="Users & permissions"
        description={`${team.length} ${team.length === 1 ? 'person has' : 'people have'} access to ${org.name}.`}
        action={canManageUsers
          ? <Button size="sm" variant="secondary" disabled>Invite someone</Button>
          : <Badge tone="neutral">View only</Badge>}
      >
        <ul className="divide-y divide-ink-100">
          {team.map(({ membership, user }) => {
            const role = membership.role as Role;
            const scoped = membership.locationScope?.length;
            return (
              <li key={membership.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink-900">
                    {user.firstName} {user.lastName}
                    {user.id === ctx.userId && <span className="text-ink-400"> (you)</span>}
                  </p>
                  <p className="text-[12.5px] text-ink-500">{user.email}</p>
                  <p className="mt-1 text-[12.5px] text-ink-500">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>
                <div className="shrink-0 space-y-1 text-right">
                  <Badge tone={role === 'owner' ? 'brand' : 'neutral'}>{ROLE_LABELS[role]}</Badge>
                  <p className="text-[12px] text-ink-500">
                    {scoped ? `${scoped} location${scoped === 1 ? '' : 's'}` : 'All locations'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {pendingInvites.length > 0 && (
          <div className="mt-3 border-t border-ink-100 pt-3">
            <p className="text-[12.5px] font-medium text-ink-700">
              {pendingInvites.length} invitation{pendingInvites.length === 1 ? '' : 's'} not yet accepted
            </p>
          </div>
        )}

        <p className="mt-3 border-t border-ink-100 pt-3 text-[12.5px] text-ink-500">
          Removing someone revokes their sessions immediately and cancels any
          invitations they have outstanding.
        </p>
      </Card>

      <Card
        id="locations"
        title="Locations"
        description={`${locations.length} in ${org.name}.`}
        action={can(ctx, 'org.locations')
          ? <Button size="sm" variant="secondary" disabled>Add location</Button>
          : null}
      >
        {locations.length === 0 ? (
          <EmptyState title="No locations" description="Claim a business to get started." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {locations.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-[13.5px] font-medium text-ink-900">{b.name}</p>
                  <p className="text-[12.5px] text-ink-500">
                    {b.city}{b.state ? `, ${b.state}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {b.claimStatus === 'claimed' && <Badge tone="good">✓ Claimed</Badge>}
                  <Badge tone="neutral">{b.reviewCount} reviews</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="notifications" title="Notifications" description="These are per person, not per business.">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-ink-200 text-[11.5px] uppercase tracking-wider text-ink-500">
                <th className="py-2 text-left font-semibold">Tell me about</th>
                <th className="py-2 text-center font-semibold">Email</th>
                <th className="py-2 text-center font-semibold">Push</th>
                <th className="py-2 text-center font-semibold">SMS</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['A new review', true, true, false],
                ['A review of 3 stars or fewer', true, true, true],
                ['A new message or quote request', true, true, true],
                ['A lead I have not answered', true, true, false],
                ['A customer photo', false, true, false],
                ['Ad budget spent', true, false, false],
                ['A payment problem', true, true, true],
                ['A moderation decision', true, false, false],
                ['Weekly summary', true, false, false],
              ].map(([label, email, push, sms]) => (
                <tr key={label as string} className="border-b border-ink-100 last:border-0">
                  <td className="py-2.5 text-ink-800">{label}</td>
                  {[email, push, sms].map((on, i) => (
                    <td key={i} className="py-2.5 text-center">
                      <input type="checkbox" defaultChecked={on as boolean} disabled
                             aria-label={`${label} notification`}
                             className="h-4 w-4 accent-brand-700" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Data & privacy">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-medium text-ink-900">Export your data</p>
              <p className="text-[12.5px] text-ink-500">
                Everything we hold about you and your business, as files.
              </p>
            </div>
            <Button size="sm" variant="secondary" disabled>Request export</Button>
          </div>
          {can(ctx, 'org.close') && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
              <div>
                <p className="text-[13.5px] font-medium text-ink-900">Close this account</p>
                <p className="text-[12.5px] text-ink-500">
                  Your listing does not disappear. It reverts to unclaimed, and
                  someone else could claim it later.
                </p>
              </div>
              <Button size="sm" variant="danger" disabled>Close account</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
