/* =========================================================================
   TMA ONE-CLICK DEMOS — shared config, industry presets, helpers
   ========================================================================= */

/* These demos live inside the main site (/demo), so "Book a call" hands the
   prospect back to the site's own booking section rather than dead-ending.
   ⚠️ When the real scheduler exists, put the absolute URL here AND in app.js. */
const BOOKING_URL = "../index.html#book";
const CONTACT_EMAIL = "hello@themissionautomation.com";  // confirm before launch

/* ---------- the build catalogue -----------------------------------------
   The nine entry builds from the pricing page, plus the full machine. Shared
   by the Build canvas (which colours nodes by them) and the full demo (which
   recommends them).

   `needs` is the load-bearing field: what we must see before we can integrate
   that build. None of it is knowable from a form, which is why every route
   through these demos ends at a call rather than a checkout. Deliberately no
   prices — the site prices on the diagnosis call and so do we. */
const BUILDS = {
  SPEED: { name: "Speed-to-lead responder", days: "3 days", tier: "entry", col: "#4da3ff",
    what: "Answers every new enquiry in under 60 seconds, day or night, with a live booking link.",
    needs: "your web forms, the number you take enquiries on, and your calendar" },
  RESCUE: { name: "Missed-call rescue", days: "2 days", tier: "entry", col: "#ffc46b",
    what: "Texts back every missed call within 30 seconds, before they ring the next name on the list.",
    needs: "your phone system and a number we can send from" },
  TRIAGE: { name: "Inbox triage & draft replies", days: "4 days", tier: "entry", col: "#df7afe",
    what: "Scores each enquiry and drafts the reply in your voice. You approve, edit or bin it.",
    needs: "mailbox access and about twenty of your past replies, so we can learn how you write" },
  QUOTE: { name: "Quote & proposal generator", days: "5 days", tier: "entry", col: "#ffd9a0",
    what: "Turns an enquiry into a branded quote or proposal, ready to e-sign, while it still matters.",
    needs: "your pricing rules and a recent quote we can rebuild as a template" },
  SIGNAL: { name: "Buying-signal watcher", days: "5 days", tier: "entry", col: "#9fd6b8",
    what: "Watches for the events that mean someone is about to buy, and tells you while it's still news.",
    needs: "your ideal-customer definition and the sources worth watching in your market" },
  REVIEW: { name: "Review & referral engine", days: "3 days", tier: "entry", col: "#a9d3ff",
    what: "Asks for the review at the moment people are happiest, and routes the unhappy ones to you first.",
    needs: "your Google or Trustpilot profile and a signal for when a job is finished" },
  DASH: { name: "Live KPI dashboard", days: "5 days", tier: "entry", col: "#b7c0cc",
    what: "One screen with the numbers that matter, updated live, so Monday stops being a guess.",
    needs: "read access to wherever those numbers live today, however messy that is" },
  CRM: { name: "Onboarding pack automation", days: "4 days", tier: "entry", col: "#8ec2ff",
    what: "Logs every touch automatically and stops anyone retyping the same details twice.",
    needs: "your CRM and its current fields, or a conversation about picking one" },
  CONTENT: { name: "Content repurposer", days: "4 days", tier: "entry", col: "#dfb2ff",
    what: "Turns one recording into a week of platform-native posts, queued for your approval.",
    needs: "a recent recording and a sense of what you would never want posted" },
  MACHINE: { name: "THE MACHINE: the full build", days: "about 3 weeks", tier: "core", col: "#e2c6ff",
    what: "The whole engine, run by our team against a budget you set: sourcing, research, drafting, sending and reporting.",
    needs: "the full diagnosis. Your economics, your stack, your deliverability and your compliance position" }
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
const fmtGBP = n => "£" + Math.round(n).toLocaleString("en-GB");
const fmtGBPk = n => n >= 1000 ? "£" + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : fmtGBP(n);
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
  $$("[data-book]").forEach(a => {
    if (BOOKING_URL) {
      a.setAttribute("href", BOOKING_URL);
      /* new tab only for an external scheduler — never for the in-site anchor */
      if (/^https?:/i.test(BOOKING_URL)) a.setAttribute("target", "_blank");
    }
    else a.addEventListener("click", e => {
      e.preventDefault();
      toast("Booking link coming soon — email " + CONTACT_EMAIL);
    });
  });
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
