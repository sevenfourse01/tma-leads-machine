# Motion recipes

Working skeletons. Adapt, do not invent from scratch. Every one of these respects
`prefers-reduced-motion` and cleans up after itself, which is where hand-rolled versions
usually fail.

Assumed stack: `motion` (Framer Motion's successor package), `gsap` with `ScrollTrigger`
for pinning and scrubbing only, `lenis` for smooth scroll. Verify each is actually
installed before importing it.

## Contents
1. Choosing the right tool
2. Lenis smooth scroll
3. Scroll-reveal stagger
4. Sticky card stack
5. Horizontal pan
6. Canvas image-sequence scrub
7. Sticky product scroll
8. Magnetic hover
9. Cleanup rules

---

## 1. Choosing the right tool

| Need | Use |
|---|---|
| Items appear as they enter view | Motion `whileInView`. Cheapest, no ScrollTrigger. |
| Element pinned while something else advances | GSAP ScrollTrigger with `pin: true` |
| A value driven continuously by scroll position | GSAP `scrub`, or Motion `useScroll` + `useTransform` |
| Hover and press feedback | CSS transitions with custom easing |
| Cursor-following physics | Motion `useMotionValue` + `useSpring`, never React state |
| Smooth scroll feel | Lenis |

Reach for GSAP only when you need pinning or scrubbing. Using it for fade-ins is
overweight.

---

## 2. Lenis smooth scroll

```tsx
"use client";
import { useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let raf: number;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
```

If GSAP ScrollTrigger is also present, sync them or pinning will drift:

```ts
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```

Two gotchas that cost real time: a stopped Lenis silently ignores `scrollTo`, so
programmatic hash jumps during a preloader need `{ force: true }`; and smooth scroll
plus a pinned section plus a browser find-in-page do not cooperate, so keep pinned
sections short.

---

## 3. Scroll-reveal stagger

The default. Use this unless you specifically need pinning.

```tsx
"use client";
import { motion, useReducedMotion } from "motion/react";

export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

For lists, stagger with `delay: i * 0.07`. Cap total stagger at about 500ms or the last
item arrives after the user has scrolled past it.

Pure-CSS equivalent when no JS framework is in play:

```css
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    opacity: 0;
    transform: translateY(24px);
    animation: reveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-timeline: view();
    animation-range: entry 10% cover 32%;
  }
}
@keyframes reveal { to { opacity: 1; transform: none; } }
```

---

## 4. Sticky card stack

Cards pin at the top and shrink as the next one arrives. The common failure is a trigger
that fires mid-scroll instead of pinning at the viewport top: the fix is
`start: "top top"`, not `"top center"`.

```tsx
"use client";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(ScrollTrigger);

export function StickyStack({ cards }: { cards: React.ReactNode[] }) {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !root.current) return;
    const ctx = gsap.context(() => {
      const els = gsap.utils.toArray<HTMLElement>(".stack-card");
      els.forEach((card, i) => {
        if (i === els.length - 1) return;
        ScrollTrigger.create({
          trigger: card,
          start: "top top",
          endTrigger: els[els.length - 1],
          end: "top top",
          pin: true,
          pinSpacing: false,
        });
        gsap.to(card, {
          scale: 0.94,
          opacity: 0.55,
          ease: "none",
          scrollTrigger: {
            trigger: els[i + 1],
            start: "top bottom",
            end: "top top",
            scrub: true,
          },
        });
      });
    }, root);
    return () => ctx.revert();
  }, [reduce]);

  return (
    <div ref={root} className="relative">
      {cards.map((card, i) => (
        <div key={i} className="stack-card sticky top-0 min-h-[100dvh] flex items-center justify-center">
          {card}
        </div>
      ))}
    </div>
  );
}
```

Cost: roughly one viewport of scroll per card.

---

## 5. Horizontal pan

```tsx
"use client";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(ScrollTrigger);

