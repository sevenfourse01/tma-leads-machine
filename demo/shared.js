/* =========================================================================
   TMA ONE-CLICK DEMOS — shared config, industry presets, helpers
   ========================================================================= */

/* These demos live inside the main site (/demo), so "Book a call" hands the
   prospect back to the site's own booking section rather than dead-ending.
   ⚠️ When the real scheduler exists, put the absolute URL here AND in app.js. */
/* The Framer site is the main marketing site; this subdomain hosts the demo.
   Booking goes to their contact page because there is no working scheduler yet
   — the live site's "Book a Call" still points at the Framer template author's
   calendar. Swap this for the real scheduler the moment one exists. */
const BOOKING_URL = "https://themissionautomation.com/contact";
const CONTACT_EMAIL = "adamattia@themissionautomation.com";

/* ---------- the build catalogue -----------------------------------------
   The nine entry builds from the pricing page, plus the full machine. Shared
   by the Build canvas (which colours nodes by them) and the full demo (which
   recommends them).

   `needs` is the load-bearing field: what we must see before we can integrate
   that build. None of it is knowable from a form, which is why every route
   through these demos ends at a call rather than a checkout. Deliberately no
   prices — the site prices on the diagnosis call and so do we. */
const BUILD_CATS = [
  ["capture", "Catching the enquiry", "Nothing else matters if it never reaches a human."],
  ["qualify", "Working out who's worth it", "So the best enquiry of the week isn't behind the worst."],
  ["convert", "Turning it into a sale", "Most revenue is lost after the first reply, not before it."],
  ["deliver", "Running the work",         "The admin that quietly eats a day a week."],
  ["retain",  "Getting more from the same customers", "The cheapest growth you will ever buy."],
  ["measure", "Knowing what happened",    "You cannot steer what you find out about a month late."],
  ["full",    "All of it, run for you",   "When the pieces should be one machine with a team behind it."]
];

