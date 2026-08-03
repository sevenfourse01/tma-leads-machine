# TMA website + one-click demos — session handoff

Paste this whole file as the first message of a new session, then paste Adam's feedback after it.

---

## WHAT THIS IS

The Mission Automation (TMA) is Adam Attia's UK done-for-you lead-generation service. Zach builds
its software. This handoff covers two things that ship together: the public website and the
prospect-facing demos inside it.

**Everything is one static site in one repo, live now.**

| | |
|---|---|
| Repo | `C:\Users\zachs\tma-site` → GitHub `sevenfourse01/tma-leads-machine` |
| Live | **https://themissionautomation.com** (GitHub Pages, apex + HTTPS enforced) |
| Deploy | `git push origin main`. Live in ~60s. No build step, no publish button. |
| Local preview | `node serve.cjs` → http://localhost:8125 |

The Framer site it replaced is dead. DNS moved to GitHub on 2026-08-01 (Namecheap A records
185.199.108–111.153). `CNAME` and `serve.cjs` are the two files never to overwrite in a bulk copy.

**Do not confuse this with `C:\Users\zachs\tma-systems`** — that is the separate 24-phase System
Library build (its own `LEDGER.md`, one phase per session). Unrelated work, same client.

---

## THE PAGES

```
/                        the homepage: three acts, Predict / Build / Grow
/contact/                email + phone + booking
/demo/                   the demo chooser
/demo/full.html          THE demo: symptoms + context → a sequenced blueprint
/demo/resources.html     the library: 22 systems, expandable, grouped by pipeline stage
/systems, /about         301 redirects, preserving old Framer URLs
/demo/archive/           predict.html, build.html, grow.html — retired, still runnable, unlinked
```

### The homepage is three acts
Hero (with the ops console) → Problem → **ACT I Predict** (forecast widget + the gate) →
**ACT II Build** (nine small builds + output + deliverability) → **ACT III Grow** (how we run it +
benefits) → Pricing → FAQs → Book. Each act opens on a full-bleed divider with an outsized numeral.
Orphan sections were deliberately absorbed into the pillar they belong to.

A contents rail runs down the left margin (`#toc`, hidden below 1240px): dots per section, a
gradient line that fills as you scroll, current section highlighted, click to jump. The fill
interpolates between section positions, not page percentage, so a dot lights as its section arrives.

### The ops console (hero)
The animated panel with the six-stage rail and streaming log. Adam flagged that it made TMA look
like software. It was reframed, not removed:
- Bar reads `TMA ops · client: acme_demo · wallet £2,000/mo`
- A caption above: *"Our screen, not yours… You never log into it."*
- **Every log line is badged `AI` or `HUMAN`**, with a key above the console
- Named people: **Zach** (account), **Adam** (strategy — the judgement calls), **Eric** (words,
  regulated claims). 8 of 21 lines are human. Adam refuses paid ads on the account by hand.

