import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { SectionScaffold } from '@/components/section-scaffold';

export const metadata: Metadata = { title: 'Billing' };

export default async function Page() {
  // Route guard: this section declares the permission it needs.
  await requirePermission('billing.read');

  return (
    <SectionScaffold
      title={'Billing'}
      purpose={'Balance, payment methods, invoices, and cancellation.'}
      note={'Cancellation is self-serve, shows the effective date and prorated math before you confirm, and sends a confirmation email. Dark patterns here draw regulatory attention.'}
      slots={[
        {
                "name": "Balance & next charge",
                "status": "planned",
                "detail": "Current balance, next charge date, and exactly what will be charged.",
                "fields": [
                        "spend_ledger"
                ]
        },
        {
                "name": "Payment methods",
                "status": "planned",
                "detail": "Add, remove, set default. Card and ACH with SCA. Expiry warnings at 30 and 7 days.",
                "fields": [
                        "payment_methods.last4",
                        "exp_month"
                ]
        },
        {
                "name": "Invoice history",
                "status": "planned",
                "detail": "Downloadable PDF with per-program and per-location line items, taxes broken out, credits visible.",
                "fields": [
                        "invoices",
                        "invoice_lines"
                ]
        },
        {
                "name": "Consolidated statements",
                "status": "planned",
                "detail": "Multi-location billing rolled up, or split per location."
        },
        {
                "name": "Spend controls",
                "status": "planned",
                "detail": "Monthly cap and alert thresholds."
        },
        {
                "name": "Dunning",
                "status": "planned",
                "detail": "Retry on backoff, grace period during which ads keep running, then pause rather than cancel.",
                "fields": [
                        "attempt_count"
                ]
        },
        {
                "name": "Cancellation",
                "status": "planned",
                "detail": "What stops and when, prorated amounts shown before confirming, one skippable retention offer.",
                "fields": [
                        "cancel_effective_at"
                ]
        },
        {
                "name": "Tax & payout documents",
                "status": "planned",
                "detail": "Tax forms, and W-9/payout details where the platform pays the business."
        }
]}
    />
  );
}