export function HorizontalPan({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !wrap.current || !track.current) return;
    const ctx = gsap.context(() => {
      const distance = () => track.current!.scrollWidth - window.innerWidth;
      gsap.to(track.current, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: wrap.current,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
    }, wrap);
    return () => ctx.revert();
  }, [reduce]);

  return (
    <section ref={wrap} className="relative overflow-hidden">
      <div ref={track} className="flex h-[100dvh] items-center gap-8 px-8">
        {children}
      </div>
    </section>
  );
}
```

Under reduced motion or below 768px, let it fall back to a normal
`overflow-x-auto snap-x` strip. Do not ship a pinned horizontal section on mobile.

---

## 6. Canvas image-sequence scrub

The actual Apple product-page signature: a video decomposed into frames, drawn to a
canvas, with the frame index driven by scroll. Expensive to build well, so use it once
per site on the single hero moment that deserves it.

Asset prep: export 90-180 frames as WebP at the render size you need (usually 1440px
wide, plus a 720px set for mobile). Keep the whole sequence under about 8MB. Name them
zero-padded: `frame-0001.webp`.

```tsx
"use client";
import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const FRAME_COUNT = 120;
const frameSrc = (i: number) =>
  `/sequence/frame-${String(i + 1).padStart(4, "0")}.webp`;

export function ScrollSequence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx2d = canvas.getContext("2d", { alpha: false });
    if (!ctx2d) return;

    const images: HTMLImageElement[] = [];
    const state = { frame: 0 };
    let loaded = 0;

    const draw = () => {
      const img = images[Math.round(state.frame)];
      if (!img?.complete || !img.naturalWidth) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      // cover-fit
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx2d.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    // load first frame immediately so there is never an empty canvas
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = frameSrc(i);
      img.onload = () => {
        loaded++;
        if (i === 0) draw();
        if (loaded === FRAME_COUNT) setReady(true);
      };
      images.push(img);
    }

    if (reduce) return; // static first frame, no scroll binding

    const st = gsap.to(state, {
      frame: FRAME_COUNT - 1,
      ease: "none",
      snap: "frame",
      scrollTrigger: {
        trigger: wrap,
        start: "top top",
        end: `+=${FRAME_COUNT * 12}`,
        pin: true,
        scrub: 0.5,
        invalidateOnRefresh: true,
      },
      onUpdate: draw,
    });

    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      st.scrollTrigger?.kill();
      st.kill();
      images.forEach((i) => (i.src = ""));
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-white/40 text-xs tracking-[0.2em] uppercase">
          Loading
        </div>
      )}
    </div>
  );
}
```

Points that decide whether this feels premium or broken:

- `snap: "frame"` prevents drawing fractional frames.
- `scrub: 0.5` gives the sequence weight. `scrub: true` feels twitchy.
- Draw inside `onUpdate`, never in a `requestAnimationFrame` loop of your own.
- Reserve the canvas box with a fixed height so it never causes layout shift.
- Under reduced motion, show the first frame and skip the binding entirely.
- On mobile, either serve the 720px sequence or fall back to a static hero image. A
  120-frame scrub on a mid-range Android is a bad experience.

---

## 7. Sticky product scroll

Cheaper than a sequence and covers most of the same need: a pinned visual with text
panels advancing beside it.

```tsx
"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";

export function StickyFeature({ panels }: { panels: { title: string; body: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.08]);

  return (
    <section ref={ref} className="relative">
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        <motion.img src="/product.webp" alt="" style={{ scale }} className="h-full w-full object-cover" />
      </div>
      <div className="relative -mt-[100dvh]">
        {panels.map((p) => (
          <div key={p.title} className="flex min-h-[100dvh] items-center justify-end px-8">
            <div className="max-w-md">
              <h3 className="text-3xl font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-4 text-base leading-relaxed opacity-70">{p.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

## 8. Magnetic hover

Physics on the pointer, kept out of React state so it never re-renders.

```tsx
"use client";
import { useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";

export function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.25);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.25);
  };

  return (
    <motion.button
      ref={ref}
      style={{ x, y }}
      onMouseMove={onMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      className="rounded-full px-6 py-3 transition-transform duration-200 active:scale-[0.98]"
    >
      {children}
    </motion.button>
  );
}
```

Disable entirely on touch devices. There is no cursor to be magnetic toward.

---

## 9. Cleanup rules

- Every GSAP effect goes inside `gsap.context(...)` and is torn down with `ctx.revert()`.
- Every listener added is removed. Every `requestAnimationFrame` is cancelled.
- Call `ScrollTrigger.refresh()` after fonts load and after any late content injection,
  or pin distances will be computed against the wrong layout.
- In Next.js App Router, all of the above lives in `"use client"` components.
- On route change, kill triggers before the new page mounts, or pinned spacers leak.