### The demo (`/demo/full.html`)
14 symptoms + 4 context questions → scores the 22 builds → returns a sequenced blueprint (week one,
weeks two-three, later, then the machine if it's a reach problem). Every build card says what it
needs from the client and links into the library. Ends on **"Six things this page can't tell you"**
and a coverage bar stating the blueprint used ~10 of the ~40 inputs a diagnosis measures.

### The library (`/demo/resources.html`)
22 systems in 7 pipeline stages. Each card expands in place: how it works, the stack, what's fixed
vs personalised, and **the honest catch** (e.g. speed-to-lead: *"a sixty-second reply is only worth
having if there is genuine availability behind it"*). Deep links work: `resources.html#SPEED`.

---

## HOUSE RULES — these are not preferences

1. **Honesty.** Every prospect-visible figure carries a `.modeltag` (modelled/example). No fake
   testimonials, logos, urgency or case-study metrics. The Framer site's ones were template
   placeholders (Jack Daniel, Thomas Shelby, "$140,000+ Generated/mo") and were deliberately
   never carried over. Do not add them back.
2. **No prices anywhere.** The site prices on the diagnosis call. The demo and library follow.
3. **Service, not software.** A human approves anything sent in a client's name. The approval gate
   is a selling point, never an apology for what automation can't do. Violet = "your part".
4. **stop-slop applies to all prose.** No adverbs, no filler, no "not X but Y" contrasts, no false
   agency (a forecast can't "want" anything), no engineered pull-quotes, active voice with a human
   subject, British English. **No em dashes** — a sweep removed 33 visitor-facing ones; keep it at 0.
5. **Every route ends at the booking call**, `https://cal.com/adam-attia-b3ay43/discovery-call`.
   Set in TWO places: `app.js` and `demo/shared.js`. Change both.

## THE MOTIF
Black `#000`, Figtree display/body, **JetBrains Mono** for every label, numeral and console line
(`--mono` token — never fall back to `ui-monospace`, it renders differently per machine).
Steel `#335771`, electric `#4DA3FF`, violet `#814AC8→#DF7AFE`. Panels `rgba(11,15,20,.8)` at 18px
with a `rgba(255,255,255,.12)` hairline. Signature edge gradient
`linear-gradient(141deg,#4DA3FF 13%,transparent 35%,transparent 64%,#335771 88%)`.
Logo = the conic-gradient tile with a gradient chip (`.brand .mark` on the site, `.brand .dot` in
the demos). **A TMA monogram was tried and rejected — Adam's reviewer preferred the original.**

---

## TRAPS ALREADY HIT — do not repeat

- **`.rv` + a centring transform on the same element**: `.rv.in{transform:none}` cancels it and
  throws the block off-screen. Never combine the reveal class with `.bleed`.
- **Array literals evaluate every element.** Building all four week narratives at once crashed on
  week 1 when one referenced the previous week. Guard with `pv = p || w`.
- **`singular()` must singularise the LAST word only** — stripping trailing "s" everywhere turned
  "new business enquiries" into "new busines enquiry".
- **Regex `[^>]*>` on a favicon `<link>` truncates inside the SVG data URI** and leaks the tail into
  the page as visible text. It shipped once.
- **`document.getElementById('yr')` unguarded in app.js** threw on `/contact/` and silently killed
  every CTA below it. Guard anything not on all pages.
- **app.js wires BOTH `.js-book` and `[data-book]`** — the site uses one convention, the demos the
  other.
- **`simulate(profile, opts)` takes an options object**, not a draw count. Passing a number gives
  all-NaN uplift and a false alarm.
- **The engine assigns p10/p50/p90 to repLow/repBig/repHigh.** A stale "Central" cell rendered a
  literal "£0" on every report for a while.

## VERIFICATION — the honest constraint
**Screenshots do not work in this environment** (the browser pane doesn't composite). `scrollY`
also stays 0, so scroll-driven behaviour cannot be exercised. Everything is verified by reading the
DOM: computed styles, element geometry, contrast, link resolution, console errors. State this
plainly rather than claiming visual confirmation. Ask Zach to eyeball anything that depends on how
it actually looks at size.

Useful: a link checker and a stop-slop sweep both live as throwaway scripts; rewrite them if needed.
`node --check` every JS file after editing. Check `document.documentElement.scrollWidth >
clientWidth` at 1425px and 375px for overflow.

---

## STATE / OPEN ITEMS

- `tma-site-v2/` is a stale approved-redesign copy, already merged into `tma-site`. **Safe to
  delete.** It has no git repo.
- `CONTACT_EMAIL` is `adamattia@themissionautomation.com` in both `app.js` and `demo/shared.js`.
  Confirm that inbox is the one Adam wants.
- Footer social links are `href="#"` placeholders. The Framer originals pointed at bare
  instagram.com / facebook.com etc. Real profile URLs still needed.
- `demo/shared.js` is 83KB: 19+ industry presets (`PRESETS`) mirrored by `SECTOR_ECON` in the
  archived `predict.js`, plus the 22-entry `BUILDS` catalogue with `cat`, `how`, `stack`, `fixed`,
  `custom`, `snag`. **PRESETS and SECTOR_ECON must stay in sync** or Predict throws.
- A "Priya K" remains in the dental preset's sample lead names. Harmless, but it collides with the
  team-name change if anyone notices.

---

## HOW TO WORK

Ultracode is on: use Workflow for substantive work. The patterns that earned their keep here were
**a judge panel** for the hero headline (six independent drafts, three lenses, unanimous winner
shipped with every judge-named fault fixed) and **adversarial verification** for copy edits (30
proposed, 22 kept — the rejections caught changes that smuggled in claims the page couldn't
support). Fan-out authoring worked well for bulk content (19 niches, 22 system descriptions).

Adam is the client and the final judge on look and feel. Zach relays. When Adam says something
looks wrong, he is usually right about the symptom and not always right about the cause — the "it
looks like software" note was really about missing humans, not about the visual.

---

## NEXT

Adam's latest feedback follows this message. Read it, then work the list. Push when Zach approves,
or build in a separate folder on another port if he wants to review first (that pattern worked:
`tma-site-v2` on 8130, diffed against the live repo before merging).
