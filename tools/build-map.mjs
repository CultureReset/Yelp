import { writeFile, readFile } from 'node:fs/promises';

/**
 * Builds the UX map artifact. Kept in the repo so the map can be regenerated
 * when screens change, rather than drifting out of date as a one-off document.
 */

const OUT = process.argv[2]
  ?? '/tmp/claude-0/-home-user-Yelp/420913a8-d6a1-56f9-b768-fe8073bd1aa0/scratchpad/uxmap.html';

/* ------------------------------------------------------------------ roles */

const ROLE_VIEW = [
  { role: 'Owner', sees: 10, desc: 'Everything, including ownership transfer and closing the account.',
    tabs: 'Home · Inbox · Reviews · Analytics · More', hidden: '—' },
  { role: 'Admin', sees: 10, desc: 'Everything except transferring ownership or closing the account.',
    tabs: 'Home · Inbox · Reviews · Analytics · More', hidden: '—' },
  { role: 'Location manager', sees: 9, desc: 'Runs the day-to-day for specific locations.',
    tabs: 'Home · Inbox · Reviews · Analytics · More', hidden: 'Billing' },
  { role: 'Marketing', sees: 8, desc: 'Photos, menu, descriptions, campaigns. No identity fields, no billing.',
    tabs: 'Home · Inbox · Reviews · Analytics · More', hidden: 'Billing, and identity fields inside Business info' },
  { role: 'Billing', sees: 4, desc: 'Invoices, payment methods, budgets.',
    tabs: 'Home · Analytics · More', hidden: 'Inbox, Reviews, Photos, Business info, Menu, Settings team controls' },
  { role: 'Responder', sees: 4, desc: 'Replies to reviews and messages only.',
    tabs: 'Home · Inbox · Reviews · More', hidden: 'Photos, Business info, Menu, Programs, Analytics, Billing' },
  { role: 'Analyst', sees: 3, desc: 'Read-only reporting.',
    tabs: 'Home · Analytics · More', hidden: 'Inbox, Reviews, Photos, Business info, Menu, Programs, Billing' },
];

/* ------------------------------------------------------------------ shell */

const SHELL = [
  { name: 'Top bar', persistent: 'Every signed-in screen', blocks: [
    ['Brand mark', ['◆ Business → Home']],
    ['Location switcher', [
      'Shows the current location by name, with a count when the org has more than one',
      'Opens a list headed by the organisation name',
      'Last row: “Manage locations”',
      'Whatever is selected here scopes every other screen',
    ]],
    ['Notification bell', ['Red dot when unread', 'Opens Notifications']],
    ['Desktop only', ['“View my public page ↗”', 'Account menu: Your profile · Security · Users & permissions · Notifications · Help · Sign out']],
  ]},
  { name: 'Bottom tab bar', persistent: 'Phone only, fixed to the bottom', blocks: [
    ['Tabs', ['Home', 'Inbox — badge shows unread count', 'Reviews — badge shows unreplied count', 'Analytics', 'More']],
    ['Rules', [
      'Filtered by role: a Responder gets three tabs, not five with dead links',
      'Every target is at least 48px, the Android accessibility minimum',
      'Padded for the system gesture bar with env(safe-area-inset-bottom)',
    ]],
  ]},
  { name: 'More sheet', persistent: 'Phone only, raised from the More tab', blocks: [
    ['Header', ['Avatar, full name', '“Owner · Rosa’s Taqueria” — role, then organisation']],
    ['Sections', ['Photos', 'Business info — badge for pending edits', 'Menu & services', 'Programs', 'Billing', 'Settings']],
    ['Footer rows', ['“View my public page ↗”', '“Sign out”']],
    ['Behaviour', ['Escape closes it', 'The page behind is locked from scrolling while it is open', 'Tapping the scrim closes it']],
  ]},
];

/* ---------------------------------------------------------------- screens */

