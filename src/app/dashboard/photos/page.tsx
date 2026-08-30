import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { SectionScaffold } from '@/components/section-scaffold';

export const metadata: Metadata = { title: 'Photos & Videos' };

export default async function Page() {
  // Route guard: this section declares the permission it needs.
  await requirePermission('business.read');

  return (
    <SectionScaffold
      title={'Photos & Videos'}
      purpose={'Your media and customer media, governed by different rules and never visually merged.'}
      note={"EXIF is stripped on upload. A photo taken at the owner's home leaks their home address otherwise."}
      slots={[
        {
                "name": "Owner media grid",
                "status": "next",
                "detail": "Drag to reorder, set a cover photo, bulk select and tag.",
                "fields": [
                        "sort_order",
                        "is_cover",
                        "tags"
                ]
        },
        {
                "name": "Customer media grid",
                "status": "next",
                "detail": "Separate tab. Report only \u2014 customer photos cannot be deleted by the business.",
                "fields": [
                        "source=consumer"
                ]
        },
        {
                "name": "Upload",
                "status": "next",
                "detail": "Drag-drop, multi-file, progress, client-side downscale, EXIF strip, format and size validation.",
                "fields": [
                        "storage_key",
                        "bytes",
                        "width",
                        "height"
                ]
        },
        {
                "name": "Per-item editor",
                "status": "planned",
                "detail": "Caption, category tags, and alt text for accessibility and search.",
                "fields": [
                        "caption",
                        "alt_text",
                        "tags"
                ]
        },
        {
                "name": "Video",
                "status": "planned",
                "detail": "Length cap, transcode ladder, poster-frame selection, caption upload.",
                "fields": [
                        "duration_ms",
                        "kind=video"
                ]
        },
        {
                "name": "Moderation state",
                "status": "planned",
                "detail": "In review, approved, or rejected with the reason shown.",
                "fields": [
                        "moderation_status",
                        "moderation_reason"
                ]
        },
        {
                "name": "Portfolio projects",
                "status": "planned",
                "detail": "Named projects with before/after sets, cost band, duration, and location.",
                "fields": [
                        "before_keys",
                        "after_keys",
                        "cost_low_cents"
                ]
        }
]}
    />
  );
}
