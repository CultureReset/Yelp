/**
 * One definition per metric, used by the dashboard, the exports, the ad
 * reports, and the emails alike. Businesses compare numbers across surfaces
 * and file support tickets when they disagree.
 * See docs/06-analytics.md.
 */
export const METRIC_DEFINITIONS = {
  pageViews:
    'One render of your business page. Excludes known bots and views by people on your own team.',
  uniqueVisitors:
    'Distinct visitors per day. The same person visiting twice in a day counts once.',
  customerLeads:
    'Any of: call click, direction request, website click, message started, quote request, order click, or reservation click.',
  calls:
    'A tap on your phone number. Not a completed call, unless a tracked ad number is in use.',
  directions:
    'A request for directions to your address.',
  websiteClicks:
    'A tap through to your website.',
  messages:
    'Conversations a customer started with you.',
  menuViews:
    'Views of your menu on your business page.',
  photoViews:
    'Views of any photo on your business page.',
  bookmarks:
    'Customers who saved your business.',
  responseRate:
    'Conversations you replied to within 24 hours, divided by eligible conversations. Trailing 30 days, excluding spam.',
  responseTime:
    'The median time to your first reply. Trailing 30 days. Median, not average.',
  costPerLead:
    'Ad spend divided by leads attributed to ads in the same window. Last click within 7 days.',
} as const;

export type MetricKey = keyof typeof METRIC_DEFINITIONS;

/** The seven actions that count as a customer lead. */
export const LEAD_ACTIONS = [
  'calls', 'directions', 'websiteClicks', 'messages',
  'quoteRequests', 'orderClicks', 'reservationClicks',
] as const;