const SCREENS = [
  { id: 'signin', group: 'Getting in', route: '/login', title: 'Sign in',
    purpose: 'Return to an existing account.',
    blocks: [
      ['Heading', ['H1 “Sign in”', '“Manage your listing, reviews, and messages.”']],
      ['Fields', ['Email — placeholder “you@business.com”', 'Password — placeholder “Your password”']],
      ['Links & actions', ['“Forgot your password?”', 'Button “Sign in”, becomes “Signing in…”']],
      ['Alternatives', ['Divider “or”', '“Continue with Google” · “Continue with Apple” — both disabled', '“Single sign-on arrives in Phase 1. Use email for now.”']],
      ['Footer', ['“New here? Create an account”']],
    ],
    messages: [
      ['Wrong credentials', 'That email and password combination is not correct.'],
      ['Too many attempts', 'Too many attempts. Try again in 2 minute(s).'],
      ['Arriving from a reset', 'Password updated. Sign in with your new password.'],
    ]},
  { id: 'signup', group: 'Getting in', route: '/signup', title: 'Create your account',
    purpose: 'A new person and a new organisation in one step.',
    blocks: [
      ['Heading', ['H1 “Create your account”', '“Free to claim and manage your business.”']],
      ['Fields', ['First name · Last name', 'Business name — “You can add more locations later.”', 'Work email', 'Password — “At least 12 characters. We check it against known breaches.”']],
      ['Consent — two separate checkboxes, never bundled', ['“I agree to the Terms of Service and Privacy Policy.” — required', '“Send me tips and product updates. Optional.” — optional']],
      ['Action', ['Button “Create account”, becomes “Creating your account…”']],
    ],
    messages: [
      ['Email already registered', 'That email cannot be used. Try signing in instead.'],
      ['Breached password', 'This password has appeared in a known data breach. Choose a different one.'],
      ['Terms not accepted', 'You must accept the terms to continue.'],
    ],
    aside: ['Bundling terms and marketing into one checkbox is not valid consent in several jurisdictions.']},
  { id: 'reset', group: 'Getting in', route: '/forgot-password', title: 'Reset your password',
    purpose: 'Recover access without revealing who has an account.',
    blocks: [
      ['Heading', ['H1 “Reset your password”', '“We’ll email you a link. It expires in 30 minutes and can be used once.”']],
      ['Fields & actions', ['Email', 'Button “Send reset link”, becomes “Sending…”', '“Back to sign in”']],
    ],
    messages: [['After submitting — identical whether or not the account exists', 'Check your email — If that address has an account, we’ve sent a reset link. It expires in 30 minutes.']]},

  { id: 'claim-search', group: 'Claiming', route: '/claim', title: 'Claim your business',
    purpose: 'Find the listing that already exists.',
    blocks: [
      ['Heading', ['H1 “Claim your business”', '“Find the listing that already exists. If it isn’t here, you can add it.”']],
      ['Search', ['One field, placeholder “Business name, street, or city”', 'Button “Search”']],
      ['Result rows', ['Name, full address', 'Stars and review count', 'Badge “Unclaimed” or “Already claimed”']],
      ['Standing explainer', ['“Why we verify” — “Claiming a business gives you control of its hours, phone number, and the ability to reply to customers in its name. That is worth stealing, so we verify against the contact details already on the listing — never ones you type in.”']],
    ],
    messages: [['Nothing matches', 'Nothing matching “x” — Check the spelling, try the street name, or add your business as a new listing.']]},

  { id: 'claim-verify', group: 'Claiming', route: '/claim/[id]', title: 'Verify the claim',
    purpose: 'Prove you control the business, using details already on the listing.',
    blocks: [
      ['Listing card', ['Name, address, phone, rating, review count', 'Claim state badge: Started · Code sent · Being reviewed · Claimed · Disputed']],
      ['Step one', ['“Is this your business?”', '“Claiming gives you control of the details and lets you reply to customers in this business’s name. We verify first.”', 'Button “Yes, this is my business”']],
      ['Step two — five methods, strongest first', [
        'Call the business phone · Strongest · “We call the number on the listing and read out a 6-digit code.”',
        'Text the business phone · Strong · “We text a 6-digit code to the number on the listing.”',
        'Email at the business domain · Strong · “Only available if your email address matches the website on the listing.”',
        'Postcard to the business address · Slow but solid · “We mail a code to the address on the listing. Slow, but it proves you are there.”',
        'Upload a document · Reviewed by hand · “A business licence, utility bill, or tax document. Reviewed by a person.”',
      ]],
      ['Method availability', [
        'A method with no matching detail on the listing is greyed out with the reason',
        'e.g. “This listing has no phone number.” or “Your email is not at lafondaverde.com.”',
        'Footer counts remaining sends: “3 code requests left today”',
      ]],
      ['Step three', ['“Enter the 6-digit code”', 'Single centred field, numeric keypad, autocomplete=one-time-code', '“Codes expire after 15 minutes.”']],
    ],
    messages: [
      ['Code sent', 'Code sent. It expires in 15 minutes.'],
      ['Postcard chosen', 'Your postcard is on its way. It usually arrives within 5 to 10 days.'],
      ['Wrong code', 'That code is not correct. 4 attempt(s) left.'],
      ['Five wrong codes', 'Too many incorrect codes. We have sent this to a reviewer, who will be in touch.'],
      ['Too many sends', 'You have requested too many codes today. Try again tomorrow, or upload a document instead.'],
      ['Under manual review', 'A reviewer is looking at this — We could not verify you automatically, so a person is checking. That usually takes up to two business days, and we will email you either way.'],
      ['Someone else holds it', 'Someone has already claimed this business — If this business is yours, tell us and a reviewer will look at the evidence from both sides. The current owner keeps access until a decision is made.'],
      ['Success', '{Business} is yours — You can now edit your details, reply to reviews, and answer messages.'],
      ['Success, small print', 'For the next 30 days, changes to your name, address, phone, and website are reviewed by a person before they publish. That is a deliberate speed bump against account takeover, and it lifts automatically.'],
    ],
    aside: ['Every method targets a detail already on the listing. A claimant who could change the phone number and then verify against it would have verified nothing.']},

  { id: 'home', group: 'Every day', route: '/dashboard', title: 'Home',
    purpose: 'What needs attention today, in under five seconds.',
    blocks: [
      ['Header', ['Business name', 'Stars plus the numeral, then “59 reviews”', 'Badge “✓ Verified” or “Unverified”', '“View my public page ↗”']],
      ['Attention row — collapses entirely when nothing is actionable', [
        '“36 reviews without a reply” · “Oldest has been waiting 317 days.”',
        '“1 unread message” · “Response time shows on your public page.”',
        '“1 edit in review” · “We’ll email you when a decision is made.”',
      ]],
      ['Last 30 days', ['“Through 30/08/2026 · vs previous 30 days”', 'Page views · Customer leads · Calls · Direction requests · Website clicks', 'Each: value, delta chip with an arrow glyph, sparkline', 'No baseline reads “No prior data”']],
      ['Recent activity', ['“Reviews, photos, questions, and messages.”', 'Empty: “Nothing yet” · “Customer activity on your page will appear here.”']],
      ['Profile strength', ['Percentage, “4 of 7 done”, progress bar', 'Unfinished first, each linking to its editor; finished struck through']],
    ],
    messages: [['No business claimed yet', 'No business yet — Claim a listing that already exists, or add your business if it isn’t listed. → “Claim your business”']],
    aside: ['A row of zeroes teaches people to ignore the row, so it renders only actionable cards.']},

  { id: 'inbox', group: 'Leads', route: '/dashboard/inbox', title: 'Inbox',
    purpose: 'Quote requests and messages. For a service business this is the product.',
    blocks: [
      ['Heading', ['H1 “Inbox”', '“Quote requests and messages from customers.”']],
      ['Three stat cards', ['“Response rate” · “Replied within 24 hours, trailing 30 days”', '“Median response time” · “Median, not average”', '“Shown publicly” · “Both numbers appear on your business page. Replying faster is the biggest lever you control here.”']],
      ['Filter pills', ['All · Unread · Unanswered · Open (n) · Won (n)']],
      ['Conversation rows', ['Avatar, name bold while unread', 'Kind badge: Quote request · Message · Appointment', 'Status badges: Won · Lost · No reply yet', '“also sent to 3 others” on a fan-out', 'City, relative time, unread count']],
    ],
    messages: [['Nothing matches', 'No conversations here — When a customer messages you or sends a quote request, it lands in this inbox.']]},

  { id: 'thread', group: 'Leads', route: '/dashboard/inbox/[id]', title: 'Conversation',
    purpose: 'Answer one customer and record the outcome.',
    blocks: [
      ['Navigation & header', ['“← Back to inbox”', 'Avatar, name, city, status badge']],
      ['Messages', ['Yours right in brand colour, theirs left in grey', 'System notes centred in a pill', 'Stamped “Name · automated · 30 Aug, 1:42 am”']],
      ['Composer', ['Placeholder “Answer their question and say what happens next.”', '“Templates (3)” lists name plus preview', 'Templates substitute {{customer_name}} and {{business_name}}', 'Button “Send”']],
      ['Outcome', ['“Did this turn into a job?”', '“Marking won or lost is what makes your cost-per-lead reporting accurate.”', 'Won · Lost · Close']],
      ['Sidebar', ['Quote request: Type of event · Number of guests · Setup needed · Budget · Date wanted · Location', 'This conversation: Started · First reply · Also sent to']],
    ],
    messages: [
      ['Read-only role', 'Your role can read this conversation but not reply.'],
      ['On a fan-out', 'This customer contacted several businesses at once. The first useful reply usually wins the job.'],
    ]},

  { id: 'reviews', group: 'Reputation', route: '/dashboard/reviews', title: 'Reviews',
    purpose: 'Read, reply, and report. Never edit or delete.',
    blocks: [
      ['Heading', ['H1 “Reviews”', '“Reply publicly or by direct message. Reviews are written by customers — businesses cannot edit or remove them.”']],
      ['Summary', ['Distribution bars, 5 down to 1', '“Reply coverage” percentage · “22 of 59 replied”']],
      ['Filters', ['All · Needs a reply · Replied', '5★ 4★ 3★ 2★ 1★', 'Tabs “Recommended (59)” · “Not recommended (5)”']],
      ['Review card', ['Avatar, name, “Round Rock, TX · 24 reviews”', 'Stars plus numeral, date, body', '“13 found this helpful”', 'Badges “Not currently recommended” · “✓ You replied”']],
      ['Actions', ['“Reply publicly” / “Edit reply” / “Continue draft”', '“Message privately” — disabled, “Direct messaging arrives with the Inbox”', '“Report”']],
      ['Reply composer', ['“Thank the customer, address the specifics, and say what you’ll do next. This is public.”', 'Character count, and “· draft restored”', '“Your reply is public and appears under this review with your business name.”']],
      ['Report reasons', [
        'Conflict of interest — Posted by a competitor, a former employee, or someone with a personal stake.',
        'Not a real customer — The reviewer never visited or transacted with this business.',
        'Threat, lewdness, or hate speech — Attacks a person rather than describing an experience.',
        'Privacy violation — Names a staff member, or includes personal or medical details.',
        'Not about this experience — Commentary unrelated to a customer experience at this business.',
        'Meant for a different business — Describes somewhere else entirely.',
        'Inappropriate content — Explicit material, or promotional spam.',
      ]],
    ],
    messages: [
      ['Before submitting a report', 'Reporting a review does not remove it. A moderator decides based on our content guidelines, and your advertising status has no bearing on the outcome.'],
      ['After submitting', 'Report received — We’ll review it against our content guidelines and email you the decision, usually within 3 business days.'],
      ['On the not-recommended tab', 'Why some reviews are not recommended — Our software weighs reviewer history, review quality, and solicitation signals to decide which reviews are shown prominently. These reviews are still public, but they don’t count toward your rating. No one — including our sales team — can change this classification.'],
      ['Filters match nothing', 'No reviews match these filters — Try clearing a filter, or check the other recommendation tab.'],
    ],
    aside: ['Replies autosave as drafts after a pause in typing, because owners write long ones and lose them.']},

  { id: 'photos', group: 'Reputation', route: '/dashboard/photos', title: 'Photos & videos',
    purpose: 'Two libraries with different rules, deliberately never merged.',
    blocks: [
      ['Heading', ['H1 “Photos & videos”', '“Your photos and customer photos are governed differently, so they stay in separate tabs. Location data is stripped from every upload.”']],
      ['Tabs', ['“Your photos (10)”', '“Customer photos (8)”']],
      ['Photo card', ['Badges: Cover photo · In review · Rejected · category tag', 'Caption, or “No caption”', 'Rejection reason in full', 'View count and pixel dimensions', 'Yours: Edit · Delete. Customers’: Report only.']],
    ],
    messages: [
      ['On the customer tab', 'Customers own the photos they upload. You can report one that breaks our content guidelines, but you cannot delete or reorder them.'],
      ['No photos yet', 'No photos yet — Businesses with at least five photos get noticeably more page views. Start with your food, your space, and your team.'],
    ]},

  { id: 'business', group: 'Your details', route: '/dashboard/business', title: 'Business information',
    purpose: 'Propose changes. Some publish instantly, some wait for a person.',
    blocks: [
      ['Heading', ['H1 “Business information”', '“What customers see on your page. Changes to your name, address, phone, website, or categories are reviewed by a person before they publish — each card tells you which applies before you save.”']],
      ['Pending banner', ['Badge “In review” · “1 change waiting on a moderator”', '“Phone number → (512) 555-0199”', 'The reason it queued, then “Submitted 30/08/2026”', '“Cancel this change”']],
      ['Basics', ['Business name ⚑ · About the business · Specialties · History · Price range · Year established']],
      ['Location', ['Street address ⚑ · Suite or floor ⚑ · City ⚑ · State ⚑ · ZIP code ⚑', 'Map pin block with coordinates and how they were set']],
      ['Contact & links', ['Phone ⚑ · Website ⚑ · Public email · Menu link · Ordering link · Reservation link']],
      ['Hours', ['Split shifts, overnight ranges, holiday overrides', 'Read-only — “Editor arrives in Phase 1”']],
      ['Owner and Getting there', ['Owner name · Owner bio', 'Parking · Transit · Accessibility']],
    ],
    messages: [
      ['Entering edit mode on a moderated card', 'Some of these go to review — Changes to Business name are checked by a person before they appear publicly. Everything else here publishes right away.'],
      ['Saving a descriptive change', 'Saved — Saved and live on your public page.'],
      ['Saving an identity change', 'Submitted for review — Business name, address, phone, website, and category changes are always reviewed by a person.'],
      ['Within 30 days of claiming', 'This business was claimed within the last 30 days, so changes are reviewed for now.'],
      ['Every day set to closed', 'Every day is set to closed. If you are closing temporarily, use the “Temporarily closed” status instead — a moderator will confirm this change.'],
      ['No change made', 'Nothing to save — no changes were made.'],
    ],
    aside: ['The ⚑ marker means “reviewed before publishing”, and it sits on the field, so you know before you type.']},

  { id: 'menu', group: 'Your details', route: '/dashboard/menu', title: 'Menu & services',
    purpose: 'What you sell, from three possible sources.',
    blocks: [
      ['Heading', ['H1 “Menu & services”', '“What you sell. Services feed quote matching; menu items show on your public page.”']],
      ['Services', ['“Used to match you to quote requests. Price bands are shown to customers as ranges.”']],
      ['Menu sections', ['Items with name, description, price', 'Badges: Popular · Vegan · Vegetarian · Gluten-free', 'Partner sections carry “From POS · read-only”']],
    ],
    messages: [
      ['When a POS feed is connected', 'Some sections come from your POS — Sections marked “From POS” are managed by your point-of-sale integration and are read-only here. Editing them in the dashboard would be overwritten at the next sync, so we block it rather than let your change disappear overnight.'],
      ['On a partner section', '“Popular” is derived from what customers actually view and order. It is not something you set.'],
    ]},

  { id: 'programs', group: 'Money', route: '/dashboard/programs', title: 'Programs',
    purpose: 'Advertising, upgrades, and growth tools, each with a price and an exit.',
    blocks: [
      ['Heading', ['H1 “Programs”', '“Advertising, profile upgrades, and growth tools. Every program shows its price, its performance, and how to cancel.”']],
      ['Campaign card', ['“$1,200.00 monthly budget · leads · 8-mile radius”', 'Badge “Active”, button “Edit”']],
      ['Budget pacing', ['“Budget pacing — day 30 of 31” with “$888.72 of $1,200.00”', 'Bar plus a marker titled “Where an even spend would be today”', '“On pace. Projected $918.34 by month end.”']],
      ['Performance', ['Impressions · Clicks · Click rate · Avg. cost per click · Cost per lead', '“5 invalid clicks filtered this month and not charged to you.”']],
      ['Your programs', ['Name, status badge, description, monthly price or “Usage-based”, “Cancel”', '“Features switched on:” entitlement chips']],
      ['Available to add', ['Verified license · Reservations · Appointments · Job postings']],
    ],
    messages: [['Standing disclosure at the foot of the page', 'Advertising affects where your ads appear. It does not affect your star rating, which reviews are recommended, or where you rank in ordinary search results.']]},

  { id: 'analytics', group: 'Money', route: '/dashboard/analytics', title: 'Analytics',
    purpose: 'Pre-aggregated daily rollups, each number carrying its definition.',
    blocks: [
      ['Heading & range', ['H1 “Analytics”', '“Rosa’s Taqueria · data through 30/08/2026”', 'Last 7 days · Last 30 days · Last 60 days', 'Button “Export CSV” — disabled']],
      ['Page views', ['“One render of your business page. Excludes known bots and views by people on your own team.”']],
      ['Customer leads', ['“Any of: call click, direction request, website click, message started, quote request, order click, or reservation click.”']],
      ['Customer actions', ['Table: Action · Count · Per 100 · Change', 'Calls · Direction requests · Website clicks · Messages · Menu views · Photo views · Saves · Order clicks']],
      ['Where visitors came from', ['Search on this platform · Google and other search engines · Your ads · Direct and saved']],
    ],
    messages: [['Standing note at the foot of the page', 'Numbers exclude visits from people on your own team and traffic we identify as automated. When we improve that filtering, historical figures can shift slightly — we stamp each day with the filter version so the change is explainable rather than mysterious.']]},

  { id: 'billing', group: 'Money', route: '/dashboard/billing', title: 'Billing',
    purpose: 'What you owe, what you paid, and how to stop.',
    blocks: [
      ['Heading', ['H1 “Billing”', '“Ad spend shown here is reconciled against your invoice every night — if the two ever disagree, the invoice is corrected, not the report.”']],
      ['Three tiles', ['“Ad spend this month” · “Accrued to date, not yet invoiced”', '“Amount due” · “Due 31/08/2026”', '“Charging” · “Visa •••• 4242”']],
      ['Payment methods', ['“Card details live at our payment processor. Nobody here can see a full number.”', '“Adding or removing a payment method asks for your password again, even if you just signed in.”']],
      ['Invoices', ['“Line items broken out by program and by location, with tax separated.”']],
      ['Cancelling', ['“We show the effective date and the prorated amount before you confirm, and email you a receipt. Nothing is hidden behind a phone call.”', '“Cancelling a paid program does not remove your business listing. It stays live, free, and claimed by you.”']],
    ],
    messages: [['Card expiring within 60 days', 'A card is expiring soon — Mastercard ending 8210 expires 3/2026. Update it before your next charge so your programs keep running.']]},

  { id: 'settings', group: 'Account', route: '/dashboard/settings', title: 'Settings',
    purpose: 'You, your team, and your organisation.',
    blocks: [
      ['Your profile', ['Name · Email with “✓ Verified” · Phone · Language · Time zone', '“Changing your email sends a confirmation to the new address. The change does not take effect until you click it.”']],
      ['Security', ['“Password” · “Changing it signs out every other device.”', '“Authenticator app” with On/Off · “A six-digit code from an app on your phone.”', '“Passkey” · “Sign in with your fingerprint, face, or device PIN.”']],
      ['Where you are signed in', ['Device, “This device” badge, IP, “active now”, “Revoke”', 'Button “Sign out everywhere”']],
      ['Users & permissions', ['Name, email, what the role means in plain words, role badge, scope', '“Removing someone revokes their sessions immediately and cancels any invitations they have outstanding.”']],
      ['Locations & Notifications', ['Each location with “✓ Claimed” and review count', 'Matrix of event type against Email · Push · SMS, per person not per business']],
      ['Data & privacy', ['“Export your data” · “Everything we hold about you and your business, as files.”', '“Close this account” · “Your listing does not disappear. It reverts to unclaimed, and someone else could claim it later.”']],
    ],
    messages: [['Role requires two-factor but none is enrolled', 'Two-factor authentication is required for your role — As Owner you can reach billing or user management, which is where account takeover does real damage. Set up an authenticator app or a passkey.']]},

  { id: 'noaccess', group: 'Account', route: '/dashboard/no-access', title: 'No access',
    purpose: 'What a blocked route says instead of an error page.',
    blocks: [
      ['Three variants', [
        '“Your role does not include this section” — “Ask an account owner or admin to change your role if you need it.”',
        '“That location is not in your access scope” — “You have access to some locations in this organization, but not this one.”',
        '“Confirm your password to continue” — “This action changes something sensitive, so we ask again if it has been more than 15 minutes.”',
      ]],
      ['Your access panel', ['Role name and what it means', 'The exact permission that was missing, in monospace']],
      ['Actions', ['“Back to Home”', '“See who can change this”']],
    ],
    aside: ['This replaced a 500 error with a stack trace. Failing closed was correct; failing silently was not.']},

  { id: 'offline', group: 'Account', route: '/offline', title: 'No connection',
    purpose: 'What the installed app shows with no signal.',
    blocks: [
      ['Copy', ['H1 “You are offline”', '“We could not reach the network. Anything you had already loaded is still on screen; new pages will load once you have signal again.”', '“Replies and edits you were part-way through are not lost — they are saved as drafts on this device.”']],
    ],
    aside: ['Owners open this in car parks and basements. A browser error page there reads as a broken app.']},
];

