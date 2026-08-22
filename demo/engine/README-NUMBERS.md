# Every number in this engine that we chose without evidence

Engine v2.0.0. This file is the specification for what to measure on the next
five clients. Nothing on this list is a lie and nothing on it is knowledge:
each one is a starting position that a single real deployment could correct.

The engine's structure — headroom capture, composition, capacity as a wall,
delta against a do-nothing baseline — does not depend on any of these being
right. Getting them wrong moves the size of the answer, not its shape.

## 1 · Service ceilings and capture rates

The ten confirmed on the site came from the brief. The twelve added here were
reasoned from each system's own description in `demo/shared.js`, not measured.

| id | figure | evidence | measure it by |
|---|---|---|---|
| `missedcall` | ceiling 0.95, capture 0.72 | brief | answered-or-returned-same-day rate, before and 60 days after |
| `speedlead` | ceiling 0.97, capture 0.80 | brief | share of form enquiries answered inside an hour |
| `inbox` | ceiling 0.94, capture 0.65 | brief | share of email enquiries answered inside a day |
| `quote` | ×1.35 cap 0.85, capture 0.55 | brief | quote-to-win rate before and after |
| `signals` | 22 leads/month | brief | **highest priority.** A flat monthly figure that ignores business size: for a 12-enquiry MSP it nearly triples the pipeline, for a 200-enquiry gym it is noise. Count accepted alerts per month per client. |
| `referral` | 0.16 of customers, ×1.6 close | brief | referred enquiries as a share of completed jobs |
| `content` | +9% inbound, ×0.45 discount | brief | inbound enquiries attributed to content, month 9 vs month 0 |
| `onboard` | repeat ceiling 3.0, capture 0.12 | brief | second-purchase rate at 12 months |
| `webchat` | ceiling 0.96, capture 0.55 | **ours** | chat sessions that became booked enquiries |
| `intake` | ceiling 0.92, capture 0.35 | **ours** | enquiries lost to invalid contact details or misrouting |
| `nurture` | ×1.30 cap 0.85, capture 0.50 | **ours** | win rate on enquiries that got the full sequence vs those that did not |
| `booking` | ×1.18 cap 0.85, capture 0.45 | **ours** | no-show rate and rebooking rate |
| `score` | ×1.15 cap 0.80, capture 0.40 | **ours** | win rate by score band, once ~100 scored leads have closed |
| `enrich` | ×1.10 cap 0.75, capture 0.30 | **ours** | weakest revenue claim in the registry. Win rate on enriched vs unenriched records. |
| `reactivate` | 45% of the dormant list survives suppression, 3% respond, spread over 12 months | **ours** | actual suppression survival and reply rate on the first send |
| `winback` | repeat ceiling 3.0, capture 0.15 | **ours** | repeat purchase rate against the interval model |

The `repeatCeiling` of 3.0 shared by both value services is a single invented
number doing a lot of work. It caps how far lifetime value can be pushed and
is the same for a dental practice and a construction firm, which cannot be right.

## 2 · Sector defaults (`presets.js`)

- **`margin` and `costPerLead`** mirror `SECTOR_ECON` in `demo/archive/predict.js`.
  Inherited from the repo, not independently checked.
- **`repeat`** (lifetime value as a multiple of the first sale) — **ours, all 19 rows.**
  Ranges from 1.15 (solar) to 4.0 (vets). Reasoned from how often each trade
  sells to the same customer again. Measure from client sales history; it is a
  direct multiplier on every revenue figure the engine produces.
- **`hourlyCost`** £18–£30 by sector — **ours.** Sets the whole value of the
  time-saving arm, which for a `time`-kind system is the entire figure shown.
- **`spread`** 0.30–0.50 by sector — **ours.** Sets the width of every band on
  the page. Nothing else affects the band as much. Measure as the variance in
  outcome across clients in the same sector, which needs about twenty clients.
- **Niche aliasing.** 21 of the 40 industries have no row and inherit the
  nearest one (`gp` → `dental`, `landscaping` → `construction`, and so on).
  Those inherit somebody else's economics wholesale.

## 3 · Structural constants

- **`OUTBOUND_FACTOR` 0.38** — from the brief, held across every sector because
  we have no evidence it differs and a per-sector figure would look like knowledge.
