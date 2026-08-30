import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { hash } from '@node-rs/argon2';
import * as s from './schema';

const OPTS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/yelpbiz');
const db = drizzle(sql, { schema: s });

const FIRST = ['Marcus', 'Dana', 'Priya', 'Tom', 'Elena', 'Jamal', 'Wei', 'Sofia', 'Ben', 'Aisha',
               'Luis', 'Nora', 'Kenji', 'Rita', 'Owen', 'Mira', 'Gabe', 'Yuki', 'Cole', 'Ines'];
const LAST = ['R.', 'K.', 'S.', 'M.', 'T.', 'B.', 'L.', 'C.', 'D.', 'A.'];
const CITIES = ['Austin, TX', 'Round Rock, TX', 'Cedar Park, TX', 'Pflugerville, TX'];

const POSITIVE = [
  'Best al pastor in the city, full stop. The tortillas are made in house and you can taste it.',
  'Came in on a Tuesday night, no wait, food out in under ten minutes. Staff were genuinely warm.',
  'The salsa bar alone is worth the trip. Six options and every one of them is good.',
  'Been coming here for three years. Consistent every single time, which is rarer than it should be.',
  'Portions are generous and the price has not crept up like everywhere else. Real value.',
  'Got the birria plate on a recommendation and I will be thinking about it all week.',
  'Patio is shaded and dog friendly. We stayed two hours and nobody rushed us.',
  'Ordered catering for a 30 person office lunch. Showed up early, everything hot, zero issues.',
];
const MIXED = [
  'Food is genuinely great but the wait on weekends is brutal. Go on a weekday if you can.',
  'Tacos are excellent. Service was slow the night we went, though they were clearly short staffed.',
  'Solid food, but the parking situation is rough. Plan to walk a couple of blocks.',
];
const NEGATIVE = [
  'Order was wrong twice and nobody checked back on us. Disappointing given the reviews.',
  'Waited 45 minutes for a to-go order that was quoted at 15. Food was cold by the time I got home.',
];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function dayKey(d: Date): string { return d.toISOString().slice(0, 10); }