const FLOWS = [
  { name: 'New account to working dashboard', steps: [
    'Create your account — name, business name, email, password, two consent boxes',
    'Password checked for length and against known breach corpora',
    'A user, an organisation, and an Owner membership are created in one transaction',
    'A verification email is queued, but you are not blocked on it',
    'Land on Home, read-only until verified',
  ]},
  { name: 'Unclaimed listing to verified owner', steps: [
    'Search by name, street, or city',
    '“Yes, this is my business” opens a claim, valid for seven days',
    'Pick a method — only the ones this listing can actually support are enabled',
    'A 6-digit code goes to the listing’s own phone, domain email, or address',
    'Five wrong codes routes the claim to a human instead of locking you out',
    'On success: ownership transfers, an Owner membership is created, and any previous owner is notified with a dispute link',
    'Identity fields stay under review for 30 days',
  ]},
  { name: 'Review to published reply', steps: [
    'Reviews, filter “Needs a reply”',
    '“Reply publicly” opens the composer; typing autosaves a draft after a pause',
    'Returning later shows “Continue draft” and “· draft restored”',
    '“Publish reply” writes the reply and an audit entry',
    'Card gains “✓ You replied”; Home and the nav badge drop by one',
  ]},
  { name: 'Edit to publish, or to a moderator', steps: [
    'Business information, “Edit” on a card',
    'Fields carrying ⚑ are named in a warning before you save',
    'Only changed fields become a proposal — an unchanged form says “Nothing to save”',
    'Descriptive fields auto-approve and apply immediately',
    'Identity fields queue: the published record keeps its old value',
    'A pending banner appears with the reason and a “Cancel this change” button',
  ]},
  { name: 'Lead to recorded outcome', steps: [
    'Inbox row opens the conversation and marks it read',
    'Reply, optionally from a template with the customer’s name filled in',
    'First reply time is stamped once and never moved — it drives the public badge',
    'Won, Lost, or Close records the outcome',
  ]},
];

