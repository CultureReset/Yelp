import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { SectionScaffold } from '@/components/section-scaffold';

export const metadata: Metadata = { title: 'Programs' };

export default async function Page() {
  // Route guard: this section declares the permission it needs.
  await requirePermission('ads.read');

  return (
    <SectionScaffold
      title={'Programs'}
      purpose={'Advertising, profile upgrades, and growth tools.'}
      note={'Every paid program needs four things: a clear price, a clear cancellation path, a clear performance report, and a receipt. Missing any one produces chargebacks.'}
      slots={[
        {
                "name": "Campaign builder",
                "status": "planned",
                "detail": "Objective, budget, bid strategy, geo and keyword targeting with negatives, dayparting, creative, and CTA.",
                "fields": [
                        "objective",
                        "budget_cents",
                        "geo_radius_mi",
                        "keyword_targets"
                ]
        },
        {
                "name": "Budget pacing",
                "status": "planned",
                "detail": "Spent to date, projected, and days remaining. Owners cancel when a bill surprises them.",
                "fields": [
                        "spend_cents",
                        "budget_cents"
                ]
        },
        {
                "name": "Campaign report",
                "status": "planned",
                "detail": "Impressions, clicks, CTR, average CPC, spend, leads, and cost per lead at daily granularity.",
                "fields": [
                        "impressions",
                        "clicks",
                        "leads",
                        "spend_cents"
                ]
        },
        {
                "name": "Profile upgrades",
                "status": "planned",
                "detail": "Call-to-action button, photo slideshow, logo, and business highlights.",
                "fields": [
                        "entitlements.feature"
                ]
        },
        {
                "name": "Remove competitor ads",
                "status": "planned",
                "detail": "A subscription that clears competitor placements from your page.",
                "fields": [
                        "kind=remove_competitor_ads"
                ]
        },
        {
                "name": "Deals & gift certificates",
                "status": "planned",
                "detail": "Face value and promotional value tracked separately, because face value legally cannot expire in many states.",
                "fields": [
                        "face_value_cents",
                        "promo_value_cents"
                ]
        },
        {
                "name": "Reservations & waitlist",
                "status": "planned",
                "detail": "Table inventory, party sizes, seating duration, guest notifications, and no-show tracking.",
                "fields": [
                        "kind=reservations"
                ]
        },
        {
                "name": "Appointments",
                "status": "planned",
                "detail": "Bookable services, staff calendars, availability rules, buffers, deposits, and reminders.",
                "fields": [
                        "kind=appointments"
                ]
        },
        {
                "name": "Job postings",
                "status": "planned",
                "detail": "Role, description, pay band, and an applications inbox.",
                "fields": [
                        "kind=job_postings"
                ]
        }
]}
    />
  );
}
