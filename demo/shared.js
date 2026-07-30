/* =========================================================================
   TMA ONE-CLICK DEMOS — shared config, industry presets, helpers
   ========================================================================= */

/* These demos live inside the main site (/demo), so "Book a call" hands the
   prospect back to the site's own booking section rather than dead-ending.
   ⚠️ When the real scheduler exists, put the absolute URL here AND in app.js. */
const BOOKING_URL = "../index.html#book";
const CONTACT_EMAIL = "hello@themissionautomation.com";  // confirm before launch

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