const PLAY = [
  ['What ships', 'A Trusted Web Activity — Google’s own route for putting a PWA on Play. The Android app is a thin shell that opens the site full-screen with no browser chrome.'],
  ['Why not React Native', 'One codebase instead of two, and a web deploy updates the app with no store review. React Native earns its cost only when you need OS access the web cannot reach.'],
  ['Already built', 'Web manifest, service worker with an offline shell, offline page, push notification handling, app shortcuts for Inbox and Reviews, Bubblewrap config, Digital Asset Links file, and the full store listing copy.'],
  ['Only you can do', 'A Play Developer account (US$25, identity check takes days), a live HTTPS domain, and a signing key you must never lose.'],
  ['The classic mistake', 'Forgetting to add the Play App Signing fingerprint to assetlinks.json as a second entry. The app then opens showing a browser address bar.'],
  ['iOS', 'Apple does not permit TWAs on the App Store. iOS needs a separate route, and web push there requires the user to add to home screen first.'],
];

const VOICE = [
  ['Name the control by what happens', '“Publish reply”, then a confirmation that says “Saved”. Not “Submit”.'],
  ['Put the definition next to the number', 'Every metric states what it counts and over what window, because people compare numbers across screens and file tickets when they disagree.'],
  ['Errors explain and offer the fix', '“This password has appeared in a known data breach. Choose a different one.” Not “Invalid password”.'],
  ['Say the limit before the action', 'Moderated fields are flagged in the form, not after you press save.'],
  ['Never imply that paying changes outcomes', 'The advertising disclosure is a permanent line on the Programs page, not a footnote in the terms.'],
  ['Refuse plainly and say who can help', 'A blocked route names the missing permission and links to the people who can grant it.'],
];

