# Archived: the three separate demos

These are the original one-per-pillar demos: **Predict**, **Build** and **Grow**, each a standalone
page. They are archived, not deleted — nothing links to them from the site or from `/demo/`, but
every one still works if you open it directly:

- `/demo/archive/predict.html` — 7 questions plus the live three-slider forecast, real Monte Carlo
- `/demo/archive/build.html` — the 15-node canvas, the systems mapping, one step shown three ways
- `/demo/archive/grow.html` — one ordinary Tuesday, four example weeks, the Monday questions

## Why they were archived (2026-07-31)

Zach's call: making a prospect choose between three demos, and choose an industry from nineteen
buttons, before anything happened at all was too much work to ask up front. The point of these
pages is to show a business how TMA creates value for *them*, and one personalised path does that
better than three separate ones. `/demo/` now leads straight into `full.html`.

## If you bring one back

They depend on `../styles.css`, `../shared.js` and (Predict only) `../engine.js`, so they must stay
one level below `/demo/`. `shared.js` is shared with the live demo — the `PRESETS`, `BUILDS` and
formatting helpers these pages use are the same objects `full.js` uses, so a change there affects
both. Nothing in this folder is loaded by the live demo.