const BUILDS = {
  /* --- capture ------------------------------------------------------- */
  SPEED: { name: "Speed-to-lead responder", days: "3 days", tier: "entry", cat: "capture", col: "#4da3ff",
    what: "Answers every new enquiry in under 60 seconds, day or night, with a live booking link.",
    needs: "your web forms, the number you take enquiries on, and your calendar",
    how: "A new enquiry lands on a webhook the moment it is submitted, whether that is your web form, a Facebook lead ad or a call that went to voicemail. The system checks it against your existing contacts, picks the right reply for that source and that time of day, and sends it by email and text inside the minute with a booking link showing your real availability. The lead, the reply and the booking all write into your CRM so nobody re-types anything. Anything it cannot classify goes to a Slack channel for one of your team, and we sit down with you before launch to sign off every piece of wording it will ever send.",
    stack: "Make.com, Twilio, OpenAI, Cal.com, HubSpot",
    fixed: "The webhook plumbing, the sub-minute send queue, retries, duplicate checks and the weekly reporting are built once and reused on every account.",
    custom: "Which enquiry sources we connect, the wording of the email and the text including the out-of-hours version, your qualifying fields and how they map to your CRM, and the calendar rules covering call length, buffer and who takes which booking type.",
    snag: "A sixty-second reply is only worth having if there is genuine availability behind it, so if your diary is already full three weeks out, sort that before you speed up the front end." },
  RESCUE: { name: "Missed-call rescue", days: "2 days", tier: "entry", cat: "capture", col: "#ffc46b",
    what: "Texts back every missed call within 30 seconds, before they ring the next name on the list.",
    needs: "your phone system and a number we can send from",
    how: "We route your inbound calls through a tracked number so the system can see when a call rings out, goes to voicemail or arrives after hours. Thirty seconds later the caller gets a text from the same number they dialled, saying who you are and asking what they need. Their reply lands in a shared inbox, WhatsApp thread or your CRM, where a person takes the conversation on; the system opens the door and nothing more. A suppression list keeps suppliers, staff mobiles and existing customers out of it, and any number that replies STOP is dropped for good.",
    stack: "Twilio, Make.com, WhatsApp Business API, Airtable, Slack",
    fixed: "The call-event listener, the thirty-second timer, opt-out and suppression handling, and the two-way message threading are the same build every time.",
    custom: "Your number routing and forwarding, the text wording and the hours it runs, the suppression list of suppliers and staff, where replies land, and who gets chased when a reply sits unanswered.",
    snag: "It means putting a tracked number in front of your existing phone line, which is a real change to how your calls are handled, and if your team already answers nearly every call there is very little left to rescue." },
  WEBCHAT: { name: "Website chat that books", days: "4 days", tier: "entry", cat: "capture", col: "#6fb7ff",
    what: "Answers the questions people actually ask on your site, and puts the ready ones straight in the diary.",
    needs: "your site, your five most common questions, and your calendar",
    how: "We read your site pages, price list and FAQ document into a searchable index, and the chat answers from that rather than from general knowledge. If the answer is not in there it says so and offers a person instead of guessing. When someone asks about price, timing or availability it takes a name and number and offers real slots from your calendar, and the booking and the full transcript go into your CRM. For the first month we go through the transcripts with you each week and add the answers it kept missing.",
    stack: "n8n, OpenAI, Supabase, Cal.com, Pipedrive",
    fixed: "The widget, the retrieval pipeline, the refusal and escalation logic, the booking handoff and the transcript store are already built.",
    custom: "The source material we index, what it is allowed to say about price, the qualifying questions it asks before offering a slot, the tone of its replies, and who gets pinged when it hands over to a human.",
    snag: "It can only answer from what you give it, so thin or contradictory source pages mean it escalates to a person often for the first few weeks, and on a site with little traffic there may not be enough conversations to justify building it at all." },
  INTAKE: { name: "Enquiry form rebuild", days: "2 days", tier: "entry", cat: "capture", col: "#8ec2ff",
    what: "One form that asks the right things, validates as it goes, and routes by answer instead of by inbox.",
    needs: "your current form and who each type of enquiry should reach",
    how: "One form replaces whatever you have now, and the questions branch, so a new-build enquiry gets different fields from a repair job and nobody sees questions that do not apply to them. Phone numbers, postcodes and emails validate as they are typed, which stops you collecting enquiries you cannot ring back. Every submission writes to a database with its source, timestamp and a duplicate check, then routes by answer: urgent goes out as a text, commercial goes to the owner, the rest goes to the pipeline. Part-finished forms are saved as well, so you can see who dropped out at which question and decide whether to chase them.",
    stack: "n8n, Supabase, Postmark, Slack, HubSpot",
    fixed: "The form engine, the validation rules, partial-submission capture, the routing framework and the database schema with duplicate detection do not change between clients.",
    custom: "The questions themselves and the branching logic, the routing table matching each answer to a person or pipeline stage, the confirmation copy, and the field mapping into your CRM.",
    snag: "Every question you add loses a few people, so you have to choose between more enquiries and better-qualified ones, and if your site sits on a platform your web agency controls we need access from them before anything can be replaced." },

  /* --- qualify ------------------------------------------------------- */
  TRIAGE: { name: "Inbox triage & draft replies", days: "4 days", tier: "entry", cat: "qualify", col: "#df7afe",
    what: "Scores each enquiry and drafts the reply in your voice. You approve, edit or bin it.",
    needs: "mailbox access and about twenty of your past replies, so we can learn how you write",
    how: "A message lands in your enquiries inbox and the system reads it within a minute. It pulls the sender's history from your CRM, works out what they are asking for, and tags the message as a new enquiry, an existing customer, a supplier or noise. It then drafts a reply in your voice, modelled on your own sent emails, and puts that draft in Gmail or in a Slack channel with approve, edit and bin buttons beside it. Nothing sends until someone on your side presses send, and we watch what you correct in the first fortnight and retune the tagging from it.",
    stack: "Make.com, Gmail API, OpenAI, HubSpot, Slack",
    fixed: "The inbox connection, the classifier, the draft-and-approve loop and the audit log of who approved what are already built and reused on every account.",
    custom: "Your message categories and what each one does next, the voice model trained on 50 to 100 of your own sent replies, the CRM fields the draft is allowed to quote, and the list of enquiry types that must never get a drafted reply at all.",
    snag: "It writes only as well as the examples you give it, so a thin sent folder or three people writing in three different voices produces bland drafts until we split the voice model per sender." },
  SCORE: { name: "Lead scoring & routing", days: "3 days", tier: "entry", cat: "qualify", col: "#c98cff",
    what: "Every enquiry gets a score and a reason in plain English, then goes to the right lane automatically.",
    needs: "a sense of what your best customer looks like, and what a time-waster looks like",
    how: "Every enquiry — web form, email, call summary — drops into one queue and is scored against rules we agree with you: budget signals, company size, service fit, how they found you, and the disqualifiers you name. The score goes back into the CRM with a short reason in plain English, so whoever picks the lead up can see why it scored 78 and disagree with it. Routing runs off that score: hot goes to a named person's phone within minutes, warm to a follow-up sequence, cold to a monthly list, junk to an archive nobody has to open. You mark the ones it got wrong, and we adjust the weights on a review call.",
    stack: "n8n, Pipedrive, OpenAI, Slack, Google Sheets",
    fixed: "The scoring engine, the plain-English reason writer, the routing table and the CRM write-back are built once and configured per client rather than rebuilt.",
    custom: "The fields that count and what each is worth, the hard disqualifiers, the score thresholds that separate the lanes, who owns each lane, and the response clock we hold each lane to.",
    snag: "The first version scores against what you believe a good lead looks like, not against what has actually closed, so treat the thresholds as provisional until roughly a hundred scored leads have reached won or lost." },
  ENRICH: { name: "Contact & company enrichment", days: "3 days", tier: "entry", cat: "qualify", col: "#9fd6b8",
    what: "Fills in who this person actually is before you call them, so you don't open cold.",
    needs: "your enquiry data and whichever enrichment source suits your market",
    how: "When a new contact reaches your CRM, the system takes the email domain and company name and queries each data source in turn, stopping at the first confident match. It fills the fields you actually use — company size, sector, Companies House number, filing status, job title, LinkedIn URL, direct phone where one exists — and writes a four-line brief on the record. Anything it could not match, or matched with low confidence, goes to a short review list instead of being written silently as fact. Your team clears that list once a day, so whoever picks up the phone opens a record that already tells them who they are ringing.",
    stack: "Make.com, Apollo, Companies House API, OpenAI, HubSpot",
    fixed: "The provider waterfall, the record-matching and de-duplication logic, the confidence flagging and the review queue are the same build every time.",
    custom: "Which fields you want filled, which paid data providers you sign up to, the wording and length of the brief, the confidence level below which a match goes to review, and the merge rules for the duplicate records already sitting in your CRM.",
    snag: "Data on small UK firms is patchy — expect a solid match on around six or seven in ten sole traders and small limited companies, and no provider will tell you which of the fields it returned are years out of date." },
  SIGNAL: { name: "Buying-signal watcher", days: "5 days", tier: "entry", cat: "qualify", col: "#7fd0a8",
    what: "Watches for the events that mean someone is about to buy, and tells you while it's still news.",
    needs: "your ideal-customer definition and the sources worth watching in your market",
    how: "We agree the events that mean something in your market — a job ad for the role your service replaces, a Companies House filing, a funding round, a director change, a new site going live — and the system checks those sources on a schedule, a few hourly and most daily. Each hit is matched against your ideal customer profile, checked against a store of what you have already been shown so the same event never fires twice, and scored for relevance. What survives lands as a card in Slack or Airtable with the evidence, the date, the named contact and a suggested opening line that refers to the event. Someone on your side decides who to approach; the watcher never contacts anyone itself.",
    stack: "Python/FastAPI, n8n, Companies House API, OpenAI, Slack, Airtable",
    fixed: "The scheduler, the source connectors, the seen-before store that kills repeats, the relevance scorer and the alert card format are already built.",
    custom: "Which events count as buying signals in your market, the source list and how often each is polled, the profile rules an alert must match, the relevance cut-off, and where alerts land and how quickly.",
    snag: "Noise is heavy at the start and signals go stale within days, so the first two weeks produce alerts you will bin, and someone has to mark them useful or not before the filter is worth trusting." },

  /* --- convert ------------------------------------------------------- */
  QUOTE: { name: "Quote & proposal generator", days: "5 days", tier: "entry", cat: "convert", col: "#ffd9a0",
    what: "Turns an enquiry into a branded quote or proposal, ready to e-sign, while it still matters.",
    needs: "your pricing rules and a recent quote we can rebuild as a template",
    how: "An enquiry arrives by form, email or a note from a call, and the system reads it into a structured record: job type, quantity, site or location, deadline. It matches those fields against your price book, builds the line items, and renders the document from your template with your branding and terms. The draft lands in a review queue rather than going straight out, so whoever prices the work checks it, edits any line, and presses send. From there it goes for e-signature and the system chases at set intervals until it is signed, declined, or you call it off.",
    stack: "Make.com, Airtable, OpenAI, PandaDoc, Stripe",
    fixed: "The enquiry parser, the template rendering engine, the approval queue, and the e-signature and chase logic are built once and reused on every client.",
    custom: "Your price book and line-item rules, the document design and terms, the approval threshold, which enquiry types can be priced automatically versus routed to a person, and the connections to your CRM and e-sign account.",
    snag: "A generator is only as good as the price book behind it, so any work that needs a site visit or a judgement call has to be routed to a human rather than guessed at, which means part of your enquiry flow still lands on your desk." },
  NURTURE: { name: "Follow-up that stops on reply", days: "4 days", tier: "entry", cat: "convert", col: "#ffc46b",
    what: "The five or six touches most people never send, in your voice, ending the second someone answers.",
    needs: "your typical sales cycle and anything you would never want said in your name",
    how: "Anyone who enquires and does not buy enters a sequence of five or six messages spread across email and SMS over two to three weeks. We draft the copy with you and you sign it off before a single message goes live, so it reads like your business rather than a template. Before every send the system checks the record: a reply, a booking, a call logged in the CRM, or an unsubscribe stops the whole sequence and alerts the owner. Anyone who reaches the end without answering is tagged and moved to the dormant list instead of being chased indefinitely.",
    stack: "n8n, Postmark, Twilio, HubSpot, Slack",
    fixed: "The sequencer, the stop-on-reply logic, the suppression list and the reporting are already built and carry over unchanged.",
    custom: "The five or six messages themselves, the gaps between them, the channel mix, what counts as a reply in your business, and how the sequence maps onto your CRM stages.",
    snag: "Stop-on-reply is only as good as the channels it can see, so if people ring you or answer from a different address and those inboxes are not wired in, someone who has already replied gets chased again, which is worse than sending nothing." },
  BOOKING: { name: "Booking & no-show recovery", days: "3 days", tier: "entry", cat: "convert", col: "#ffb3b3",
    what: "Confirms, reminds and rebooks. No-shows cost more than the advertising that produced them.",
    needs: "your calendar and how far ahead you take bookings",
    how: "The moment a booking is made the system sends a confirmation with a calendar invite and a reschedule link, then queues reminders, typically one the day before and one on the morning. Each reminder goes out by text and email carrying the same link, so moving an appointment takes a customer a couple of taps instead of a phone call. If an appointment is marked as a no-show in the calendar or CRM, a rebooking message goes out within the hour offering the next few open slots. Anyone who ignores that drops onto a short call-back list for a person to work through by phone.",
    stack: "Cal.com, Twilio, Google Calendar, Make.com, Pipedrive",
    fixed: "The reminder scheduler, the timezone and working-hours handling, the reschedule links and the no-show trigger are standard across every build.",
    custom: "Reminder timings and wording, which services get which cadence, your cancellation and deposit rules, who marks a no-show and where, and the link into your booking tool and calendar.",
    snag: "Recovery only fires if no-shows are actually marked, so if nobody updates the calendar after a missed appointment the rebooking message never sends, and this build usually asks for one small habit change from whoever runs the diary." },
  REACTIVATE: { name: "Dormant-list reactivation", days: "3 days", tier: "entry", cat: "convert", col: "#a9d3ff",
    what: "One respectful message to everyone who enquired, never bought, and went quiet. Cheapest revenue there is.",
    needs: "your old enquiry data, in whatever state it's in",
    how: "We pull your old enquiries out of the CRM, spreadsheets and inbox, dedupe them, and strip out anyone who has since bought, unsubscribed, bounced or asked not to be contacted. What remains is segmented by how old the enquiry is and where it came from, and you approve both the final list and the single message before anything sends. It goes out in small batches over several days from a warmed sending domain, so the volume does not trip spam filters or damage your main address. Replies route straight to a person rather than into a bot, because the message only works if a human picks it up.",
    stack: "Airtable, SendGrid, Twilio, OpenAI, Slack",
    fixed: "The cleaning, deduping and suppression pipeline, the batching and throttling, and the reply routing are ours and do not get rebuilt.",
    custom: "The message itself, the segments, which systems the list is pulled from, the suppression rules, and the batch size your sending domain can carry.",
    snag: "This is a one-off asset with a legal edge: under UK GDPR and PECR you can only contact people who gave you their details and have not opted out, and a list much older than two years will bounce hard enough to hurt your sending domain if it goes out in one push." },

  /* --- deliver ------------------------------------------------------- */
  CRM: { name: "Onboarding pack automation", days: "4 days", tier: "entry", cat: "deliver", col: "#8ec2ff",
    what: "Logs every touch automatically and stops anyone retyping the same details twice.",
    needs: "your CRM and its current fields, or a conversation about picking one",
    how: "When a deal moves to Won, the automation reads the fields already on the record — name, company, address, service, price — and fires the onboarding sequence off them: welcome email, intake form pre-filled with what you already hold, and a calendar link for the kick-off call. Every reply, form submission and booking writes back to that same record as a logged activity, so the timeline builds itself. If the client has not finished the intake form inside the window you set, they get a reminder; after the second one, the account manager gets a Slack message with a link to the record. TMA runs the sequence in Make.com, and you approve the email and form copy before a single message sends.",
    stack: "Make.com, HubSpot, Cal.com, SendGrid, Slack",
    fixed: "The trigger-to-sequence engine, the activity write-back and the reminder-then-escalate logic are built once and reused on every account.",
    custom: "Your CRM field mapping, the email and intake copy in your voice, the reminder windows, who receives the escalation, and the connections to your mailbox and calendar.",
    snag: "It is only as clean as the CRM behind it — if deals get marked Won a week late or the address field is blank, the pack goes out late or wrong, so field discipline usually has to be fixed first." },
  CRMBUILD: { name: "CRM build or migration", days: "5 days", tier: "entry", cat: "deliver", col: "#6fb7ff",
    what: "A CRM your team will actually use, or your existing one cleaned up and made to match how you work.",
    needs: "whatever you use today, spreadsheets included, and who needs to see what",
    how: "We start by mapping what you already have — spreadsheets, inboxes, the old CRM export — into one field list, then agree the pipeline stages with you before anything gets built. Then we build the pipeline, the required fields, the views your team actually opens each morning, and the automations that move records without anyone dragging cards. Data crosses in a dry run first: you check a sample against the source, we fix what is wrong, then we run the full import and set the old system to read-only. We train the team on the two or three screens they need and stay on for a fortnight to fix whatever surfaces in real use.",
    stack: "HubSpot, Pipedrive, Airtable, Python, Make.com",
    fixed: "The migration method — field mapping template, deduplication rules, dry-run import and rollback — is the same on every build.",
    custom: "Your pipeline stages, field list, required-field rules, user permissions, the views and reports each role sees, and the links to your inbox, calendar, quoting and accounting tools.",
    snag: "The hard part is adoption, not the build: if your reps keep deals in their heads or their phone notes, a new CRM changes nothing, so we design the smallest daily habit that works and hold you to it." },
  DOCS: { name: "Document & contract automation", days: "4 days", tier: "entry", cat: "deliver", col: "#b7c0cc",
    what: "Contracts, packs and onboarding paperwork generated, sent and chased without anyone opening Word.",
    needs: "your templates and the fields that change between clients",
    how: "The trigger is normally a deal reaching a stage or a form being submitted: the system pulls that record's fields into the document template, generates the PDF and puts it in front of you before it goes anywhere. Once you approve, it sends for e-signature and files the sent copy against the CRM record and in the client folder on Drive. If nobody signs, the chase runs on the schedule you set — two emails and a text on day seven, say — and stops the moment the signature lands. Signature events write back to the CRM, so the stage moves without anyone updating it by hand.",
    stack: "Make.com, PandaDoc, Google Drive, HubSpot, Twilio",
    fixed: "The generate, approve, send, chase and file loop, including the stop-on-signature rule and the audit trail, is built once and reused.",
    custom: "Your templates and clause variants, which record fields fill which merge tags, who holds the approval step, the chase timing and channels, and the folder structure documents land in.",
    snag: "Automation does not make a contract sound — we only merge fields into wording your solicitor has already signed off, and anything that genuinely varies per deal, like liability or bespoke pricing, stays a manual edit." },
  CALLS: { name: "Call notes into your CRM", days: "3 days", tier: "entry", cat: "deliver", col: "#dfb2ff",
    what: "Calls transcribed, summarised and filed against the right record, with the actions pulled out.",
    needs: "how you take calls today and where the notes should land",
    how: "The recording comes from wherever the call already happens — Zoom, Teams or a mobile dialler — and lands in a queue the moment it ends. It gets transcribed, then a model writes a short summary in a fixed shape: what was discussed, what was agreed, objections raised, next step and date. Matching is done on phone number or email against the CRM, and anything the system cannot match confidently goes to a review list rather than being filed against the wrong company. Actions become tasks on the record with an owner and a due date, and the rep gets the summary in Slack within a few minutes so they can correct it while the call is still fresh.",
    stack: "Make.com, OpenAI, Zoom, HubSpot, Slack",
    fixed: "The transcription pipeline, the summary structure, the match-or-review rule and the task creation are identical on every account.",
    custom: "Your call sources and recording permissions, the summary fields your team cares about, the matching keys, which actions become tasks and who owns them, and the CRM object the notes are written to.",
    snag: "Accuracy drops on poor mobile lines, crosstalk and strong accents, so summaries stay an editable draft rather than gospel — and every participant has to be told the call is being recorded." },

  /* --- retain -------------------------------------------------------- */
  REVIEW: { name: "Review & referral engine", days: "3 days", tier: "entry", cat: "retain", col: "#a9d3ff",
    what: "Asks for the review at the moment people are happiest, and routes the unhappy ones to you first.",
    needs: "your Google or Trustpilot profile and a signal for when a job is finished",
    how: "The trigger is the moment a job is marked complete or an invoice is paid in your system. Two to twenty-four hours later the customer gets one short message asking how it went. A positive reply gets a direct link to your Google listing with the review box already open; a lukewarm or negative one goes to your phone and a private Slack channel, so you hear it before anyone else does and can ring them. Once a review posts, the same thread asks whether they know someone else who needs the same job doing, and that name lands in your CRM as a task for a person to call.",
    stack: "Make.com, Twilio, Google Business Profile API, Airtable, Slack",
    fixed: "The trigger-and-delay logic, the reply scoring, the review link handling, the private escalation alert and the referral follow-up are already built and reused on every account.",
    custom: "The system that fires the trigger and its field mapping, the delay window, the wording and sender name on both messages, which review sites you point at (Google, Trustpilot, Checkatrade), the score that counts as unhappy, and the referral offer.",
    snag: "Google's rules prohibit only asking happy customers for public reviews, so everyone gets asked and the routing changes who hears first rather than who gets the request, which means some negative reviews will still be posted." },
  CONTENT: { name: "Content repurposer", days: "4 days", tier: "entry", cat: "retain", col: "#dfb2ff",
    what: "Turns one recording into a week of platform-native posts, queued for your approval.",
    needs: "a recent recording and a sense of what you would never want posted",
    how: "You drop a recording into a folder or paste a link: a client call, a podcast episode, a voice note recorded in the van. It gets transcribed, cut into the handful of ideas worth publishing, and rewritten for each platform, a LinkedIn post, a short thread, an Instagram caption, a newsletter section, all following a voice guide we build from twenty or thirty things you have already written. The drafts land in a queue with approve, edit or bin next to each one. Only what you tick gets scheduled, and nothing goes out on its own.",
    stack: "Make.com, OpenAI Whisper, OpenAI, Airtable, Ayrshare",
    fixed: "The ingest, transcription, segmentation, per-platform draft prompts, approval queue and scheduler are the same build every time.",
    custom: "The voice guide trained on your back catalogue, which platforms and how many posts per recording, the posting cadence, claims and words you are not allowed to use, product and brand spellings, and the links each post ends on.",
    snag: "The output is bounded by the input, so a rambling recording produces rambling drafts, and the queue only works if someone spends fifteen minutes a week clearing it." },
  WINBACK: { name: "Past-customer win-back", days: "3 days", tier: "entry", cat: "retain", col: "#e2c6ff",
    what: "The people who already bought once are the likeliest to buy again, and the least likely to be asked.",
    needs: "your customer history and what a sensible repeat interval looks like",
    how: "We pull your customer history out of the CRM, booking system or till, clear the duplicates, and work out how long it has been since each person last bought. Every service line gets its own interval, so a boiler service comes round at eleven months and a haircut at six weeks, and we suppress anyone currently active, mid-quote, complaining, or opted out. When someone crosses their interval they get an email, then a text a few days later if nothing comes back. Replies go to a person, not a bot: they land in your inbox or WhatsApp with that customer's purchase history attached.",
    stack: "n8n, Supabase, Postmark, Twilio, Pipedrive",
    fixed: "The deduplication, the interval engine, the suppression rules, the email-then-SMS sequencing and the reply routing are prebuilt.",
    custom: "The interval per service line, the offer and message copy, the connector and field mapping to your CRM or till, what counts as an active customer, the daily send cap, and who replies land with.",
    snag: "Old lists decay, so expect a share of dead addresses and wrong numbers, and anyone who falls outside PECR's soft opt-in for existing customers has to be left out, which usually makes the usable list smaller than the export suggests." },

  /* --- measure ------------------------------------------------------- */
  DASH: { name: "Live KPI dashboard", days: "5 days", tier: "entry", cat: "measure", col: "#b7c0cc",
    what: "One screen with the numbers that matter, updated live, so Monday stops being a guess.",
    needs: "read access to wherever those numbers live today, however messy that is",
    how: "We start with a session to agree what each number means, because a lead usually means three different things across your ad accounts, your CRM and your head. Connectors then pull from those sources on a schedule into one database we run, so every figure is calculated the same way rather than re-counted by hand each Monday. The screen carries the ten or so numbers that change decisions: enquiries, cost per enquiry, quotes out, jobs won, revenue, and how each compares to the same period last month. Slack gets a message when a number crosses a line you set, and we send a short written note each week on what moved.",
    stack: "n8n, Postgres, Python/FastAPI, Metabase, Slack",
    fixed: "The database schema, the scheduled pulls with retry and token refresh, the alerting layer and the chart templates are already built.",
    custom: "Which sources connect, the definition and SQL behind each metric, how a lead and a won job are counted, the targets and alert thresholds, and who can see which screen.",
    snag: "A dashboard inherits the discipline of the systems feeding it, so if deals sit in the wrong CRM stage or jobs are closed late the screen will report it confidently and wrongly." },
  ATTRIB: { name: "Where your leads actually come from", days: "4 days", tier: "entry", cat: "measure", col: "#9fd6b8",
    what: "Tracks each enquiry back to what produced it, so you stop guessing which half of the budget works.",
    needs: "your ad accounts, your site and the point where an enquiry becomes a sale",
    how: "A small script on your site records where each visitor came from the first time and the last time, and keeps it in your database rather than a third party's. When they submit a form, book a call or ring a tracked number, that history attaches to the enquiry, and a single how-did-you-hear field catches the ones no tracking can see. The record follows them into the CRM, so when a deal is won the source travels with it and you can read the report at revenue rather than at click. Once a month we reconcile it against what the ad platforms claim and tell you where the two disagree.",
    stack: "Python/FastAPI, Postgres, Twilio, HubSpot, Metabase",
    fixed: "The tracking script, the visitor stitching, the touch storage, the CRM write-back and the reporting views are the same on every build.",
    custom: "Which forms, booking tools and phone numbers get wired in, your channel naming and UTM convention, the wording of the self-report question, the CRM fields written to, and the attribution window.",
    snag: "Attribution is directional, not exact: browser cookie limits, ad blockers, and people who research on a phone and buy on a laptop mean the numbers will never reconcile to the penny with what the ad platforms report." },

  /* --- the whole thing ------------------------------------------------ */
  MACHINE: { name: "THE MACHINE: the full build", days: "about 3 weeks", tier: "core", cat: "full", col: "#e2c6ff",
    what: "The whole engine, run by our team against a budget you set: sourcing, research, drafting, sending and reporting.",
    needs: "the full diagnosis. Your economics, your stack, your deliverability and your compliance position",
    how: "You set a monthly budget and approve the customer profile and the angles, and we run everything underneath it. Each week we source companies that match, check them against buying signals such as hiring, funding or a new site, verify the contact details, and write a short research brief on each account before anything is drafted. Messages are written against your approved angles and we read every batch before it leaves; sending runs across separate warmed domains with daily caps, so your main company address is not the one doing the sending. Replies reach a human first, the positive ones go into your calendar and CRM, and you get a weekly report on what was sent, what came back and what the budget bought.",
    stack: "Python/FastAPI, OpenAI, Smartlead, Supabase, HubSpot",
    fixed: "The sourcing, enrichment and verification pipeline, the research and drafting steps, the sending infrastructure pattern, reply classification and the reporting are already built and run across every client.",
    custom: "The customer profile and sourcing filters, the signals watched, the offer and message angles, how many domains and inboxes the budget supports, the calendar and CRM connections, and the report format.",
    snag: "New sending domains need two to four weeks of warm-up before they carry real volume, so the first month produces list and message data more than conversations, and the whole thing stalls if nobody on your side takes the calls that come from it." }
};

