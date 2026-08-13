# Anti-slop: the tells

These are the patterns that mark a site as machine-generated. Read once per project.
Presence of any of them is a defect, not a style choice.

## Visual and CSS

- Purple-to-blue mesh or aurora gradient behind a centered hero. The single most
  recognisable tell.
- `shadow-md` / `shadow-lg` / `shadow-xl` straight from the default scale.
- `border-gray-200` / `border-gray-300` as the universal divider.
- Glassmorphism applied to everything rather than to navs and overlays only.
- Emoji used as iconography, in headings, in feature lists, or in alt text.
- Gradient text on the headline. Once was a trend, now it is a signature.
- Every element rounded to the same 8px.
- Neon glow on dark backgrounds as a substitute for hierarchy.

## Typography

- Inter or Roboto as the display face, at default tracking.
- Only one type size doing three jobs, or eight sizes doing one.
- Positive letter-spacing on large headlines, or negative tracking on body text.
- Centered body paragraphs longer than two lines.
- All-caps for anything longer than a short label.

## Layout

- Three equal feature cards in a row. If there are three things, vary the treatment.
- A hero that is a centered `h1` plus subtitle plus two buttons, with nothing else.
- Every section the same height with the same padding, producing no pacing.
- Sticky full-width navbar glued to the very top edge with a hard bottom border.
- Symmetric 3-column grids repeated down the entire page.
- A logo wall of grey generic shapes labelled as clients.

## Motion

- `transition-all duration-300` with default easing on everything.
- `window.addEventListener('scroll', ...)`. Banned outright, see
  `scroll-performance.md`.
- Every card independently animating on hover with a different effect.
- Multiple marquees on one page. One maximum.
- Infinite pulse or float loops on static informational content.
- Animation that starts on page load rather than on entering the viewport.

## Copy

This matters as much as the visuals, and is more often ignored.

- Cliché verbs and nouns: elevate, unleash, seamless, next-gen, game-changer, empower,
  revolutionise, supercharge, delve, transform your.
- "Lorem ipsum", "John Doe", "Acme Corp", "Company Name", `example@email.com`.
- Invented statistics. "Trusted by 10,000+ teams", "300% increase", "4.9/5 from 2,000
  reviews". If the user has not supplied the number, do not write a number. Use a
  clearly-marked placeholder and tell them it needs filling.
- Fabricated testimonials with invented names, job titles, and company logos.
- Feature descriptions that restate the feature name in a full sentence.
- Em-dashes as a sentence-joining habit. Use a full stop, a comma, or a colon. This is
  the most frequently violated item on this list and is highly visible.
- Three-item lists where every item is the same length and shape.

Placeholder discipline: it is always better to hand the user `[Client testimonial - to be
supplied]` than a convincing invention they might ship by accident.

## Structural

- Building a design system by hand when an official package exists for that brief.
- Importing a real design system then overriding almost all of its tokens.
- Mixing two component libraries in one tree.
- `100vh` instead of `100dvh`, which makes iOS Safari jump on scroll.
- Arbitrary `z-[9999]`. Reserve z-index for systemic layers only: nav, overlay, modal,
  toast.
- Unused CDN imports, dead Tailwind config entries, commented-out placeholder blocks
  left in the delivered file.
- `TODO` comments or half-finished sections in what is presented as a finished build.
