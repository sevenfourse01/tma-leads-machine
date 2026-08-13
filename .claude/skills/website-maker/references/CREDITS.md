# Credits and licences

`website-maker` is a synthesis. The methodology below is distilled and rewritten from
five MIT-licensed open source projects, cloned from GitHub on 12 August 2026. Where code
skeletons are adapted rather than rewritten, the source is noted.

| Project | Author | Licence | What was drawn from it |
|---|---|---|---|
| [taste-skill](https://github.com/Leonxlnx/taste-skill) | Leon Lin (Leonxlnx) | MIT | The design-read step, the three-dial model, the anti-slop tell list, the design-system honesty rule, and the sticky-stack, horizontal-pan and reveal-stagger skeletons. Also the `soft-skill` and `minimalist-skill` variants, which informed the materials and vibe-variant sections. |
| [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Next Level Builder | MIT | The searchable style, colour, typography and UX database bundled at `references/uiux-db/`, including its `search.py`, used unmodified. |
| [cinematic-scroll-landing](https://github.com/kash-123/cinematic-scroll-landing) | kash-123 | MIT | One-visual-universe discipline, the shared fixed atmosphere layer, single transition grammar, scroll-runway budgeting, the preloader-is-your-LCP warning, and several deploy-time gotchas. |
| [zero-jank-scroll-agent-skill](https://github.com/harshavarma02/zero-jank-scroll-agent-skill) | Harsha Varma | MIT | The scroll performance guardrails, compositing hygiene, and the verify-with-evidence requirement. |
| [mente-designer](https://github.com/eulucasduty/mente-designer) | eulucasduty | unspecified | Lenis plus GSAP ScrollTrigger patterning. Referenced conceptually only; no code copied, as no licence is declared. |

Original to this skill: the Apple design language reference (`apple-language.md`), the
token set (`assets/apple-tokens.css`), the canvas image-sequence scrub recipe, the sticky
product-scroll and magnetic-hover recipes, and the ship checklist.

## Upstream

These projects are actively maintained and worth checking periodically. If you want the
upstream skills alongside this one rather than folded into it:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
```

The bundled database at `references/uiux-db/` is a point-in-time copy. To refresh it,
clone `nextlevelbuilder/ui-ux-pro-max-skill` and replace the `data/` and `scripts/`
directories from `.claude/skills/ui-ux-pro-max/`.

## Licence

MIT, consistent with the sources.