/* ---------- industry presets -------------------------------------------- */
/* Illustrative sector defaults — used to prefill the Predict form and to
   personalise Build & Grow. Every number a prospect sees that comes from
   here is labelled example/modelled. */
const PRESETS = {
  dental: {
    label: "Dental clinic", plural: "dental clinics",
    company: "Example dental practice",
    noun: "patients", enquiry: "patient enquiries", deal: "treatment plan",
    avgValue: 1400, monthlyLeads: 55, closeRate: 22,
    channels: ["Google Ads", "Meta lead ads", "Referrals"],
    leadNames: ["Sarah M", "James O", "Priya K", "Tom H", "Elena R"],
    services: ["Invisalign consult", "Implant enquiry", "Whitening", "New patient exam", "Emergency"],
    build: {
      trigger: "New patient enquiry", triggerSub: "Webform · Meta lead ad · missed call",
      book: "Book consultation", bookSub: "Practice diary · Dentally / SOE",
      nurture: "Treatment nurture", nurtureSub: "5-touch · Invisalign & implants",
      escalate: "Front desk hand-off", crm: "Patient CRM upsert"
    }
  },
  aesthetics: {
    label: "Aesthetics clinic", plural: "aesthetics clinics",
    company: "Example aesthetics clinic",
    noun: "clients", enquiry: "consultation enquiries", deal: "treatment package",
    avgValue: 900, monthlyLeads: 70, closeRate: 25,
    channels: ["Instagram", "Meta lead ads", "Google Ads"],
    leadNames: ["Amelia W", "Chloe D", "Nadia S", "Grace L", "Yasmin A"],
    services: ["Skin consult", "Filler enquiry", "Laser package", "Profhilo", "Consultation"],
    build: {
      trigger: "New consult enquiry", triggerSub: "IG DM · Meta lead ad · webform",
      book: "Book consultation", bookSub: "Clinic diary · Phorest / Timely",
      nurture: "Treatment nurture", nurtureSub: "5-touch · before/after led",
      escalate: "Clinic manager hand-off", crm: "Client CRM upsert"
    }
  },
  hvac: {
    label: "HVAC / home services", plural: "HVAC and home-services businesses",
    company: "Example HVAC company",
    noun: "customers", enquiry: "job enquiries", deal: "installation",
    avgValue: 3200, monthlyLeads: 40, closeRate: 30,
    channels: ["Google LSA", "Google Ads", "Checkatrade"],
    leadNames: ["Mark T", "Susan B", "Dev P", "Karen W", "Liam F"],
    services: ["AC install quote", "Boiler service", "Emergency call-out", "Heat pump survey", "Maintenance plan"],
    build: {
      trigger: "New job enquiry", triggerSub: "LSA call · webform · WhatsApp",
      book: "Book survey visit", bookSub: "Engineer calendar · ServiceM8",
      nurture: "Quote follow-up", nurtureSub: "5-touch · quote expiry led",
      escalate: "On-call engineer alert", crm: "Job CRM upsert"
    }
  },
  recruitment: {
    label: "Recruitment agency", plural: "recruitment agencies",
    company: "Example recruitment agency",
    noun: "clients", enquiry: "client briefs", deal: "placement",
    avgValue: 7500, monthlyLeads: 18, closeRate: 28,
    channels: ["LinkedIn", "Cold email", "Referrals"],
    leadNames: ["FinServ Co", "TechScale Ltd", "BuildGroup", "MedStaff", "RetailOne"],
    services: ["Perm role brief", "Contract brief", "Exec search", "Volume hire", "Retained search"],
    build: {
      trigger: "New client brief", triggerSub: "LinkedIn · email · webform",
      book: "Book intake call", bookSub: "Consultant calendar",
      nurture: "BD nurture", nurtureSub: "5-touch · market-insight led",
      escalate: "Consultant hand-off", crm: "ATS / CRM upsert"
    }
  },
  ifa: {
    label: "Financial adviser (IFA)", plural: "financial advice firms",
    company: "Example advisory firm",
    noun: "clients", enquiry: "advice enquiries", deal: "new client",
    avgValue: 4200, monthlyLeads: 25, closeRate: 18,
    channels: ["Referrals", "Unbiased/VouchedFor", "Seminars"],
    leadNames: ["R Thompson", "A Patel", "M Hughes", "C Osei", "J Whitfield"],
    services: ["Pension review", "Retirement planning", "Inheritance planning", "Investment review", "Protection"],
    build: {
      trigger: "New advice enquiry", triggerSub: "Webform · referral · directory",
      book: "Book discovery meeting", bookSub: "Adviser calendar · compliant capture",
      nurture: "Advice nurture", nurtureSub: "5-touch · education led · FCA-aware",
      escalate: "Adviser hand-off", crm: "Back-office upsert"
    }
  },
  vet: {
    label: "Veterinary practice", plural: "veterinary practices",
    company: "Example veterinary practice",
    noun: "clients", enquiry: "new-client enquiries", deal: "registered client",
    avgValue: 650, monthlyLeads: 60, closeRate: 35,
    channels: ["Google Ads", "Facebook", "Word of mouth"],
    leadNames: ["Bella (lab)", "Milo (cat)", "Rex (GSD)", "Poppy (spaniel)", "Nala (cat)"],
    services: ["New pet registration", "Dental enquiry", "Vaccination plan", "Neutering", "Health plan"],
    build: {
      trigger: "New client enquiry", triggerSub: "Webform · Facebook · missed call",
      book: "Book first appointment", bookSub: "Practice diary",
      nurture: "Registration nurture", nurtureSub: "5-touch · health-plan led",
      escalate: "Reception hand-off", crm: "PMS upsert"
    }
  },
  estate: {
    label: "Estate agency", plural: "estate agencies",
    company: "Example estate agency",
    noun: "vendors and landlords", enquiry: "valuation enquiries", deal: "instruction",
    avgValue: 3200, monthlyLeads: 45, closeRate: 24,
    channels: ["Rightmove", "Google Ads", "Meta lead ads"],
    leadNames: ["David P", "Aisha B", "Mark T", "Chloe W", "Raj S"],
    services: ["Free valuation", "Viewing request", "Landlord lettings", "Property management", "Rent appraisal"],
    build: {
      trigger: "New valuation request", triggerSub: "Rightmove · webform · missed call",
      book: "Book valuation", bookSub: "Branch diary · Reapit / Alto",
      nurture: "Vendor nurture", nurtureSub: "6-touch · market update & fee offer",
      escalate: "Senior valuer hand-off", crm: "Vendor CRM upsert"
    }
  },
  law: {
    label: "Law firm", plural: "law firms",
    company: "Example law firm",
    noun: "clients", enquiry: "case enquiries", deal: "matter",
    avgValue: 1800, monthlyLeads: 60, closeRate: 28,
    channels: ["Google Ads", "Estate agent referrals", "Reallymoving"],
    leadNames: ["Helen C", "Michael A", "Nadia F", "Peter G", "Sophie L"],
    services: ["Conveyancing quote", "Wills & LPA", "Probate enquiry", "Transfer of equity", "Family / divorce"],
    build: {
      trigger: "New matter enquiry", triggerSub: "Webform · quote tool · missed call",
      book: "Book initial call", bookSub: "Fee earner diary · Clio / LEAP",
      nurture: "Quote follow-up", nurtureSub: "5-touch · quote chase & timescales",
      escalate: "Fee earner hand-off", crm: "Matter CRM upsert"
    }
  },
  accounting: {
    label: "Accountancy practice", plural: "accountancy practices",
    company: "Example accountancy practice",
    noun: "clients", enquiry: "client enquiries", deal: "engagement",
    avgValue: 2400, monthlyLeads: 25, closeRate: 28,
    channels: ["Google Ads", "Client referrals", "LinkedIn"],
    leadNames: ["Harlow Joinery Ltd", "Nova Fitness Ltd", "Kerr Logistics", "Bright Lettings Ltd", "Trent & Co"],
    services: ["Year-end accounts", "VAT & bookkeeping", "Payroll setup", "Company formation", "Self assessment"],
    build: {
      trigger: "New client enquiry", triggerSub: "Webform · Google Ads · missed call",
      book: "Book discovery call", bookSub: "Partner diary · Karbon / IRIS",
      nurture: "Proposal follow-up", nurtureSub: "5-touch · proposal chase & switch guide",
      escalate: "Partner hand-off", crm: "Practice CRM upsert"
    }
  },
  mortgage: {
    label: "Mortgage broker", plural: "mortgage brokers",
    company: "Example mortgage brokerage",
    noun: "clients", enquiry: "mortgage enquiries", deal: "mortgage case",
    avgValue: 1350, monthlyLeads: 45, closeRate: 26,
    channels: ["Estate agent referrals", "Google Ads", "Unbiased"],
    leadNames: ["Daniel W", "Aisha B", "Mark T", "Sophie L", "Ryan P"],
    services: ["First-time buyer", "Remortgage", "Buy-to-let", "Product transfer", "Protection review"],
    build: {
      trigger: "New mortgage enquiry", triggerSub: "Webform · Unbiased lead · missed call",
      book: "Book fact-find", bookSub: "Adviser diary · Acre / Smartr365",
      nurture: "Rate & renewal nurture", nurtureSub: "6-touch · remortgage & protection",
      escalate: "Adviser hand-off", crm: "Client CRM upsert"
    }
  },
  msp: {
    label: "IT support / MSP", plural: "managed service providers",
    company: "Example IT support firm",
    noun: "clients", enquiry: "new client enquiries", deal: "support contract",
    avgValue: 12000, monthlyLeads: 12, closeRate: 20,
    channels: ["Referral partners", "Google Ads", "LinkedIn Ads"],
    leadNames: ["Halston Legal", "Brightside Care", "Meridian Logistics", "Kerr & Co Accounts", "Vantage Engineering"],
    services: ["Managed IT support", "Microsoft 365 migration", "Cyber Essentials", "Server / cloud migration", "VoIP phone system"],
    build: {
      trigger: "New client enquiry", triggerSub: "Webform · LinkedIn · inbound call",
      book: "Book discovery call", bookSub: "Sales diary · HubSpot / Outlook",
      nurture: "Contract nurture", nurtureSub: "6-touch · Cyber Essentials & M365",
      escalate: "Account director hand-off", crm: "Client CRM upsert"
    }
  },
  agency: {
    label: "Marketing agency", plural: "marketing agencies",
    company: "Example marketing agency",
    noun: "clients", enquiry: "new business enquiries", deal: "retainer",
    avgValue: 7200, monthlyLeads: 22, closeRate: 15,
    channels: ["Referrals", "LinkedIn Ads", "Google Ads"],
    leadNames: ["Harlow Fitness", "Verity Legal", "Northgate Homes", "BrightPath SaaS", "Calder & Co"],
    services: ["Paid social retainer", "SEO retainer", "Website rebuild", "Brand refresh", "Lead gen sprint"],
    build: {
      trigger: "New business enquiry", triggerSub: "Webform · LinkedIn DM · referral intro",
      book: "Book discovery call", bookSub: "Calendly · HubSpot deal created",
      nurture: "Pitch follow-up nurture", nurtureSub: "5-touch · case studies & proposal chase",
      escalate: "Account director hand-off", crm: "Pipeline CRM upsert"
    }
  },
  construction: {
    label: "Construction & trades", plural: "building contractors",
    company: "Example building contractor",
    noun: "homeowners", enquiry: "project enquiries", deal: "build contract",
    avgValue: 24000, monthlyLeads: 28, closeRate: 15,
    channels: ["Checkatrade", "Google Ads", "Word of mouth"],
    leadNames: ["Dave R", "Claire T", "Mo A", "Helen B", "Ryan P"],
    services: ["Rear extension", "Loft conversion", "Full house renovation", "Kitchen refit", "Garage conversion"],
    build: {
      trigger: "New project enquiry", triggerSub: "Webform · Checkatrade · missed call",
      book: "Book site visit", bookSub: "Site diary · Tradify / Powered Now",
      nurture: "Quote follow-up", nurtureSub: "5-touch · after quote sent",
      escalate: "Estimator hand-off", crm: "Job pipeline upsert"
    }
  },
  solar: {
    label: "Solar & renewables", plural: "solar installers",
    company: "Example solar installer",
    noun: "homeowners", enquiry: "install enquiries", deal: "system install",
    avgValue: 8500, monthlyLeads: 50, closeRate: 18,
    channels: ["Meta lead ads", "Google Ads", "MCS directory"],
    leadNames: ["Gavin S", "Nadia H", "Peter W", "Sofia L", "Craig D"],
    services: ["Solar PV survey", "Battery storage", "Solar + battery", "EV charger", "Air source heat pump"],
    build: {
      trigger: "New install enquiry", triggerSub: "Meta lead ad · webform · quote tool",
      book: "Book roof survey", bookSub: "Surveyor diary · OpenSolar / Pylon",
      nurture: "Quote nurture", nurtureSub: "6-touch · payback & battery upsell",
      escalate: "Sales surveyor hand-off", crm: "Install CRM upsert"
    }
  },
  cleaning: {
    label: "Commercial cleaning", plural: "commercial cleaning contractors",
    company: "Example cleaning contractor",
    noun: "clients", enquiry: "cleaning enquiries", deal: "cleaning contract",
    avgValue: 8400, monthlyLeads: 30, closeRate: 20,
    channels: ["Google Ads", "Managing agent referrals", "Bark"],
    leadNames: ["Kingsway Offices", "Bramley Dental", "Orbit Logistics", "St Anne's School", "Meridian Gym"],
    services: ["Office daily clean", "Communal area clean", "Deep clean / one-off", "Washroom services", "End of tenancy"],
    build: {
      trigger: "New cleaning enquiry", triggerSub: "Webform · Bark lead · missed call",
      book: "Book site survey", bookSub: "Ops diary · Joblogic / Timegate",
      nurture: "Quote & tender nurture", nurtureSub: "5-touch · quote chase & renewal dates",
      escalate: "Ops manager hand-off", crm: "Contract CRM upsert"
    }
  },
  gym: {
    label: "Gym / fitness studio", plural: "gyms and fitness studios",
    company: "Example fitness studio",
    noun: "members", enquiry: "membership enquiries", deal: "membership",
    avgValue: 540, monthlyLeads: 90, closeRate: 28,
    channels: ["Meta lead ads", "Google Ads", "Referrals & walk-ins"],
    leadNames: ["Chloe B", "Marcus T", "Aisha N", "Danny W", "Sophie L"],
    services: ["Monthly membership", "Free trial pass", "Personal training", "Class pack", "Student / off-peak"],
    build: {
      trigger: "New membership enquiry", triggerSub: "Meta lead ad · webform · walk-in",
      book: "Book tour or trial", bookSub: "Studio diary · Glofox / TeamUp",
      nurture: "Trial follow-up", nurtureSub: "5-touch · trial to direct debit",
      escalate: "Membership advisor hand-off", crm: "Member CRM upsert"
    }
  },
  physio: {
    label: "Physiotherapy clinic", plural: "physiotherapy clinics",
    company: "Example physio clinic",
    noun: "patients", enquiry: "patient enquiries", deal: "course of treatment",
    avgValue: 320, monthlyLeads: 45, closeRate: 34,
    channels: ["Google Ads", "Google Business Profile", "GP & insurer referrals"],
    leadNames: ["Rachel P", "Dev S", "Karen A", "Liam F", "Nina G"],
    services: ["Back & neck pain", "Sports injury", "Post-op rehab", "Sciatica assessment", "Sports massage"],
    build: {
      trigger: "New patient enquiry", triggerSub: "Webform · Google call · missed call",
      book: "Book initial assessment", bookSub: "Clinic diary · Cliniko / TM3",
      nurture: "Rehab plan nurture", nurtureSub: "5-touch · rebooking & block plans",
      escalate: "Clinic manager hand-off", crm: "Patient record upsert"
    }
  },
  education: {
    label: "Tutoring & training", plural: "tutoring and training providers",
    company: "Example tutoring provider",
    noun: "students", enquiry: "tuition enquiries", deal: "tuition package",
    avgValue: 650, monthlyLeads: 40, closeRate: 25,
    channels: ["Google Ads", "Tutorful / MyTutor", "Parent referrals"],
    leadNames: ["Hannah W", "Omar Q", "Claire D", "Ben I", "Maya S"],
    services: ["GCSE maths", "A-level sciences", "11+ preparation", "English & literacy", "Adult upskilling course"],
    build: {
      trigger: "New tuition enquiry", triggerSub: "Webform · Tutorful lead · missed call",
      book: "Book consultation call", bookSub: "Tutor diary · TutorCruncher / Teachworks",
      nurture: "Enrolment nurture", nurtureSub: "5-touch · trial lesson & term blocks",
      escalate: "Head tutor hand-off", crm: "Student CRM upsert"
    }
  },
  other: {
    label: "Something else", plural: "service businesses",
    company: "Example service business",
    noun: "customers", enquiry: "new enquiries", deal: "job",
    avgValue: 1800, monthlyLeads: 45, closeRate: 25,
    channels: ["Google Ads", "Website & SEO", "Referrals"],
    leadNames: ["Daniel W", "Aisha R", "Mark T", "Lucy P", "Ben K"],
    services: ["Quote request", "Pricing enquiry", "Site visit", "Callback request", "Existing customer"],
    build: {
      trigger: "New customer enquiry", triggerSub: "Webform · Missed call · Live chat",
      book: "Book a call", bookSub: "Calendar sync · Google / Outlook",
      nurture: "Follow-up nurture", nurtureSub: "5-touch · Email & SMS",
      escalate: "Sales team hand-off", crm: "CRM record upsert"
    }
  }
};

