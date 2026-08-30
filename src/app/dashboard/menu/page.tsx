import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { SectionScaffold } from '@/components/section-scaffold';

export const metadata: Metadata = { title: 'Menu & Services' };

export default async function Page() {
  // Route guard: this section declares the permission it needs.
  await requirePermission('business.read');

  return (
    <SectionScaffold
      title={'Menu & Services'}
      purpose={'Your catalog. Three possible sources — manual, import, and partner feed — with a visible indicator of which is authoritative.'}
      note={"A POS sync must never silently revert an owner's manual edit overnight. The source field on every row is what prevents that."}
      slots={[
        {
                "name": "Services list",
                "status": "next",
                "detail": "Name, description, price or band, duration, category. Feeds quote-request matching.",
                "fields": [
                        "price_low_cents",
                        "price_unit",
                        "duration_min"
                ]
        },
        {
                "name": "Menu sections and items",
                "status": "next",
                "detail": "Sections containing items with photo, dietary tags, availability windows, and modifiers.",
                "fields": [
                        "section_id",
                        "price_cents",
                        "dietary_tags"
                ]
        },
        {
                "name": "Source authority",
                "status": "planned",
                "detail": "Shows which fields are partner-managed and therefore read-only here.",
                "fields": [
                        "source"
                ]
        },
        {
                "name": "Import",
                "status": "planned",
                "detail": "File or URL import with a mapping preview before anything is written.",
                "fields": [
                        "source=import"
                ]
        },
        {
                "name": "Popular items",
                "status": "planned",
                "detail": "Derived from consumer engagement, not owner-set.",
                "fields": [
                        "is_popular"
                ]
        },
        {
                "name": "Product catalog",
                "status": "planned",
                "detail": "SKU, price, availability, and images for retail businesses.",
                "fields": [
                        "sku"
                ]
        }
]}
    />
  );
}
