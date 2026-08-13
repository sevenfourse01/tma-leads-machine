# Ship gate

Run this before presenting the work. Anything unchecked is a defect to fix or a caveat to
state explicitly, not something to quietly ship.

## Design read
- [ ] A design read was stated before code, and the delivered page matches it
- [ ] Dials were set, and the output reflects them (a `DENSITY 2` brief did not ship a
      packed page; a `MOTION 7` brief actually moves)
- [ ] If a real design system applied to this brief, the official package was used

## Typography
- [ ] Four or fewer type sizes on the page
- [ ] Display type has negative tracking and tight leading; body has neither
- [ ] Measure constrained to roughly 65-75 characters
- [ ] Primary face is not Inter, Roboto, Open Sans, Arial or Helvetica
- [ ] Text is off-black or off-white, never `#000` on `#FFF`

## Colour and material
- [ ] One accent colour, used for links, focus and primary CTA only
- [ ] No decorative gradient behind the hero headline
- [ ] Shadows are two-layer, wide and under ~0.08 opacity. No default `shadow-lg`
- [ ] Dividers are hairlines at ~8% alpha, not `border-gray-300`
- [ ] Cards use real material treatment: nested enclosure or hairline plus soft ambient
      shadow, with concentric radii
- [ ] Radii are consistent within each surface level

## Layout
- [ ] Section padding is at least `py-24`; the page breathes
- [ ] Sections vary in treatment. No three-equal-cards row
- [ ] One idea per viewport
- [ ] Full-bleed and constrained sections alternate to create pacing
- [ ] Below 768px everything collapses to a single column, spans reset, rotations and
      overlaps removed
- [ ] `100dvh` used throughout, never `100vh`

## Motion
- [ ] Every animation has a stated reason: hierarchy, storytelling, feedback, or state
- [ ] All easing is custom cubic-bezier. No bare `linear` or `ease-in-out`
- [ ] Entrances are scroll-triggered, not load-triggered
- [ ] `prefers-reduced-motion` is honoured, including unpinning
- [ ] No `scroll` event listeners anywhere
- [ ] Only `transform` and `opacity` animate
- [ ] GSAP contexts revert; listeners and rAF loops are cleaned up
- [ ] At most one marquee
- [ ] Total scroll length reported to the user in viewports

## Content
- [ ] No lorem ipsum, no "John Doe", no "Acme Corp", no placeholder emails
- [ ] No invented statistics, testimonials, client logos, or review counts. Anything not
      supplied by the user is a visibly-marked placeholder and has been flagged to them
- [ ] No cliché verbs: elevate, unleash, seamless, next-gen, supercharge, transform your
- [ ] No em-dashes used as sentence joins
- [ ] Headline says something specific, not a category noun phrase

## Technical
- [ ] Images are WebP, sized at most 2× render size, with explicit dimensions
- [ ] LCP image is not lazy-loaded; everything below the fold is
- [ ] Contrast passes 4.5:1 for body, 3:1 for large text, including text over imagery
- [ ] Keyboard tab order runs cleanly through the whole page including pinned sections
- [ ] Focus rings visible
- [ ] Decorative layers are `aria-hidden` and `pointer-events-none`
- [ ] No `z-[9999]`; z-index reserved for nav, overlay, modal, toast
- [ ] No dead imports, unused CDN links, or `TODO` comments in the delivered file

## Verification
- [ ] Build was served and screenshotted at hero, each set piece mid-state, each
      transition, and the ending
- [ ] Checked in both light and dark if both ship
- [ ] Checked below 768px
- [ ] Nested routes and hash anchors hard-load correctly
- [ ] If deployed, the live URL was verified the same way, not just localhost

## The last question
Does this read as a deliberate design someone commissioned, or as a competent template
with better fonts? If it is the latter, the usual fix is removing something: a colour, a
type size, a section, or an animation.