/* ---------- profile (persisted across the three demos) ------------------ */
const PROFILE_KEY = "tma-oneclick:profile";
function getProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    if (!PRESETS[p.industry]) p.industry = "dental";
    return p;
  } catch { return { industry: "dental" }; }
}
function saveProfile(patch) {
  const p = Object.assign(getProfile(), patch);
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
  return p;
}
function companyName() {
  const p = getProfile();
  return (p.name && p.name.trim()) || PRESETS[p.industry].company;
}

/* ---------- formatting --------------------------------------------------- */
/* The sign goes before the currency symbol, not after it. This engine is
   allowed to return a loss, so "£-108,000" is a shape these functions must
   actually get right rather than an edge case. */
const fmtGBP = n => (n < 0 ? "−£" : "£") + Math.round(Math.abs(n)).toLocaleString("en-GB");
const fmtGBPk = n => {
  const a = Math.abs(n), sign = n < 0 ? "−£" : "£";
  if (a >= 1e6) return sign + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "m";   /* not "£1330k" */
  if (a >= 1000) return sign + (a / 1000).toFixed(a >= 10000 ? 0 : 1) + "k";
  return fmtGBP(n);
};
const fmtPct = n => Math.round(n) + "%";

/* ---------- tiny DOM helpers --------------------------------------------- */
const $  = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

