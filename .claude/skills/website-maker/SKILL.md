---
name: website-maker
description: Build professional, Apple-grade marketing websites and landing pages - restrained typography, generous whitespace, machined materials, scroll choreography that actually works. Use this whenever the user asks for a website, landing page, marketing site, homepage, hero section, portfolio, product page, or a redesign of any of those, and also whenever they say things like "make it look premium", "Apple-style", "Awwwards", "high-end", "stop looking like AI made it", or paste a reference site to match. Applies to HTML, React, Next.js, Vue, Svelte and Astro alike. Do not skip this skill just because the request sounds small - a single hero section or a "quick landing page" is exactly where the default AI aesthetic leaks in.
license: MIT. Derived from MIT-licensed open source, see references/CREDITS.md.
---

# Website Maker

The default failure mode is not ugliness. It is *genericness*: Inter on slate-900, a
centered hero over a purple mesh gradient, three equal feature cards, `shadow-lg`
everywhere, a footer. It reads instantly as machine-made. Everything below exists to
push past that into work that looks deliberate and expensive.

The Apple house style is the north star, not because every site should look like
apple.com, but because Apple's constraints (very few type sizes, enormous whitespace,
almost no colour, materials that behave like physical objects, motion with real mass)
are a reliable path to "this looks professional" across almost any brand.

## Order of operations

Do these in order. Skipping step 1 is what produces sites that look like a template
with nicer fonts.

1. Design read
2. Set the dials
3. Pick the foundation
4. Build: tokens, then type, then layout, then materials, then motion
5. Verify visually in a browser
6. Ship gate

---

## 1. Design read (before any code)

Read the room before choosing an aesthetic. Gather:

- **Page kind** - SaaS landing, consumer product, agency, portfolio, editorial, redesign.
- **Vibe words the user actually used** - "clean", "premium", "Apple-y", "brutalist",
  "serious B2B", "playful". Their words outrank your taste.
- **Reference signals** - URLs, screenshots, named competitors. If they gave a URL,
  fetch it and decompose the *mechanics* (smooth scroll, parallax, pinning, type scale),
  not the stack. Award-site stacks are usually custom WebGL; you get ~90% of the feel
  with disciplined art direction plus Lenis and GSAP.
- **Audience** - a procurement panel and a design-conscious consumer want opposite things.
- **Existing brand assets** - logo, colours, type, photography. On a redesign these are
  starting material, not suggestions.
- **Quiet constraints** - regulated industry, accessibility-critical, public sector.
  These override aesthetics entirely.

Then state the read in one line before writing code:

> Reading this as: `<page kind>` for `<audience>`, in a `<vibe>` language, leaning toward
> `<foundation>`.

If the read genuinely forks, ask **exactly one** question. Never a questionnaire. If you
can infer it, do not ask - declare the read and go.

---

## 2. Set the dials

Three numbers govern every later decision. Name them in your read.

| Dial | 1 | 10 |
|---|---|---|
| `VARIANCE` | perfect symmetry | asymmetric, artsy |
| `MOTION` | static, hover only | cinematic, scroll-driven, physics |
| `DENSITY` | art gallery, one thing per screen | packed dashboard |

**Apple-grade default: `VARIANCE 6 / MOTION 6 / DENSITY 2`.** Low density is the single
most load-bearing value here. Apple pages show one idea per viewport.

| Brief reads as | VAR | MOT | DEN |
|---|---|---|---|
| Apple-style, premium consumer, luxury brand | 6-7 | 5-7 | 2-3 |
| Minimalist, calm, editorial, Linear-style | 5-6 | 3-4 | 2-3 |
| Agency, Awwwards, experimental | 9-10 | 8-10 | 3 |
| Mainstream SaaS landing | 7 | 6 | 4 |
| Trust-first, public sector, regulated | 3-4 | 2-3 | 4-5 |
| Redesign, preserve | match existing | +1 | match |
| Redesign, overhaul | +2 | +2 | match |

Overrides happen conversationally. Never ask the user to edit this file.

**Motion claimed is motion shown.** If `MOTION > 4` the page must actually move: hero
entrance, scroll reveals on key sections, hover physics on CTAs. If you cannot ship
working motion inside the scope you have, drop the dial to 3 and ship a clean static
page. Half-built motion (cut-off ScrollTriggers, jumpy enters, missing cleanup) is worse
than none.

---

## 3. Pick the foundation

**Honesty rule:** if the brief maps to a real design system, install the official
package. Do not hand-recreate its CSS, and do not import its tokens then override 90%
of them. One system per project.

