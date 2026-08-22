/* =========================================================================
   THE SERVICE REGISTRY — engine v2

   Every entry declares WHERE IT ACTS. Composition follows from that
   declaration, so adding a service never means touching model.js.

   kinds
     rate      improves the share of enquiries on one channel that reach a
               human conversation. Competes with other rate services on the
               same channel, independent of the other channels.
     close     improves the engaged-enquiry → customer rate.
     volume    adds new leads on top of the inbound flow.
     referral  turns existing customers into new ones.
     content   lifts inbound enquiry volume, discounted for horizon.
     value     raises what a customer is worth. Never adds customers.
     time      saves admin hours. No revenue mechanism at all.
     engine    buys leads with a budget at a cost per lead.

   Fields
     ceiling      best achievable rate for this transition (rate services)
     capture      share of the gap to that ceiling this service closes
     ceilingMult  close services: ceiling = min(closeRate × mult, ceilingCap)
     repeatCeiling value services: the repeat multiple this can reach
     volume       volume services: new leads a month. A number, or a function
                  of the input set when the honest figure depends on their
                  own numbers rather than on ours.
     hours        admin hours saved a month
     buildDays    working days to build
     rampMonths   months from live to steady state
     requires     input keys that must be truthy for this to run at all
     subsumedBy   if any of these is selected, this contributes nothing
     confidence   how well evidenced this entry's numbers are
     catch        the honest limitation. Never empty.

   `buildCode` links to the library entry in demo/shared.js (BUILDS), so the
   report can link a recommendation to what it actually involves.

   PROVENANCE: every ceiling, capture and volume figure below is an assumption
   until it is measured on a client. The `confidence` field says how much
   weight it deserves, and demo/engine/README-NUMBERS.md lists every figure
   that was chosen without evidence.
   ========================================================================= */

export const ENGINE_VERSION = '2.0.0';