function toast(msg) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

/* Booking buttons: honest no-op until BOOKING_URL is set (same as tma-site) */
function wireBooking() {
  /* Embedded on another site, "Book a call" must leave the iframe: without
     _top it loads this site inside the host page's own layout. ?book=<url>
     lets the host pass its own booking page, which is the one its visitors
     expect to land on. */
  const q = new URLSearchParams(location.search);
  const embedded = q.get("embed") === "1";
  const url = q.get("book") || BOOKING_URL;

  $$("[data-book]").forEach(a => {
    if (url) {
      a.setAttribute("href", url);
      if (embedded) a.setAttribute("target", "_top");
      else if (/^https?:/i.test(url)) a.setAttribute("target", "_blank");
    }
    else a.addEventListener("click", e => {
      e.preventDefault();
      toast("Booking link coming soon — email " + CONTACT_EMAIL);
    });
  });
}

/* ---------- embed mode ---------------------------------------------------
   ?embed=1 strips the nav and footer so the page can sit inside an iframe on
   another site (the Framer one) without showing a second set of navigation.
   It also posts its height to the parent on change, so a Framer embed can be
   sized to the content instead of guessing and leaving a dead scroll area. */
function applyEmbedMode() {
  const p = new URLSearchParams(location.search);
  if (p.get("embed") !== "1") return;
  document.body.classList.add("embed");
  $$("[data-chrome]").forEach(el => el.remove());

  const post = () => {
    const h = Math.ceil(document.documentElement.scrollHeight);
    parent.postMessage({ tmaEmbedHeight: h, source: location.pathname }, "*");
  };
  post();
  addEventListener("load", post);
  if (window.ResizeObserver) new ResizeObserver(post).observe(document.body);
}