- **`CLOSE_CAP` 0.95** — a modelling guard, not a claim about any business.
- **`LEAD_TIME_DAYS` 5** (`forecast.js`) — **ours.** Client-side lead time added
  to every build: access, sign-off, the fortnight of watching what it gets wrong.
  Without it the model delivers eight systems inside three weeks, which no
  delivery team does.
- **`AMORTISE_MONTHS` 12** (`verdicts.js`) — **ours.** The repo's published entry
  price is a one-off with no monthly, so a system that costs nothing to run each
  month can never fail a unit-economics test. Spreading the build across the term
  the forecast covers is the fairest comparison available, but it is a convention.
- **`TIE_BAND` 0.10** (`forecast.js`) — **ours.** Two marginal gains within 10%
  of each other are treated as a tie and broken on evidence quality and build
  speed. Without it, `signals` — whose 22 leads/month we invented — outranked
  `speedlead` by 6% and led the build order.
- **Affordable CAC = lifetime gross ÷ 3** — the three-to-one target return is a
  convention carried from the homepage, not a measured hurdle rate.

## 4 · Where we knowingly departed from the brief

Each of these is a deviation we would defend, not an oversight.

1. **Capacity is `baseline sold + spareCapacity`, not `spareCapacity`.**
   The brief says `served = min(sold, spareCapacity)` while defining
   `spareCapacity` as *extra* customers servable. Taken literally, any business
   whose current throughput exceeds its spare capacity has its baseline clipped
   too, and the delta collapses to zero for reasons that have nothing to do with
   the systems. Acceptance criterion 5 still holds: zero spare capacity gives
   zero revenue delta.

2. **The outreach budget is charged only when something spends it.**
   The brief's `runCost = Σ runPerSystem + budget` charges the budget in the
   baseline too, where it cancels in the delta — handing the machine its sourced
   leads for free and leaving the CAC decline rule with nothing to test.

3. **Value services still pay at zero spare capacity.**
   Criterion 5 asks for revenue delta zero when capacity is zero. That holds for
   every system that wins customers. A retention system raises what the customers
   you *already* serve are worth, so forcing it to zero would model a business
   that cannot be paid twice by the same customer. Documented in the test suite
   as `5b`, not hidden.

4. **The horizon widening realises about 1.45×, not the 1.7× the brief describes.**
   The brief specifies both `s × (1 + 0.06(month − 1))` and `k = 40/s`. A Beta's
   standard deviation goes as `√(1/k)`, so the rate components of the band widen
   as `√s` (about 1.29× by month twelve) while the log-normal value and quality
   terms widen as `s`. The two figures the brief gives cannot both hold. We kept
   the mechanism it specifies rather than tuning the constant until the prose came
   true. Acceptance criterion 10 passes on the actual forecast (month 12 vs month 1),
   which includes the ramp.

5. **`pPositive` is measured against the amortised build cost, not against zero.**
   Net already carries the monthly fee; with the repo's £0 monthly on entry builds,
   "is the delta above zero" would be a question with only one answer.

6. **Declines are computed after the selection settles.**
   Deciding them inside the greedy loop made the reason a visitor reads depend on
   the order candidates happened to be tested in — the same system could be turned
   down for its cost per customer early and for capacity later. Those are different
   sentences about the same business.

7. **Capacity and saturation are tested before CAC.**
   When the queue is full every system wins ~0 customers, so CAC divides by nothing
   and reads £Infinity. A true number naming the wrong cause is worse than no number.

## 5 · Systems marked zero-revenue

Five of the 22 carry `kind: 'time'` and no revenue effect at all, because we could
not identify a revenue mechanism we would defend in front of a client:

| id | why no revenue |
|---|---|
| `dashboard` | Changes what you decide, not a transition in the funnel. The engine cannot model decision quality. |
| `crmbuild` | Infrastructure. The hard part is adoption, and adoption is not a rate we can put a ceiling on. |
| `docs` | Mostly post-sale. The pre-sale chase it does share with `quote`, so counting revenue here would count it twice. |
| `calls` | Better notes do not by themselves win more work. |
| `attrib` | Its real value is reallocating budget, and how much that is worth depends on how wrong the current split is — which no form can tell us. |

`attrib` is the one we are least comfortable with: better attribution genuinely
does raise the return on a budget. We left it at zero rather than invent an
efficiency gain, and it is the first candidate for promotion once we can measure
how much a client's spend moves after they can see the truth.
