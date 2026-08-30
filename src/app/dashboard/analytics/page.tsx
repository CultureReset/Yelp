import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { SectionScaffold } from '@/components/section-scaffold';

export const metadata: Metadata = { title: 'Analytics' };

export default async function Page() {
  // Route guard: this section declares the permission it needs.
  await requirePermission('analytics.read');

  return (
    <SectionScaffold
      title={'Analytics'}
      purpose={'Reads pre-aggregated daily rollups only. A page load never scans raw events.'}
      note={'Every metric shows its definition and window, and every panel shows data freshness. Unexplained analytics lag generates support tickets.'}
      slots={[
        {
                "name": "Date range & comparison",
                "status": "next",
                "detail": "Range picker with a comparison period, granularity, and location scope.",
                "fields": [
                        "from",
                        "to",
                        "granularity"
                ]
        },
        {
                "name": "Page views",
                "status": "built",
                "detail": "Total, unique, by device, by surface, and by source.",
                "fields": [
                        "page_views",
                        "unique_visitors",
                        "source_breakdown"
                ]
        },
        {
                "name": "Customer actions",
                "status": "built",
                "detail": "Calls, directions, website clicks, messages, menu views, photo views, bookmarks, orders. Each with a conversion rate against page views.",
                "fields": [
                        "calls",
                        "directions",
                        "website_clicks",
                        "messages"
                ]
        },
        {
                "name": "Review trends",
                "status": "next",
                "detail": "Volume, average rating, and distribution over time.",
                "fields": [
                        "reviews.rating"
                ]
        },
        {
                "name": "Lead performance",
                "status": "planned",
                "detail": "Volume, response rate, response time, won/lost, and cost per lead when ads run.",
                "fields": [
                        "conversations.status"
                ]
        },
        {
                "name": "Ad performance",
                "status": "planned",
                "detail": "Reconciled nightly against the invoice. These two numbers must match.",
                "fields": [
                        "ad_spend_daily"
                ]
        },
        {
                "name": "Search terms",
                "status": "planned",
                "detail": "What customers searched before landing here. Aggregated and thresholded to avoid leaking competitive data.",
                "fields": [
                        "events.props"
                ]
        },
        {
                "name": "Benchmarks",
                "status": "planned",
                "detail": "Percentile bands against category and metro. Minimum cohort size enforced; competitors never named."
        },
        {
                "name": "Export & scheduled reports",
                "status": "planned",
                "detail": "Async CSV/XLSX generation delivered by expiring signed URL, plus weekly and monthly emails."
        },
        {
                "name": "Multi-location rollup",
                "status": "planned",
                "detail": "All locations in one sortable table with per-location drill-down."
        }
]}
    />
  );
}
