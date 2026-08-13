# Scroll performance and accessibility

Cinematic sites fail on mid-range Android and in screen readers long before they fail on
a developer's laptop. These are the rules that keep them shippable.

## Hard bans

- **`window.addEventListener("scroll", ...)`.** Fires on every frame, no batching, causes
  layout thrash. Use IntersectionObserver, GSAP ScrollTrigger, Motion's `useScroll`, or
  CSS `animation-timeline: view()`.
- **Scroll progress computed from `window.scrollY` into React state.** Re-renders the
  tree every frame. Use motion values.
- **`requestAnimationFrame` loops that touch React state.** Same reason.
- **Animating `top`, `left`, `width`, `height`, `margin`.** These trigger layout. Animate
  `transform` and `opacity` only.
- **Animated `filter` or `backdrop-filter`.** Each frame is a fresh GPU blur pass. If you
  need a blur transition, cross-fade a pre-blurred layer instead.
- **`backdrop-filter` on a scrolling container.** Only on fixed or sticky elements.
- **`100vh`.** Use `100dvh` or iOS Safari will jump as the URL bar collapses.

## Compositing hygiene

- `will-change: transform` only on elements currently animating, removed afterwards. A
  page-wide `will-change` promotes everything to its own layer and exhausts GPU memory.
- Grain and noise overlays live on one `position: fixed; inset: 0; pointer-events: none`
  layer, never attached to scrolling content.
- Ambient background gradients likewise: one fixed layer, mounted once at the layout
  level, not per section. This is also what makes sections feel like one continuous world
  rather than a stack of unrelated blocks.
- Keep the DOM lean. Thousands of nodes each with a transform will drop frames regardless
  of how correct the CSS is.
- Reserve space for every image and canvas with explicit dimensions or aspect-ratio.
  Cumulative layout shift is the easiest Core Web Vital to lose and the easiest to fix.

## Reduced motion (mandatory)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

The blanket rule is a floor, not the whole job. Also:

- Unpin every pinned section. Pinned content under reduced motion is disorienting.
- Image sequences show a single frame.
- Smooth scroll libraries do not initialise at all.
- Preloaders resolve instantly.
- Parallax becomes static.

Gate JS-side with `useReducedMotion()` or `gsap.matchMedia()`, and check the media query
before constructing the animation, not after.

## Mobile

- Below 768px, unpin everything and fall back to stacked fades. Gate with
  `gsap.matchMedia("(min-width: 768px)")`.
- Horizontal scroll-hijack becomes a native `overflow-x-auto snap-x` strip.
- Asymmetric layouts, rotations and negative-margin overlaps reset. Overlapping elements
  create touch-target conflicts.
- Serve smaller image sequences, or a static hero.

## Accessibility

- Pinned sections must not trap keyboard focus. Test tabbing all the way through the page.
- Content revealed on scroll must be in the DOM and readable when JS fails. Animate from
  a visible baseline, or provide a `no-js` fallback that shows everything.
- Focus rings visible at all times. Never `outline: none` without a replacement.
- No flashing faster than 3 times per second (WCAG 2.3.1).
- Text over imagery needs a scrim, not hope. Verify contrast against the actual darkest
  and lightest regions of the image.
- Decorative canvases and grain layers get `aria-hidden="true"`.

## Preloaders

A preloader **is** your Largest Contentful Paint. A 1.6s counter plus a wipe adds roughly
2.3s before the user sees content. That can be the right call for a brand site, but make
it a deliberate choice and keep observed LCP under 2.5s. Always include a failsafe
timeout so a stalled asset cannot leave the user on a loading screen forever.

## Budget and verification

- Report total scroll length to the user in viewports. Each pinned scene costs at least
  one. Keep a homepage under roughly 25.
- Verify by screenshotting at multiple scroll depths on the served build, not by reading
  the code. Static builds of scroll-driven sites reliably contain at least one bug that
  is invisible in source.
- Judge performance by observed FCP and LCP on the real device class you care about.
  Simulated Lighthouse scores are skewed by local antivirus page injection and by
  keepalive hosts where `networkidle0` never fires.
- Test hard-loading nested routes and hash anchors. Relative asset bases (`base: './'`
  in Vite) 404 the JS bundle on deep links and produce a blank page.