/* ---------- reveal on scroll (with the non-firing-observer backstop) ----- */
function initReveal() {
  const els = $$(".rv");
  const show = el => el.classList.add("in");
  if (!("IntersectionObserver" in window)) { els.forEach(show); return; }
  /* stagger what enters together by 70ms, same as the site — revealing a
     three-card grid all at once pops as one block instead of composing */
  const io = new IntersectionObserver(entries => {
    let k = 0;
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.style.transitionDelay = Math.min(k++, 5) * 70 + "ms";
      show(en.target); io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach(el => io.observe(el));
  /* backstop: never leave the page blank if IO doesn't fire (hidden tab etc.) */
  setTimeout(() => els.forEach(show), 2600);
}

/* ---------- industry picker (rendered on each demo page) ----------------- */
/* Nineteen niches as nineteen buttons is a wall of choice before a visitor has
   done anything. As a select it is one control, and the list still says "we do
   yours" the moment it opens. */
function renderPickerSelect(sel, onChange) {
  const p = getProfile();
  sel.innerHTML = Object.entries(PRESETS)
    .map(([id, cfg]) => `<option value="${id}"${id === p.industry ? " selected" : ""}>${cfg.label}</option>`)
    .join("");
  sel.addEventListener("change", () => {
    saveProfile({ industry: sel.value });
    onChange && onChange(sel.value);
  });
}

function renderPicker(container, onChange) {
  const p = getProfile();
  container.innerHTML = "";
  Object.entries(PRESETS).forEach(([id, cfg]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pick" + (id === p.industry ? " on" : "");
    b.textContent = cfg.label;
    b.addEventListener("click", () => {
      saveProfile({ industry: id });
      $$(".pick", container).forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      onChange && onChange(id);
    });
    container.appendChild(b);
  });
}

function wireNameInput(input, onChange) {
  const p = getProfile();
  if (p.name) input.value = p.name;
  input.addEventListener("input", () => {
    saveProfile({ name: input.value });
    onChange && onChange();
  });
}

document.addEventListener("DOMContentLoaded", () => { initReveal(); wireBooking(); });