export const SERVICES = [
  /* ---- rate · phone --------------------------------------------------- */
  {
    id: 'missedcall', buildCode: 'RESCUE', name: 'Missed-call rescue',
    kind: 'rate', channel: 'phone', acts: 'calls answered or returned same day',
    ceiling: 0.95, capture: 0.72, hours: 12, buildDays: 2, rampMonths: 2,
    confidence: 'inferred', requires: [], subsumedBy: [],
    why: 'A missed call gets a text back within thirty seconds, before the caller rings the next name on the list.',
    catch: 'It puts a tracked number in front of your existing line, and if your team already answers nearly every call there is very little left to rescue.'
  },

  /* ---- rate · web form ------------------------------------------------ */
  {
    id: 'speedlead', buildCode: 'SPEED', name: 'Speed-to-lead responder',
    kind: 'rate', channel: 'form', acts: 'form enquiries replied to within the hour',
    ceiling: 0.97, capture: 0.80, hours: 10, buildDays: 3, rampMonths: 1,
    confidence: 'inferred', requires: [], subsumedBy: [],
    why: 'Every form submission gets an answer inside a minute, day or night, with a live booking link.',
    catch: 'A sixty-second reply is only worth having if there is real availability behind it, so a diary booked three weeks out blunts most of this.'
  },
  {
    id: 'webchat', buildCode: 'WEBCHAT', name: 'Website chat that books',
    kind: 'rate', channel: 'form', acts: 'form enquiries replied to within the hour',
    ceiling: 0.96, capture: 0.55, hours: 12, buildDays: 4, rampMonths: 2,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'Answers the questions people actually ask on your site and puts the ready ones straight in the diary.',
    catch: 'It answers only from what you give it, so thin source pages mean it hands over to a person often, and a low-traffic site may not hold enough conversations to justify it.'
  },
  {
    id: 'intake', buildCode: 'INTAKE', name: 'Enquiry form rebuild',
    kind: 'rate', channel: 'form', acts: 'form enquiries replied to within the hour',
    ceiling: 0.92, capture: 0.35, hours: 6, buildDays: 2, rampMonths: 1,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'Validates as it is typed and routes by answer, so fewer enquiries arrive unreachable or in the wrong inbox.',
    catch: 'Every question you add loses a few people, so this trades enquiry count against enquiry quality and you have to pick which one you are short of.'
  },

  /* ---- rate · email --------------------------------------------------- */
  {
    id: 'inbox', buildCode: 'TRIAGE', name: 'Inbox triage & draft replies',
    kind: 'rate', channel: 'email', acts: 'email enquiries replied to within a day',
    ceiling: 0.94, capture: 0.65, hours: 26, buildDays: 4, rampMonths: 2,
    confidence: 'inferred', requires: [], subsumedBy: [],
    why: 'Reads the enquiries inbox, tags what each message is, and drafts the reply in your voice for approval.',
    catch: 'It writes only as well as the examples you give it, so a thin sent folder produces bland drafts until the voice model has more to work from.'
  },

  /* ---- close ---------------------------------------------------------- */
  {
    id: 'quote', buildCode: 'QUOTE', name: 'Quote & proposal generator',
    kind: 'close', acts: 'engaged enquiry → customer',
    ceilingMult: 1.35, ceilingCap: 0.85, capture: 0.55,
    hours: 18, buildDays: 5, rampMonths: 2,
    confidence: 'assumed', requires: ['quoteBased'], subsumedBy: [],
    why: 'Turns an enquiry into a branded quote ready to sign while it still matters, then chases until it is signed or declined.',
    catch: 'A generator is only as good as the price book behind it, so anything needing a site visit still lands on your desk.'
  },
  {
    id: 'nurture', buildCode: 'NURTURE', name: 'Follow-up that stops on reply',
    kind: 'close', acts: 'engaged enquiry → customer',
    ceilingMult: 1.30, ceilingCap: 0.85, capture: 0.50,
    hours: 14, buildDays: 4, rampMonths: 3,
    confidence: 'inferred', requires: [], subsumedBy: [],
    why: 'The five or six touches most businesses never send, in your voice, ending the second someone answers.',
    catch: 'Stop-on-reply is only as good as the channels it can see, so replies arriving somewhere unwired get chased again, which is worse than sending nothing.'
  },
  {
    id: 'booking', buildCode: 'BOOKING', name: 'Booking & no-show recovery',
    kind: 'close', acts: 'engaged enquiry → customer',
    ceilingMult: 1.18, ceilingCap: 0.85, capture: 0.45,
    hours: 11, buildDays: 3, rampMonths: 2,
    confidence: 'inferred', requires: [], subsumedBy: [],
    why: 'Confirms, reminds and rebooks, because a no-show costs more than the advertising that produced it.',
    catch: 'Recovery only fires if no-shows are actually marked, so this asks for one habit change from whoever runs the diary.'
  },
  {
    id: 'score', buildCode: 'SCORE', name: 'Lead scoring & routing',
    kind: 'close', acts: 'engaged enquiry → customer',
    ceilingMult: 1.15, ceilingCap: 0.80, capture: 0.40,
    hours: 10, buildDays: 3, rampMonths: 2,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'Scores each enquiry with a reason in plain English and sends it to the right lane, so the best enquiry of the week is not behind the worst.',
    catch: 'The first version scores against what you believe a good lead looks like, not what has closed, so treat it as provisional until about a hundred scored leads have reached won or lost.'
  },
  {
    id: 'enrich', buildCode: 'ENRICH', name: 'Contact & company enrichment',
    kind: 'close', acts: 'engaged enquiry → customer',
    ceilingMult: 1.10, ceilingCap: 0.75, capture: 0.30,
    hours: 9, buildDays: 3, rampMonths: 2,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'Fills in who this person actually is before you ring them, so nobody opens a call cold.',
    catch: 'Data on small UK firms is patchy: expect a match on six or seven in ten, and no provider will tell you which returned fields are years out of date.'
  },

  /* ---- volume --------------------------------------------------------- */
  {
    id: 'signals', buildCode: 'SIGNAL', name: 'Buying-signal watcher',
    kind: 'volume', acts: 'new leads a month',
    volume: 22, hours: 14, buildDays: 5, rampMonths: 3,
    confidence: 'assumed', requires: [], subsumedBy: ['machine'],
    why: 'Watches for the events that mean someone is about to buy and tells you while it is still news.',
    catch: 'Noise is heavy at the start and signals go stale within days, so the first fortnight produces alerts you will bin.'
  },
  {
    id: 'reactivate', buildCode: 'REACTIVATE', name: 'Dormant-list reactivation',
    kind: 'volume', acts: 'new leads a month',
    /* Sized from THEIR numbers, not ours. Two years of enquiries that never
       bought, of which a bit under half survive suppression and cleaning, of
       which about 3% respond — spread across the twelve months, because this
       is one asset worked through once, not a monthly flow. */
    volume: inp => {
      const enq = inp.enquiries.value, close = inp.closeRate.value;
      return Math.max(0, enq * 24 * (1 - close) * 0.45 * 0.03 / 12);
    },
    hours: 4, buildDays: 3, rampMonths: 2,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'One respectful message to everyone who enquired, never bought and went quiet.',
    catch: 'This is a one-off asset spread across the year, not a monthly supply: the list is worked through once, and under PECR anyone who never gave you their details has to be left out.'
  },

  /* ---- referral ------------------------------------------------------- */
  {
    id: 'referral', buildCode: 'REVIEW', name: 'Review & referral engine',
    kind: 'referral', acts: 'customers → referred enquiries',
    referralRate: 0.16, referralCloseMult: 1.6,
    hours: 8, buildDays: 3, rampMonths: 3,
    confidence: 'inferred', requires: [], subsumedBy: [],
    why: 'Asks for the review at the moment people are happiest, then asks who else needs the same job doing.',
    catch: "Google's rules mean everyone gets asked, not only the happy ones, so the routing changes who hears first rather than who is asked."
  },

  /* ---- content -------------------------------------------------------- */
  {
    id: 'content', buildCode: 'CONTENT', name: 'Content repurposer',
    kind: 'content', acts: 'inbound enquiry volume',
    inboundLift: 0.09, horizonDiscount: 0.45,
    hours: 20, buildDays: 4, rampMonths: 9,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'Turns one recording into a week of platform-native posts, queued for your approval.',
    catch: 'The compounding is slow and hard to attribute, which is why the modelled effect is discounted to under half and ramps across nine months rather than three.'
  },

  /* ---- value ---------------------------------------------------------- */
  {
    id: 'onboard', buildCode: 'CRM', name: 'Onboarding pack automation',
    kind: 'value', acts: 'lifetime value per customer',
    repeatCeiling: 3.0, capture: 0.12,
    hours: 16, buildDays: 4, rampMonths: 2,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'Fires the welcome, the intake form and the kick-off booking off the won deal, so the second sale starts from a finished first one.',
    catch: 'It is only as clean as the CRM behind it: deals marked won a week late send the pack a week late.'
  },
  {
    id: 'winback', buildCode: 'WINBACK', name: 'Past-customer win-back',
    kind: 'value', acts: 'lifetime value per customer',
    repeatCeiling: 3.0, capture: 0.15,
    hours: 9, buildDays: 3, rampMonths: 3,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'The people who already bought are the likeliest to buy again and the least likely to be asked.',
    catch: 'Old lists decay, so expect dead addresses and wrong numbers, and anyone outside PECR soft opt-in has to be left out.'
  },

  /* ---- time · no revenue mechanism ------------------------------------ */
  {
    id: 'dashboard', buildCode: 'DASH', name: 'Live KPI dashboard',
    kind: 'time', acts: 'nothing in the funnel',
    hours: 22, buildDays: 5, rampMonths: 1,
    confidence: 'measured', requires: [], subsumedBy: [],
    why: 'One screen with the numbers that matter, calculated the same way every week.',
    catch: 'A dashboard changes no transition in your funnel. It changes what you decide, and this engine cannot model that, so the figure shown is hours only.'
  },
  {
    id: 'crmbuild', buildCode: 'CRMBUILD', name: 'CRM build or migration',
    kind: 'time', acts: 'nothing in the funnel',
    hours: 24, buildDays: 5, rampMonths: 3,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'A CRM your team will actually open, or your existing one cleaned up to match how you work.',
    catch: 'The hard part is adoption, not the build, and we can find no honest way to attach revenue to it, so the figure shown is hours only.'
  },
  {
    id: 'docs', buildCode: 'DOCS', name: 'Document & contract automation',
    kind: 'time', acts: 'nothing in the funnel',
    hours: 18, buildDays: 4, rampMonths: 2,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'Contracts and onboarding paperwork generated, sent and chased without anyone opening Word.',
    catch: 'Most of this sits after the sale, and the pre-sale chase it does share with the quote generator, so counting revenue here would count it twice. Hours only.'
  },
  {
    id: 'calls', buildCode: 'CALLS', name: 'Call notes into your CRM',
    kind: 'time', acts: 'nothing in the funnel',
    hours: 20, buildDays: 3, rampMonths: 1,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'Calls transcribed, summarised and filed against the right record with the actions pulled out.',
    catch: 'Accuracy drops on poor lines and crosstalk, and better notes do not by themselves win more work, so the figure shown is hours only.'
  },
  {
    id: 'attrib', buildCode: 'ATTRIB', name: 'Where your leads actually come from',
    kind: 'time', acts: 'nothing in the funnel',
    hours: 14, buildDays: 4, rampMonths: 2,
    confidence: 'assumed', requires: [], subsumedBy: [],
    why: 'Tracks each enquiry back to what produced it, so budget moves on evidence rather than on the platform’s own report.',
    catch: 'Its real value is reallocating budget, and how much that is worth depends on how wrong your current split is, which no form can tell us. Hours only.'
  },

  /* ---- engine --------------------------------------------------------- */
  {
    id: 'machine', buildCode: 'MACHINE', name: 'THE MACHINE: the full build',
    kind: 'engine', acts: 'budget → sourced leads',
    hours: 40, buildDays: 15, rampMonths: 3,
    confidence: 'inferred', requires: [], subsumedBy: [],
    why: 'The whole engine run by our team against a budget you set: sourcing, research, drafting, sending and reporting.',
    catch: 'New sending domains need two to four weeks of warm-up, so the first month produces list and message data more than conversations.'
  }
];

