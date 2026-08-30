/**
 * Edit routing. Decides whether a proposed change publishes immediately or
 * queues for a human. Rules live here, not in the table.
 * See docs/09-trust-moderation.md.
 */

export type FieldClass = 'descriptive' | 'operational' | 'identity' | 'media';

const IDENTITY_FIELDS = new Set([
  'name', 'address1', 'address2', 'city', 'state', 'postalCode', 'country',
  'phone', 'website', 'lat', 'lng', 'categories',
]);

const OPERATIONAL_FIELDS = new Set([
  'hours', 'menuUrl', 'orderUrl', 'reservationUrl', 'bookingUrl', 'giftCardUrl',
  'priceTier', 'attributes', 'temporarilyClosedUntil', 'timezone', 'socials',
  'publicEmail',
]);

export function classifyFields(fields: string[]): FieldClass {
  if (fields.some((f) => IDENTITY_FIELDS.has(f))) return 'identity';
  if (fields.some((f) => OPERATIONAL_FIELDS.has(f))) return 'operational';
  return 'descriptive';
}

export interface RoutingDecision {
  status: 'auto_approved' | 'pending';
  reason: string;
  riskScore: number;
}

export interface RoutingInput {
  fieldClass: FieldClass;
  source: 'owner' | 'consumer' | 'partner' | 'internal';
  ownerVerified: boolean;
  /** Days since the listing was claimed, or since ownership last changed. */
  daysSinceClaim: number | null;
  patch: Record<string, unknown>;
}

export function routeEdit(input: RoutingInput): RoutingDecision {
  // Consumer corrections always get a human and always notify the owner.
  if (input.source === 'consumer') {
    return { status: 'pending', reason: 'Suggested by a customer, so a moderator reviews it.', riskScore: 0.5 };
  }

  // Identity fields are how account takeover becomes profitable.
  if (input.fieldClass === 'identity') {
    return {
      status: 'pending',
      reason: 'Business name, address, phone, website, and category changes are always reviewed by a person.',
      riskScore: 0.8,
    };
  }

  // A fresh claim gets extra scrutiny on everything for 30 days.
  if (input.daysSinceClaim !== null && input.daysSinceClaim < 30) {
    return {
      status: 'pending',
      reason: 'This business was claimed within the last 30 days, so changes are reviewed for now.',
      riskScore: 0.6,
    };
  }

  if (!input.ownerVerified) {
    return {
      status: 'pending',
      reason: 'Verify your email address to have changes publish immediately.',
      riskScore: 0.4,
    };
  }

  // Anomaly detection on operational edits — e.g. every day set to closed.
  if (input.fieldClass === 'operational') {
    const anomaly = detectAnomaly(input.patch);
    if (anomaly) return { status: 'pending', reason: anomaly, riskScore: 0.55 };
    return { status: 'auto_approved', reason: 'Published immediately.', riskScore: 0.1 };
  }

  return { status: 'auto_approved', reason: 'Published immediately.', riskScore: 0.05 };
}

function detectAnomaly(patch: Record<string, unknown>): string | null {
  const hours = patch.hours;
  if (Array.isArray(hours) && hours.length > 0) {
    const allClosed = hours.every((h) => (h as { isClosed?: boolean })?.isClosed);
    if (allClosed) {
      return 'Every day is set to closed. If you are closing temporarily, use the "Temporarily closed" status instead — a moderator will confirm this change.';
    }
  }
  return null;
}

/** Human-readable labels for the pending-edit list. */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Business name',
  address1: 'Street address',
  city: 'City',
  state: 'State',
  postalCode: 'ZIP code',
  phone: 'Phone number',
  website: 'Website',
  description: 'Description',
  specialties: 'Specialties',
  history: 'History',
  ownerBio: 'Owner bio',
  ownerName: 'Owner name',
  priceTier: 'Price range',
  yearEstablished: 'Year established',
  languages: 'Languages spoken',
  parkingNotes: 'Parking',
  transitNotes: 'Transit',
  accessibilityNotes: 'Accessibility',
  menuUrl: 'Menu link',
  orderUrl: 'Ordering link',
  reservationUrl: 'Reservation link',
  publicEmail: 'Public email',
  hours: 'Hours',
  attributes: 'Amenities',
};