async function main() {
  console.log('Clearing existing seed data…');
  await sql`truncate table
    ${sql('metrics_daily')}, ${sql('reply_drafts')}, ${sql('review_reports')},
    ${sql('review_replies')}, ${sql('reviews')}, ${sql('media')},
    ${sql('messages')}, ${sql('quote_requests')}, ${sql('conversations')},
    ${sql('business_hours')}, ${sql('business_attributes')}, ${sql('business_categories')},
    ${sql('business_edits')}, ${sql('claims')}, ${sql('notifications')},
    ${sql('menu_items')}, ${sql('menu_sections')}, ${sql('services')},
    ${sql('ad_spend_daily')}, ${sql('ad_campaigns')}, ${sql('entitlements')}, ${sql('programs')},
    ${sql('invoice_lines')}, ${sql('invoices')}, ${sql('spend_ledger')}, ${sql('payment_methods')},
    ${sql('businesses')}, ${sql('memberships')}, ${sql('invitations')},
    ${sql('sessions')}, ${sql('auth_tokens')}, ${sql('auth_events')},
    ${sql('recovery_codes')}, ${sql('auth_credentials')},
    ${sql('organizations')}, ${sql('users')}, ${sql('categories')},
    ${sql('attribute_defs')}, ${sql('rate_limits')}
    restart identity cascade`;

  console.log('Categories…');
  const cats = await db.insert(s.categories).values([
    { slug: 'mexican',      name: 'Mexican',           vertical: 'restaurant', sortOrder: 1 },
    { slug: 'tacos',        name: 'Tacos',             vertical: 'restaurant', sortOrder: 2 },
    { slug: 'breakfast',    name: 'Breakfast & Brunch', vertical: 'restaurant', sortOrder: 3 },
    { slug: 'coffee',       name: 'Coffee & Tea',      vertical: 'restaurant', sortOrder: 4 },
    { slug: 'plumbing',     name: 'Plumbing',          vertical: 'home_services', sortOrder: 5 },
  ]).returning();

  console.log('Attribute definitions…');
  await db.insert(s.attributeDefs).values([
    { key: 'takeout',        label: 'Takeout',            groupLabel: 'Dining options', valueType: 'bool', appliesToVerticals: ['restaurant'], consumerFilterable: true, sortOrder: 1 },
    { key: 'delivery',       label: 'Delivery',           groupLabel: 'Dining options', valueType: 'bool', appliesToVerticals: ['restaurant'], consumerFilterable: true, sortOrder: 2 },
    { key: 'outdoor_seating',label: 'Outdoor seating',    groupLabel: 'Amenities',      valueType: 'bool', appliesToVerticals: ['restaurant'], consumerFilterable: true, sortOrder: 3 },
    { key: 'wifi',           label: 'Wi-Fi',              groupLabel: 'Amenities',      valueType: 'enum', enumValues: ['No', 'Free', 'Paid'], appliesToVerticals: ['restaurant'], consumerFilterable: true, sortOrder: 4 },
    { key: 'dogs_allowed',   label: 'Dogs allowed',       groupLabel: 'Amenities',      valueType: 'bool', consumerFilterable: true, sortOrder: 5 },
    { key: 'parking',        label: 'Parking',            groupLabel: 'Amenities',      valueType: 'multi_enum', enumValues: ['Street', 'Private lot', 'Garage', 'Valet'], sortOrder: 6 },
    { key: 'noise_level',    label: 'Noise level',        groupLabel: 'Ambience',       valueType: 'enum', enumValues: ['Quiet', 'Average', 'Loud'], appliesToVerticals: ['restaurant'], sortOrder: 7 },
    { key: 'good_for_kids',  label: 'Good for kids',      groupLabel: 'Ambience',       valueType: 'bool', consumerFilterable: true, sortOrder: 8 },
    { key: 'vegan_options',  label: 'Vegan options',      groupLabel: 'Dietary',        valueType: 'bool', appliesToVerticals: ['restaurant'], consumerFilterable: true, sortOrder: 9 },
    { key: 'gluten_free',    label: 'Gluten-free options',groupLabel: 'Dietary',        valueType: 'bool', appliesToVerticals: ['restaurant'], consumerFilterable: true, sortOrder: 10 },
    { key: 'wheelchair',     label: 'Wheelchair accessible', groupLabel: 'Accessibility', valueType: 'bool', consumerFilterable: true, sortOrder: 11 },
    { key: 'payments',       label: 'Payments accepted',  groupLabel: 'Payments',       valueType: 'multi_enum', enumValues: ['Cash', 'Visa', 'Mastercard', 'Amex', 'Apple Pay', 'Google Pay'], sortOrder: 12 },
  ]);

  console.log('Users and organization…');
  const passwordHash = await hash('CorrectHorseBattery1', OPTS);
  const [owner] = await db.insert(s.users).values({
    email: 'owner@rosastaqueria.com', emailRaw: 'owner@rosastaqueria.com',
    firstName: 'Rosa', lastName: 'Delgado', passwordHash,
    emailVerifiedAt: new Date(), mfaEnforced: true,
  }).returning();

  const [responder] = await db.insert(s.users).values({
    email: 'front@rosastaqueria.com', emailRaw: 'front@rosastaqueria.com',
    firstName: 'Diego', lastName: 'Ramos', passwordHash, emailVerifiedAt: new Date(),
  }).returning();

  const [org] = await db.insert(s.organizations).values({
    name: "Rosa's Taqueria", kind: 'multi',
    legalName: 'Delgado Food Group LLC', billingEmail: 'owner@rosastaqueria.com',
  }).returning();

  console.log('Businesses…');
  const [main] = await db.insert(s.businesses).values({
    orgId: org.id, slug: 'rosas-taqueria-austin', name: "Rosa's Taqueria",
    status: 'published', claimStatus: 'claimed', claimedAt: daysAgo(400),
    address1: '1204 E Cesar Chavez St', city: 'Austin', state: 'TX',
    postalCode: '78702', country: 'US',
    lat: '30.2549000', lng: '-97.7231000', geoPrecision: 'owner_placed',
    neighborhood: 'East Cesar Chavez', crossStreets: 'At Waller St',
    phone: '(512) 555-0142', phoneE164: '+15125550142',
    website: 'https://rosastaqueria.com', websiteDomain: 'rosastaqueria.com',
    menuUrl: 'https://rosastaqueria.com/menu',
    priceTier: 2, yearEstablished: 2011,
    description: 'Family-run taqueria serving Jalisco-style tacos, birria, and house-made salsas since 2011. Masa ground daily.',
    specialties: 'Al pastor carved from the trompo, birria de res, and a salsa bar with six options made fresh every morning.',
    history: 'Rosa Delgado opened the first location on Cesar Chavez in 2011 with a single trompo and six tables.',
    ownerName: 'Rosa Delgado',
    ownerBio: 'Rosa learned to cook from her grandmother in Guadalajara and has run kitchens in Austin for over twenty years.',
    languages: ['English', 'Spanish'],
    parkingNotes: 'Free lot behind the building, entrance on Waller St.',
    ratingAvg: '4.4', reviewCount: 0, photoCount: 0,
    timezone: 'America/Chicago',
  }).returning();

  const [second] = await db.insert(s.businesses).values({
    orgId: org.id, slug: 'rosas-taqueria-south', name: "Rosa's Taqueria — South",
    status: 'published', claimStatus: 'claimed', claimedAt: daysAgo(120),
    address1: '3300 S Congress Ave', city: 'Austin', state: 'TX', postalCode: '78704',
    lat: '30.2270000', lng: '-97.7540000', geoPrecision: 'rooftop',
    phone: '(512) 555-0188', phoneE164: '+15125550188',
    website: 'https://rosastaqueria.com', websiteDomain: 'rosastaqueria.com',
    priceTier: 2, yearEstablished: 2023,
    description: 'The South Congress location. Same menu, bigger patio.',
    ratingAvg: '4.6', timezone: 'America/Chicago',
  }).returning();

  await db.insert(s.memberships).values([
    { userId: owner.id, orgId: org.id, role: 'owner', acceptedAt: new Date() },
    { userId: responder.id, orgId: org.id, role: 'responder', locationScope: [main.id], acceptedAt: new Date() },
  ]);

  await db.insert(s.businessCategories).values([
    { businessId: main.id, categoryId: cats[0].id, isPrimary: true },
    { businessId: main.id, categoryId: cats[1].id },
    { businessId: main.id, categoryId: cats[2].id },
    { businessId: second.id, categoryId: cats[0].id, isPrimary: true },
  ]);

  console.log('Hours…');
  const hours = [];
  for (let d = 0; d <= 6; d++) {
    if (d === 1) { hours.push({ businessId: main.id, dayOfWeek: d, isClosed: true }); continue; }
    // Split shift: lunch and dinner, with a late close on Fri/Sat.
    hours.push({ businessId: main.id, dayOfWeek: d, opens: '11:00', closes: '15:00', label: 'Lunch' });
    hours.push({ businessId: main.id, dayOfWeek: d, opens: '17:00', closes: d === 5 || d === 6 ? '23:30' : '21:00', label: 'Dinner' });
  }
  await db.insert(s.businessHours).values(hours);

  console.log('Reviews…');
  const reviewRows = [];
  for (let i = 0; i < 64; i++) {
    const roll = i % 10;
    const rating = roll < 6 ? 5 : roll < 8 ? 4 : roll === 8 ? 3 : roll === 9 ? 2 : 1;
    const body = rating >= 4 ? pick(POSITIVE, i) : rating === 3 ? pick(MIXED, i) : pick(NEGATIVE, i);
    reviewRows.push({
      businessId: main.id,
      authorId: crypto.randomUUID(),
      authorName: `${pick(FIRST, i)} ${pick(LAST, i * 3)}`,
      authorCity: pick(CITIES, i),
      authorReviewCount: 3 + ((i * 7) % 180),
      rating,
      body,
      helpfulCount: (i * 3) % 14,
      visibility: i % 11 === 10 ? 'not_recommended' : 'recommended',
      createdAt: daysAgo(2 + i * 5),
    });
  }
  const inserted = await db.insert(s.reviews).values(reviewRows).returning();

  // Reply to about half, leaving a realistic backlog of unreplied ones.
  const replies = inserted
    .filter((r, i) => i % 2 === 0 && r.visibility === 'recommended')
    .slice(0, 22)
    .map((r) => ({
      reviewId: r.id, businessId: main.id, authorId: owner.id,
      body: r.rating >= 4
        ? `Thank you so much — this made our whole week. We'll pass it along to the kitchen crew. Hope to see you again soon!`
        : `I'm sorry we got this wrong, and I appreciate you telling us. That's not the standard we hold ourselves to. I'd like to make it right — please email me directly at owner@rosastaqueria.com. — Rosa`,
      createdAt: new Date(r.createdAt.getTime() + 36 * 3600 * 1000),
    }));
  await db.insert(s.reviewReplies).values(replies);

  const recommended = inserted.filter((r) => r.visibility === 'recommended');
  const avg = recommended.reduce((a, r) => a + r.rating, 0) / recommended.length;
  await sql`update businesses set rating_avg = ${avg.toFixed(1)}, review_count = ${recommended.length} where id = ${main.id}`;

  console.log('Metrics rollups…');
  const rollups = [];
  for (let i = 0; i < 60; i++) {
    const d = daysAgo(i);
    const dow = d.getDay();
    const weekend = dow === 5 || dow === 6;
    const base = weekend ? 210 : 130;
    const drift = Math.round((60 - i) * 1.4);      // gentle growth toward today
    const noise = ((i * 37) % 40) - 20;
    const views = Math.max(40, base + drift + noise);
    rollups.push({
      businessId: main.id, day: dayKey(d),
      pageViews: views,
      uniqueVisitors: Math.round(views * 0.78),
      calls: Math.round(views * 0.048),
      directions: Math.round(views * 0.071),
      websiteClicks: Math.round(views * 0.039),
      messages: Math.round(views * 0.011),
      quoteRequests: 0,
      menuViews: Math.round(views * 0.34),
      photoViews: Math.round(views * 0.52),
      bookmarks: Math.round(views * 0.014),
      shares: Math.round(views * 0.004),
      orderClicks: Math.round(views * 0.026),
      reservationClicks: 0,
      mobileShare: 71,
      sourceBreakdown: { organic_search: 44, external_search: 31, ads: 14, direct: 11 },
      computedAt: new Date(),
    });
  }
  await db.insert(s.metricsDaily).values(rollups);

  console.log('Inbox…');
  const convos = await db.insert(s.conversations).values([
    { businessId: main.id, consumerId: crypto.randomUUID(), consumerName: 'Alicia Moreno',
      consumerCity: 'Austin, TX', kind: 'quote_request', status: 'open',
      unreadForBusiness: 2, lastMessageAt: daysAgo(0), createdAt: daysAgo(0), fanoutSize: 4 },
    { businessId: main.id, consumerId: crypto.randomUUID(), consumerName: 'Peter Hahn',
      consumerCity: 'Round Rock, TX', kind: 'message', status: 'open',
      unreadForBusiness: 1, lastMessageAt: daysAgo(1), createdAt: daysAgo(1) },
    { businessId: main.id, consumerId: crypto.randomUUID(), consumerName: 'Grace Okoye',
      consumerCity: 'Austin, TX', kind: 'message', status: 'won',
      unreadForBusiness: 0, firstResponseAt: daysAgo(5), lastMessageAt: daysAgo(5), createdAt: daysAgo(6) },
  ]).returning();

  await db.insert(s.messages).values([
    { conversationId: convos[0].id, senderType: 'consumer', senderName: 'Alicia Moreno',
      body: 'Hi! Do you cater office lunches for about 40 people? Looking at the 18th.', createdAt: daysAgo(0) },
    { conversationId: convos[0].id, senderType: 'consumer', senderName: 'Alicia Moreno',
      body: 'We would need a vegetarian option for roughly 8 of them.', createdAt: daysAgo(0) },
    { conversationId: convos[1].id, senderType: 'consumer', senderName: 'Peter Hahn',
      body: 'Are you open on Memorial Day?', createdAt: daysAgo(1) },
    { conversationId: convos[2].id, senderType: 'consumer', senderName: 'Grace Okoye',
      body: 'Do you have gluten free tortillas?', createdAt: daysAgo(6) },
    { conversationId: convos[2].id, senderType: 'business', senderId: owner.id, senderName: 'Rosa',
      body: 'We do! Corn tortillas are made in house and are naturally gluten free.', createdAt: daysAgo(5) },
  ]);

  await db.insert(s.quoteRequests).values({
    conversationId: convos[0].id,
    answers: [
      { question: 'Type of event', answer: 'Office lunch' },
      { question: 'Number of guests', answer: '40' },
      { question: 'Setup needed', answer: 'Drop-off with chafing dishes' },
    ],
    budgetBand: '$500 – $800', desiredDate: '2026-09-18',
    locationText: 'Downtown Austin, 78701', serviceCategory: 'Catering',
  });

  console.log('Notifications…');
  await db.insert(s.notifications).values(
    inserted.slice(0, 8).map((r, i) => ({
      userId: owner.id, businessId: main.id,
      type: 'review.created',
      title: `New ${r.rating}-star review from ${r.authorName}`,
      body: r.body.slice(0, 120),
      href: '/dashboard/reviews',
      readAt: i > 3 ? new Date() : null,
      createdAt: r.createdAt,
    })),
  );

  console.log('\nSeed complete.');
  console.log('  Sign in:  owner@rosastaqueria.com  /  CorrectHorseBattery1   (Owner, 2 locations)');
  console.log('  Also try: front@rosastaqueria.com  /  CorrectHorseBattery1   (Responder, 1 location)');
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