export const BY_ID = Object.fromEntries(SERVICES.map(s => [s.id, s]));

export const service = id => BY_ID[id];

/* Registry order is load-bearing: rate services on the same channel are
   applied in this order, strongest capture first, so the ranking a user sees
   does not depend on the order they happened to tick the boxes.

   Grouped once at load rather than filtered per call — the Monte Carlo runs
   this model about a hundred thousand times a page and a filter() in the hot
   loop is the difference between instant and a visible stall. */
const OF_KIND = kind => SERVICES.filter(s => s.kind === kind);

export const RATE_BY_CHANNEL = {
  phone: SERVICES.filter(s => s.kind === 'rate' && s.channel === 'phone'),
  form: SERVICES.filter(s => s.kind === 'rate' && s.channel === 'form'),
  email: SERVICES.filter(s => s.kind === 'rate' && s.channel === 'email')
};
export const CLOSE_SERVICES = OF_KIND('close');
export const VOLUME_SERVICES = OF_KIND('volume');
export const VALUE_SERVICES = OF_KIND('value');
export const REFERRAL_SERVICES = OF_KIND('referral');
export const CONTENT_SERVICES = OF_KIND('content');
export const ENGINE_SERVICES = OF_KIND('engine');
export const TIME_SERVICES = OF_KIND('time');

export const CHANNELS = ['phone', 'form', 'email'];

export function ratesOn(channel) {
  return RATE_BY_CHANNEL[channel] || [];
}

/* A service can only run if every key it requires is truthy in the inputs. */
export function requirementsMet(s, inp) {
  return (s.requires || []).every(k => inp[k] && !!inp[k].value);
}

/* Composition rule 3: a service listing a selected service in subsumedBy
   contributes nothing, because you would not build both. */
export function isSubsumed(s, selected) {
  return (s.subsumedBy || []).some(id => selected.includes(id));
}