/* -------------------------------------------------------------- rendering */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s) => s.replace(/\s+/g, '-').toLowerCase();
const GROUPS = [...new Set(SCREENS.map((s) => s.group))];

const blockHtml = ([label, items]) => `
  <div class="block">
    <p class="block-label">${esc(label)}</p>
    <ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
  </div>`;

const screenHtml = (s) => `
<article class="screen" id="${s.id}">
  <header class="screen-head">
    <div><h3>${esc(s.title)}</h3><p class="purpose">${esc(s.purpose)}</p></div>
    <code class="route">${esc(s.route)}</code>
  </header>
  <div class="blocks">${s.blocks.map(blockHtml).join('')}</div>
  ${s.messages?.length ? `<div class="msgs"><p class="msgs-label">What it says when</p><dl>${
    s.messages.map(([w, t]) => `<dt>${esc(w)}</dt><dd>${esc(t)}</dd>`).join('')}</dl></div>` : ''}
  ${(s.aside ?? []).map((a) => `<p class="aside">${esc(a)}</p>`).join('')}
</article>`;

const html = `<title>Business Dashboard UX Map</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Sans+3:wght@400;600&display=swap">
<style>
:root {
  --paper:#fbfaf9; --card:#fff; --sunk:#f2f0ee;
  --ink:#1a1a1d; --ink-2:#4a4a53; --muted:#76737c;
  --line:#e2dfdb; --line-2:#edeae7;
  --accent:#b3231e; --accent-soft:#fdf1f0;
  --good:#35604d; --good-soft:#eaf2ee;
  --f-display:"Archivo","Helvetica Neue",Arial,sans-serif;
  --f-body:"Source Sans 3",system-ui,-apple-system,sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper:#151518; --card:#1d1d21; --sunk:#26262b;
    --ink:#eae8e4; --ink-2:#c0bdc4; --muted:#928f99;
    --line:#33333a; --line-2:#2a2a30;
    --accent:#ef6a62; --accent-soft:#33211f;
    --good:#7fc4a4; --good-soft:#1d2b25;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --paper:#151518; --card:#1d1d21; --sunk:#26262b;
  --ink:#eae8e4; --ink-2:#c0bdc4; --muted:#928f99;
  --line:#33333a; --line-2:#2a2a30;
  --accent:#ef6a62; --accent-soft:#33211f;
  --good:#7fc4a4; --good-soft:#1d2b25;
  color-scheme: dark;
}
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto;padding:0 18px 80px}
header.top{border-bottom:1px solid var(--line);background:var(--card)}
.top-in{max-width:720px;margin:0 auto;padding:32px 18px 26px}
.eyebrow{font-family:var(--f-mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0}
h1{font-family:var(--f-display);font-weight:700;font-size:clamp(29px,7.5vw,42px);line-height:1.05;letter-spacing:-.02em;margin:12px 0 0;text-wrap:balance}
.standfirst{margin:14px 0 0;color:var(--ink-2);font-size:16.5px;max-width:58ch}
nav.jump{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--paper) 94%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
nav.jump ul{display:flex;gap:6px;overflow-x:auto;list-style:none;margin:0 auto;padding:10px 18px;max-width:720px;scrollbar-width:none}
nav.jump ul::-webkit-scrollbar{display:none}
nav.jump a{display:flex;align-items:center;white-space:nowrap;text-decoration:none;font-family:var(--f-mono);font-size:11.5px;letter-spacing:.04em;color:var(--ink-2);border:1px solid var(--line);border-radius:999px;padding:0 13px;min-height:36px;background:var(--card)}
nav.jump a:hover,nav.jump a:focus-visible{color:var(--ink);border-color:var(--accent)}
h2.group{font-family:var(--f-display);font-weight:600;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:44px 0 0;padding-top:16px;border-top:2px solid var(--line);scroll-margin-top:64px}
.tree{font-family:var(--f-mono);font-size:12.5px;line-height:1.85;background:var(--sunk);border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin:20px 0 0;overflow-x:auto;white-space:pre;color:var(--ink-2)}
.tree b{color:var(--ink);font-weight:600}
.tree i{color:var(--muted);font-style:normal}
.shell{display:grid;gap:14px;margin-top:20px}
.shell-card,.screen,.flow,.rule{background:var(--card);border:1px solid var(--line);border-radius:9px}
.shell-card{padding:16px 18px}
.shell-card h3{font-family:var(--f-display);font-size:17px;font-weight:650;margin:0;letter-spacing:-.008em}
.shell-card .where{font-family:var(--f-mono);font-size:11px;color:var(--muted);display:block;margin-top:3px}
.screen{padding:18px 18px 16px;margin-top:16px;scroll-margin-top:64px}
.screen-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--line-2)}
.screen-head h3{font-family:var(--f-display);font-size:21px;font-weight:650;margin:0;letter-spacing:-.014em}
.purpose{margin:3px 0 0;color:var(--ink-2);font-size:15px}
code.route{font-family:var(--f-mono);font-size:11.5px;color:var(--accent);background:var(--accent-soft);padding:4px 8px;border-radius:5px;white-space:nowrap}
.blocks{display:grid;gap:15px;margin-top:15px}
.block-label{font-family:var(--f-mono);font-size:10.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);margin:0 0 6px}
.block ul{margin:0;padding-left:18px}
.block li{font-size:15px;color:var(--ink-2);margin-bottom:4px;line-height:1.5}
.msgs{margin-top:18px;padding:14px 16px;background:var(--sunk);border-radius:8px}
.msgs-label{font-family:var(--f-mono);font-size:10.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.msgs dl{margin:0}
.msgs dt{font-family:var(--f-mono);font-size:11.5px;color:var(--accent);margin-top:11px}
.msgs dt:first-of-type{margin-top:0}
.msgs dd{margin:3px 0 0;font-size:14.5px;color:var(--ink);border-left:2px solid var(--line);padding-left:11px}
.aside{margin:16px 0 0;font-size:14.5px;color:var(--ink-2);background:var(--good-soft);border-left:2px solid var(--good);padding:11px 14px;border-radius:0 6px 6px 0}
.flow{padding:16px 18px;margin-top:14px}
.flow h3{font-family:var(--f-display);font-size:17px;font-weight:650;margin:0 0 10px}
.flow ol{margin:0;padding-left:0;list-style:none;counter-reset:step}
.flow li{counter-increment:step;position:relative;padding-left:30px;font-size:15px;color:var(--ink-2);margin-bottom:8px;line-height:1.5}
.flow li::before{content:counter(step);position:absolute;left:0;top:1px;font-family:var(--f-mono);font-size:10.5px;font-weight:600;width:20px;height:20px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center}
.voice{display:grid;gap:12px;margin-top:20px}
.rule{padding:14px 16px}
.rule h3{font-family:var(--f-display);font-size:15.5px;font-weight:650;margin:0 0 4px}
.rule p{margin:0;font-size:14.5px;color:var(--ink-2)}
.roles{overflow-x:auto;margin-top:20px;border:1px solid var(--line);border-radius:9px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:600px}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--line-2);vertical-align:top}
thead th{font-family:var(--f-mono);font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);background:var(--sunk);white-space:nowrap}
tbody tr:last-child td{border-bottom:none}
td.role{font-weight:600;color:var(--ink);white-space:nowrap}
td.n{font-variant-numeric:tabular-nums;text-align:center;font-weight:600}
footer{margin-top:48px;padding-top:20px;border-top:1px solid var(--line)}
footer p{color:var(--muted);font-size:14.5px}
footer code{font-family:var(--f-mono);font-size:12.5px;background:var(--sunk);padding:2px 6px;border-radius:4px}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>

<header class="top">
  <div class="top-in">
    <p class="eyebrow">Information architecture &middot; Android</p>
    <h1>Business Dashboard UX Map</h1>
    <p class="standfirst">
      Every section, every block inside it, and the words that actually appear
      on screen. Pulled from the running code rather than written from memory,
      so the copy here is the copy a business owner reads.
    </p>
  </div>
</header>

<nav class="jump" aria-label="Jump to section">
  <ul>
    <li><a href="#structure">Structure</a></li>
    <li><a href="#roles">By role</a></li>
    <li><a href="#shell">Shell</a></li>
    ${GROUPS.map((g) => `<li><a href="#g-${slug(g)}">${esc(g)}</a></li>`).join('\n    ')}
    <li><a href="#flows">Flows</a></li>
    <li><a href="#play">Play Store</a></li>
    <li><a href="#voice">Voice</a></li>
  </ul>
</nav>

<div class="wrap">

  <h2 class="group" id="structure">Structure</h2>
  <div class="tree">Signed out
├── <b>/login</b>              <i>Sign in</i>
├── <b>/signup</b>             <i>Create your account</i>
├── <b>/forgot-password</b>    <i>Reset your password</i>
├── <b>/terms</b> · <b>/privacy</b>    <i>legal</i>
└── <b>/offline</b>            <i>shown by the installed app with no signal</i>

Claiming
├── <b>/claim</b>              <i>search unclaimed listings</i>
└── <b>/claim/[id]</b>         <i>verify, or dispute an existing owner</i>

Signed in                <i>persistent shell wraps all of these</i>
├── <b>/dashboard</b>                  <i>Home</i>            ← tab 1
├── <b>/dashboard/inbox</b>            <i>Inbox</i>           ← tab 2
│   └── <b>/dashboard/inbox/[id]</b>   <i>Conversation</i>
├── <b>/dashboard/reviews</b>          <i>Reviews</i>         ← tab 3
├── <b>/dashboard/analytics</b>        <i>Analytics</i>       ← tab 4
│
├── <b>/dashboard/photos</b>           <i>Photos &amp; videos</i>  ┐
├── <b>/dashboard/business</b>         <i>Business info</i>   │
├── <b>/dashboard/menu</b>             <i>Menu &amp; services</i>  ├ behind “More”
├── <b>/dashboard/programs</b>         <i>Programs</i>        │
├── <b>/dashboard/billing</b>          <i>Billing</i>         │
├── <b>/dashboard/settings</b>         <i>Settings</i>        ┘
│       <i>#users · #notifications · #locations deep-link into blocks</i>
│
├── <b>/dashboard/notifications</b>    <i>Notifications</i>   <i>via the bell</i>
├── <b>/dashboard/no-access</b>        <i>No access</i>       <i>redirect target</i>
└── <b>/dashboard/switch/[id]</b>      <i>location switch</i> <i>POST only</i></div>

  <h2 class="group" id="roles">By role</h2>
  <p style="margin-top:14px;color:var(--ink-2);font-size:15px">
    Roughly half the map disappears depending on who signs in. The tab bar is
    built from what the role can actually reach, so nobody gets a tab that
    leads to a refusal.
  </p>
  <div class="roles">
    <table>
      <thead><tr>
        <th>Role</th><th>Sections</th><th>What it is for</th><th>Tab bar</th><th>Hidden</th>
      </tr></thead>
      <tbody>
        ${ROLE_VIEW.map((r) => `<tr>
          <td class="role">${esc(r.role)}</td>
          <td class="n">${r.sees}/10</td>
          <td>${esc(r.desc)}</td>
          <td>${esc(r.tabs)}</td>
          <td>${esc(r.hidden)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <h2 class="group" id="shell">Shell</h2>
  <div class="shell">
    ${SHELL.map((s) => `<div class="shell-card">
      <h3>${esc(s.name)}</h3><span class="where">${esc(s.persistent)}</span>
      <div class="blocks">${s.blocks.map(blockHtml).join('')}</div>
    </div>`).join('')}
  </div>

  ${GROUPS.map((g) => `
  <h2 class="group" id="g-${slug(g)}">${esc(g)}</h2>
  ${SCREENS.filter((s) => s.group === g).map(screenHtml).join('')}`).join('')}

  <h2 class="group" id="flows">Flows</h2>
  ${FLOWS.map((f) => `<div class="flow">
    <h3>${esc(f.name)}</h3>
    <ol>${f.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
  </div>`).join('')}

  <h2 class="group" id="play">Play Store</h2>
  <div class="voice">
    ${PLAY.map(([k, v]) => `<div class="rule"><h3>${esc(k)}</h3><p>${esc(v)}</p></div>`).join('')}
  </div>

  <h2 class="group" id="voice">Voice</h2>
  <div class="voice">
    ${VOICE.map(([r, w]) => `<div class="rule"><h3>${esc(r)}</h3><p>${esc(w)}</p></div>`).join('')}
  </div>

  <footer>
    <p>
      Regenerate with <code>node tools/build-map.mjs</code>. Copy is extracted
      from <code>src/app</code> and <code>src/components</code> on branch
      <code>claude/yelp-business-dashboard-rebuild-cmah8e</code>.
      A ⚑ marks a field that routes to human review before it publishes.
    </p>
  </footer>
</div>
`;

await writeFile(OUT, html);
console.log('written', (html.length / 1024).toFixed(0), 'KB ·',
  SCREENS.length, 'screens ·', ROLE_VIEW.length, 'roles ·', FLOWS.length, 'flows');
