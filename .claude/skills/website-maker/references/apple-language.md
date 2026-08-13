# The Apple language

What actually makes a page read as Apple-grade. Ordered by how much each contributes.

## Contents
1. Restraint budget
2. Typography
3. Colour
4. Space and rhythm
5. Materials and surfaces
6. Motion character
7. Component patterns
8. Imagery
9. Vibe variants when the brand is not Apple

---

## 1. Restraint budget

Apple pages are defined more by what is absent. Per page, allow yourself roughly:

- **3-4 type sizes.** Not eight.
- **1 accent colour.** Sometimes zero, with the product photography carrying all colour.
- **2 surface levels.** Page and card. A third is a luxury, a fourth is clutter.
- **1 easing curve** for UI, one for entrances.
- **1 idea per viewport.** If a section needs two headlines, it is two sections.

When something feels wrong, the answer is almost always "remove one thing", not "add
polish".

---

## 2. Typography

The single highest-leverage layer. Apple pages are typographically driven.

**Faces.** SF Pro is Apple's and is not licensed for general web use. Credible stand-ins:

| Role | Options |
|---|---|
| Display and body | Geist, Satoshi, Switzer, General Sans, Plus Jakarta Sans, Instrument Sans |
| Editorial serif variant | Instrument Serif, Newsreader, PP Editorial New |
| Mono, metadata and code | Geist Mono, JetBrains Mono, Berkeley Mono |

Avoid Inter, Roboto, Open Sans, Arial and Helvetica as the primary face. They are not
bad typefaces; they are the ones every generated site uses, so they read as default.
System-font stacks are acceptable when performance genuinely dominates.

**Scale.** Headlines are much larger than instinct suggests and much tighter.

```
display   clamp(3rem, 7vw, 5.5rem)   weight 600   tracking -0.035em   leading 0.95-1.05
h1        clamp(2.5rem, 5vw, 4rem)   weight 600   tracking -0.03em    leading 1.05
h2        clamp(1.75rem, 3vw, 2.5rem) weight 600  tracking -0.02em    leading 1.15
body      1.0625rem - 1.125rem       weight 400   tracking 0          leading 1.6
caption   0.8125rem                  weight 500   tracking 0.01em     leading 1.4
eyebrow   0.6875rem                  weight 500   tracking 0.18em     uppercase
```

Rules that matter more than the numbers:

- **Negative tracking scales with size.** Large type needs it, body text does not. Never
  apply negative letter-spacing below about 1.25rem.
- **Leading tightens as size grows.** A 5rem headline at `leading-relaxed` looks amateur.
- **Measure caps at 65-75 characters.** `max-w-2xl` for prose, `max-w-4xl` at most.
- **Weight does the emphasis, not colour.** Two weights (400 and 600) is usually enough.
- Never pure black text on pure white. `#1D1D1F` on `#FFFFFF`, or `#F5F5F7` on `#000000`.

**Eyebrows.** Small uppercase wide-tracked labels above headlines are an Apple staple and
cost nothing. Use them to carry the category so the headline can stay short.

---

## 3. Colour

Colour is a scarce resource used for meaning, never decoration.

```
page          #FFFFFF   or  #F5F5F7   (dark: #000000 / #0B0B0C)
surface       #FFFFFF   raised on the grey page  (dark: #1C1C1E)
text primary  #1D1D1F                             (dark: #F5F5F7)
text secondary #6E6E73                            (dark: #A1A1A6)
hairline      rgba(0,0,0,0.08)                    (dark: rgba(255,255,255,0.10))
accent        one colour, used for links, focus rings, and the primary CTA only
```

- **The grey-on-white inversion** (`#F5F5F7` page with `#FFFFFF` cards) is doing a lot of
  the Apple feel and costs nothing.
- **No gradients as decoration.** Gradients are acceptable as ambient light behind a hero
  at very low opacity, or as product photography. Purple-to-blue mesh behind a centered
  headline is the canonical AI tell.
- **True black backgrounds are legitimate** for product-hero sections and read premium on
  OLED. Use `#000000`, not `#0F172A`.
- Contrast: 4.5:1 for body text, 3:1 for large text, always. Grey-on-grey secondary text
  is where premium designs fail audits.

---

## 4. Space and rhythm

- Section padding `py-24` minimum, `py-32` to `py-40` for hero-adjacent sections. Double
  whatever your instinct says.
- Use a consistent spacing scale (4px base, or Tailwind's) and never a one-off `mt-[37px]`.
- **Vertical rhythm beats horizontal cleverness.** A page of well-spaced full-width
  sections reads more expensive than a busy grid.
- Full-bleed sections alternating with constrained content creates the pacing. Do not
  wrap the entire page in one container.
- The bento grid is Apple's own multi-item pattern: CSS Grid with mixed spans (2x2, 2x1,
  1x1), 16-24px gaps, generous internal padding. Collapse to one column below 768px and
  reset every span override.

---

## 5. Materials and surfaces

This is where competent work separates from cheap work.

**Nested enclosure (the "double bezel").** Premium containers do not sit flat on the
page. They look like a glass plate in a machined tray:

