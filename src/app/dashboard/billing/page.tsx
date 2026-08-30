import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { can } from '@/lib/permissions';
import { db } from '@/db/client';
import {
  invoices, invoiceLines, paymentMethods, adSpendDaily, businesses,
} from '@/db/schema';
import { eq, and, gte, desc, inArray } from 'drizzle-orm';
import { listBusinesses } from '@/lib/business/context';
import { Card, EmptyState, Badge, Button, Alert } from '@/components/ui';

export const metadata: Metadata = { title: 'Billing' };

function money(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

const STATUS_TONE = {
  paid: 'good', open: 'warn', past_due: 'bad',
  draft: 'neutral', void: 'neutral', refunded: 'neutral',
} as const;

export default async function BillingPage() {
  // Billing is org-scoped, not location-scoped.
  const ctx = await requirePermission('billing.read');

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthKey = monthStart.toISOString().slice(0, 10);

  const orgBusinesses = await listBusinesses(ctx);
  const ids = orgBusinesses.map((b) => b.id);

  const [invs, methods, mtdSpend] = await Promise.all([
    db.select().from(invoices)
      .where(eq(invoices.orgId, ctx.orgId))
      .orderBy(desc(invoices.periodStart)).limit(12),
    db.select().from(paymentMethods)
      .where(eq(paymentMethods.orgId, ctx.orgId))
      .orderBy(desc(paymentMethods.isDefault)),
    ids.length
      ? db.select().from(adSpendDaily).where(and(
          inArray(adSpendDaily.businessId, ids),
          gte(adSpendDaily.day, monthKey),
        ))
      : Promise.resolve([]),
  ]);

  const lines = invs.length
    ? await db.select().from(invoiceLines)
        .where(inArray(invoiceLines.invoiceId, invs.map((i) => i.id)))
    : [];
  const linesByInvoice = new Map<string, typeof lines>();
  for (const l of lines) {
    const arr = linesByInvoice.get(l.invoiceId) ?? [];
    arr.push(l);
    linesByInvoice.set(l.invoiceId, arr);
  }

  const adSpendMtd = mtdSpend.reduce((a, r) => a + r.spendCents, 0);
  const openInvoice = invs.find((i) => i.status === 'open' || i.status === 'past_due');
  const defaultMethod = methods.find((m) => m.isDefault && !m.removedAt);

  const now = new Date();
  const expiringSoon = methods.filter((m) => {
    if (m.removedAt || !m.expMonth || !m.expYear) return false;
    const exp = new Date(m.expYear, m.expMonth, 0);
    const days = (exp.getTime() - now.getTime()) / 86_400_000;
    return days < 60;
  });

  const canWrite = can(ctx, 'billing.write');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Billing</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-500">
          {ctx.orgName}. Ad spend shown here is reconciled against your invoice
          every night &mdash; if the two ever disagree, the invoice is corrected,
          not the report.
        </p>
      </header>

      {expiringSoon.length > 0 && (
        <Alert tone="warn" title="A card is expiring soon">
          {expiringSoon.map((m) => `${m.brand} ending ${m.last4} expires ${m.expMonth}/${m.expYear}`).join('; ')}.
          Update it before your next charge so your programs keep running.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-[12.5px] text-ink-500">Ad spend this month</p>
          <p className="tnum mt-1 text-2xl font-bold text-ink-900">{money(adSpendMtd)}</p>
          <p className="mt-0.5 text-[12px] text-ink-500">Accrued to date, not yet invoiced</p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-ink-500">
            {openInvoice ? 'Amount due' : 'Balance'}
          </p>
          <p className="tnum mt-1 text-2xl font-bold text-ink-900">
            {openInvoice ? money(openInvoice.totalCents) : money(0)}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {openInvoice?.dueAt
              ? `Due ${openInvoice.dueAt.toLocaleDateString()}`
              : 'Nothing outstanding'}
          </p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-ink-500">Charging</p>
          <p className="mt-1 text-[15px] font-semibold text-ink-900">
            {defaultMethod ? `${defaultMethod.brand} •••• ${defaultMethod.last4}` : 'No card on file'}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {defaultMethod ? `Expires ${defaultMethod.expMonth}/${defaultMethod.expYear}` : 'Add one to keep programs running'}
          </p>
        </Card>
      </div>

      <Card
        title="Payment methods"
        description="Card details live at our payment processor. Nobody here can see a full number."
        action={canWrite
          ? <Button size="sm" variant="secondary" disabled>Add method</Button>
          : <Badge tone="neutral">View only</Badge>}
      >
        {methods.length === 0 ? (
          <EmptyState title="No payment methods" description="Add a card or bank account to run paid programs." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {methods.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="rounded border border-ink-200 px-2 py-1 text-[11px] font-semibold uppercase text-ink-600">
                    {m.brand}
                  </span>
                  <div>
                    <p className="tnum text-[13.5px] font-medium text-ink-900">
                      •••• •••• •••• {m.last4}
                    </p>
                    <p className="tnum text-[12.5px] text-ink-500">
                      Expires {String(m.expMonth).padStart(2, '0')}/{m.expYear}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.isDefault && <Badge tone="brand">Default</Badge>}
                  {canWrite && !m.isDefault && (
                    <Button size="sm" variant="ghost" disabled>Remove</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <p className="mt-3 border-t border-ink-100 pt-3 text-[12.5px] text-ink-500">
            Adding or removing a payment method asks for your password again,
            even if you just signed in.
          </p>
        )}
      </Card>

      <Card title="Invoices" description="Line items broken out by program and by location, with tax separated.">
        {invs.length === 0 ? (
          <EmptyState title="No invoices yet" description="Your first invoice arrives at the end of your first billing period." />
        ) : (
          <ul className="space-y-3">
            {invs.map((inv) => {
              const invLines = linesByInvoice.get(inv.id) ?? [];
              return (
                <li key={inv.id} className="rounded-md border border-ink-200 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="tnum text-[14px] font-semibold text-ink-900">{inv.number}</p>
                        <Badge tone={STATUS_TONE[inv.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                          {inv.status === 'past_due' ? 'Past due' : inv.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-ink-500">
                        {new Date(inv.periodStart).toLocaleDateString()} &ndash;{' '}
                        {new Date(inv.periodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum text-[16px] font-bold text-ink-900">{money(inv.totalCents)}</p>
                      <Button size="sm" variant="ghost" disabled>Download PDF</Button>
                    </div>
                  </div>

                  {invLines.length > 0 && (
                    <div className="mt-3 border-t border-ink-100 pt-3">
                      <ul className="space-y-1.5">
                        {invLines.map((l) => (
                          <li key={l.id} className="flex justify-between gap-3 text-[13px]">
                            <span className="text-ink-600">
                              {l.description}
                              {l.businessName && (
                                <span className="text-ink-400"> &middot; {l.businessName}</span>
                              )}
                            </span>
                            <span className="tnum shrink-0 text-ink-900">{money(l.amountCents)}</span>
                          </li>
                        ))}
                        <li className="flex justify-between gap-3 border-t border-ink-100 pt-1.5 text-[13px]">
                          <span className="text-ink-500">Sales tax</span>
                          <span className="tnum text-ink-900">{money(inv.taxCents)}</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Cancelling">
        <p className="text-[13.5px] text-ink-600">
          You can cancel any program from the Programs page. We show the
          effective date and the prorated amount before you confirm, and email
          you a receipt. Nothing is hidden behind a phone call.
        </p>
        <p className="mt-2 text-[13.5px] text-ink-600">
          Cancelling a paid program does not remove your business listing. It
          stays live, free, and claimed by you.
        </p>
      </Card>
    </div>
  );
}
