# website-maker

An Apple-grade website building skill for Claude Code, synthesised from five MIT-licensed
open source design skills plus original material. See `references/CREDITS.md` for
provenance.

## Install

Unzip, then:

```bash
# the skill itself
mkdir -p ~/.claude/skills
cp -r website-maker ~/.claude/skills/website-maker

# optional: the /website-maker slash command
mkdir -p ~/.claude/commands
cp website-maker/commands/website-maker.md ~/.claude/commands/
```

Restart Claude Code, or run `/skills` to confirm it is discovered.

For a single project rather than globally, use `.claude/skills/` inside the repo instead.

## Use

The skill auto-triggers on website, landing page, hero, portfolio and redesign requests.
You can also invoke it explicitly:

```
/website-maker a landing page for a UK dental practice, calm and clinical, booking-led
```

Steer it conversationally with the dials:

```
push variance to 9, drop density to 2
motion down to 3, this needs to be static and fast
```

## Layout

```
website-maker/
├── SKILL.md                        orchestrator: workflow, dials, gates
├── README.md
├── assets/
│   └── apple-tokens.css            drop-in token set
├── commands/
│   └── website-maker.md            optional slash command
└── references/
    ├── apple-language.md           the core aesthetic spec
    ├── anti-slop.md                banned defaults and AI tells
    ├── motion-recipes.md           working GSAP/Motion skeletons
    ├── scroll-performance.md       zero-jank and accessibility rules
    ├── ship-checklist.md           final gate
    ├── CREDITS.md                  provenance and licences
    └── uiux-db/                    searchable style/colour/type database
        ├── data/                   14 CSV datasets
        └── scripts/search.py       Python 3, offline, no key
```

## Database lookup

```bash
python3 ~/.claude/skills/website-maker/references/uiux-db/scripts/search.py \
  "premium consumer landing" --domain typography -n 3
```

Domains: `style`, `color`, `typography`, `ux`, `landing`, `motion`, `icons`, `charts`,
`products`, `app-interface`. Add `--design-system` for a full recommendation set, or
`--json` for untruncated output.

## Licence

MIT.