- Outer shell: subtle background (`bg-black/[0.04]`), hairline ring
  (`ring-1 ring-black/[0.06]`), small padding (`p-1.5`), large radius (`rounded-[28px]`).
- Inner core: its own background, its own top-edge highlight
  (`shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`), and a *concentric* radius computed as
  `calc(28px - 6px)`. Concentricity is the detail people feel without naming.

**Shadows.** Never `shadow-md` or `shadow-lg`. Apple shadows are large, soft, and nearly
invisible:

```css
--shadow-rest:  0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04);
--shadow-hover: 0 2px 4px rgba(0,0,0,0.05), 0 16px 40px rgba(0,0,0,0.07);
```

Two layers: a tight contact shadow and a wide ambient one. Opacity stays under ~0.08.

**Hairlines over borders.** `1px solid rgba(0,0,0,0.08)`, not `border-gray-300`. In dark
mode a hairline is a white highlight at ~10%, not a grey line.

**Radii.** Large and consistent: 12px for controls, 20-28px for cards, `rounded-full` for
pills. Squircle-ish is better than sharp. Never mix 4px and 24px on the same surface level.

**Glass.** Legitimate for sticky navs and overlays: `backdrop-blur-xl` plus a translucent
background plus a 1px inner top highlight, which is what sells the refracted edge. Never
apply `backdrop-filter` to a scrolling container - it repaints every frame and destroys
mobile performance. Provide a solid fallback for `prefers-reduced-transparency`.

---

## 6. Motion character

Apple motion has mass. It never snaps and it never bounces cartoonishly.

```css
--ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);      /* entrances, reveals */
--ease-apple:     cubic-bezier(0.32, 0.72, 0, 1);      /* the workhorse */
--ease-in-out:    cubic-bezier(0.65, 0, 0.35, 1);      /* symmetric transitions */
```

- Durations: 200-300ms for hover and state, 600-900ms for entrances and reveals.
- **Never `linear`, never bare `ease-in-out`.** Those two defaults are audible.
- Entrances: `translateY(24px) + opacity 0` resolving over ~700ms with `ease-out-expo`.
  Optionally add a small `blur(8px) → 0` for a lens-focus feel. Stagger siblings by 60-80ms.
- Presses: `active:scale-[0.98]`. Physical, cheap, and instantly recognisable.
- Spring physics where a library supports it: `stiffness 100, damping 20`.
- Nothing loops forever unless it carries meaning (a live status dot, a genuine loading
  state). Infinite ambient animation everywhere is a tell.

---

## 7. Component patterns

**Nav.** A floating pill detached from the top edge (`mt-6 mx-auto w-max rounded-full`)
with glass backing, or a full-width bar that is transparent at scroll-top and gains
hairline plus blur after ~40px. Mobile menu opens as a full-screen glass overlay with
staggered link reveals, and the hamburger morphs to an X rather than swapping icon.

**Primary CTA.** Fully rounded pill, `px-6 py-3`, solid near-black on light or white on
dark. If it carries a trailing arrow, nest the arrow inside its own circular well
(`w-8 h-8 rounded-full bg-white/10`) flush to the inner padding, and translate it
diagonally on hover while the button itself scales down slightly. That internal tension
is the whole trick.

**Feature sections.** Alternating full-bleed image or product shot with a short headline
and one paragraph. Not three equal cards. If you must use cards, vary their spans.

**Sticky product scroll.** A pinned visual with text panels advancing beside it. This is
the pattern Apple uses for product deep-dives. Skeleton in `motion-recipes.md`.

**Accordions.** Strip the container. Items separated by a single hairline, with a `+`
that rotates to a `×`. No boxed cards.

**Faux window chrome.** When showing software, wrap it in a minimal window with three
small grey dots. Reads as a real product screenshot rather than a floating rectangle.

---

## 8. Imagery

- **One visual universe.** Mixing stock photography with generated art is the single
  biggest reason sections feel unrelated. Pick one source and one style and hold it.
- Product shots on seamless backgrounds, generous negative space, single light source.
- Desaturate and warm slightly so images sit inside the palette rather than fighting it.
- Ship WebP at q80-85, sized at most 2× render size. Set explicit width and height to
  protect CLS. Lazy-load everything below the fold, never the LCP image.
- If real assets do not exist, use an honest placeholder service and say so. Never
  fabricate a client logo, a headshot, or a testimonial.

---

## 9. Vibe variants when the brand is not Apple

Same discipline, different surface. Pick one and hold it for the whole page.

**Ethereal glass** (AI, developer tools, fintech). Near-black `#050505`, one or two very
soft radial glows, vantablack cards with heavy blur and white hairlines at 10%, wide
geometric grotesk headlines.

**Editorial luxury** (property, hospitality, agency, professional services). Warm cream
`#FDFBF7`, deep espresso text, a high-contrast serif for display sizes, a film-grain
overlay at ~3% opacity on a fixed pointer-events-none layer.

**Soft structuralism** (health, consumer, portfolio). White or silver-grey, very large
bold grotesk, airy floating components, diffused ambient shadows and almost no borders.

All three keep the same rules: few type sizes, huge whitespace, scarce colour, motion
with mass, materials that look machined.