| Brief | Foundation |
|---|---|
| UK public sector | `govuk-frontend` |
| US public sector | `uswds` |
| Enterprise Microsoft-flavoured | `@fluentui/react-components` |
| IBM-style analytics | `@carbon/react` |
| Shopify admin surfaces | Polaris |
| GitHub-style devtool or marketing | `@primer/react-brand` |
| Modern SaaS you own the code for | shadcn/ui, never left at default styling |
| **Apple-style marketing site (this skill's default)** | Tailwind v4 + custom tokens + Motion + GSAP only where pinning is needed |

Note honestly in comments what is borrowed inspiration. "Liquid Glass" has no official
web package - web versions are `backdrop-filter` approximations and should be labelled
as such.

---

## 4. Build order

Read `references/apple-language.md` now if the brief is premium, consumer, Apple-style,
luxury, or unspecified. It carries the type scale, colour rules, materials, radii and
easing curves. `assets/apple-tokens.css` is a drop-in starting token set.

Build in this sequence, because each layer constrains the next:

1. **Tokens** - colour, type scale, spacing scale, radii, easing. Define once as CSS
   custom properties. Never hard-code a hex or a duration in a component.
2. **Typography** - set the scale before the layout. Apple pages are typographically
   driven; the layout is mostly a consequence of very large headlines and very few sizes.
3. **Layout** - section rhythm first (`py-24` to `py-40`), then the grid inside it.
   Constrain reading measure to ~65-75 characters.
4. **Materials** - surfaces, hairlines, nested enclosures, shadows. See the "materials"
   section of `references/apple-language.md`. This is where cheap-looking work gets
   fixed.
5. **Motion** - last, and only where motivated.

Before any of it, run the anti-slop pass: `references/anti-slop.md` lists the specific
defaults that mark output as machine-made. Read it once per project, not per component.

**Optional lookup.** For palettes, font pairings, style archetypes and UX guidance,
there is a bundled searchable database:

```bash
python3 references/uiux-db/scripts/search.py "<query>" --domain style -n 3
# domains: style, color, typography, ux, landing, motion, icons, charts, products
python3 references/uiux-db/scripts/search.py "<product> <industry>" --design-system
```

Use it when you want a defensible palette or font pairing rather than inventing one.
Requires Python 3, no network, no key. It is a reference, not an authority - if its
suggestion conflicts with the design read, the design read wins.

---

## 5. Motion and scroll

Motion must be **motivated**. Before adding any animation, answer in one sentence what
it communicates: hierarchy, storytelling, feedback, or state change. "It looked cool" is
not an answer. GSAP everywhere because GSAP is installed is amateur work.

Pick set pieces deliberately from `references/motion-recipes.md`, which has working
skeletons for:

- scroll-reveal stagger (the cheap default, use Motion's `whileInView`)
- sticky card stack
- horizontal pan
- **canvas image-sequence scrub** - the actual Apple product-page signature
- magnetic hover physics
- Lenis smooth scroll setup

Every pinned scene costs scroll runway the user must budget. Tell them the total: keep a
homepage under roughly 25 viewports. One marquee per page, maximum.

`references/scroll-performance.md` covers the non-negotiables: no `scroll` event
listeners, transform and opacity only, reduced-motion fallbacks, keyboard escape from
pinned sections. Read it whenever the build includes pinning, scrubbing, or a preloader.

---

## 6. Verify visually

Non-negotiable for anything with motion. A cinematic build that looks correct in code
always has at least one bug you cannot see in code.

- Serve the build. Screenshot at multiple scroll depths: hero, each set piece mid-state,
  each transition, the ending.
- Check both light and dark mode if both are shipped.
- Check below 768px. Asymmetric layouts, rotations and negative-margin overlaps must
  collapse to a single column with `w-full` and honest padding.
- Hard-load nested routes and hash anchors.
- If deploying, verify the live URL the same way, not just local.

Use `100dvh`, never `100vh`, or iOS Safari will jump.

---

## 7. Ship gate

Before calling the work done, walk `references/ship-checklist.md`. It is short and it is
the last filter. The summary version:

- No banned defaults from `anti-slop.md` survive
- Section padding breathes, measure is constrained, one idea per viewport
- Every card uses real material treatment, not a bare `shadow-lg` box
- All easing is custom, no bare `linear` or `ease-in-out`
- Motion claimed matches motion shipped, and `prefers-reduced-motion` is honoured
- Layout collapses cleanly below 768px
- Copy contains no AI tells, no lorem ipsum, no "Acme Corp", no invented statistics
- Real content, real numbers, or clearly-marked placeholders. Never fabricate a client
  logo, testimonial, or metric

---

## Reference index

| File | Read when |
|---|---|
| `references/apple-language.md` | Any premium, consumer, Apple-style, or unspecified brief. The core aesthetic spec. |
| `references/anti-slop.md` | Once per project, before writing components. |
| `references/motion-recipes.md` | Any scroll choreography, pinning, or scrubbing. |
| `references/scroll-performance.md` | Any pinned, scrubbed, or preloaded build. |
| `references/ship-checklist.md` | Before delivering. |
| `references/uiux-db/` | Palette, font pairing, style archetype lookups. |
| `assets/apple-tokens.css` | Starting token set to copy in and adjust. |
| `references/CREDITS.md` | Provenance and licences. |
