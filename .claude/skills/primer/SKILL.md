---
name: primer
description: Use when writing, revising, or reviewing a primer in src/content/primers/ (including reviewing someone else's primer PR before Cam approves it). Covers the beginner pass, looking for visuals, verifying every claim against its source, PowerShell tabs, voice, and the build and PR steps.
---

# Writing and reviewing primers

A primer explains one concept to someone who doesn't know it yet (AGENTS.md, "Primers").
These steps are the standard for every new primer and every review of one, whoever wrote
it. Follow them in order and report what each step found.

## 1. Scrub

Nothing from work: no employer or customer names, hostnames, real IPs or CIDRs, network
layouts, ticket links, or "on this project we…" framing. Example addresses come from RFC
1918 / RFC 5737 / RFC 3849, names from `example.com`. Re-teach with generic examples.

## 2. Read it as a beginner

Read the draft as someone who has never used the tool, and fix every place they'd stall:

- **Define before use.** Every term gets a plain definition before or where it first
  appears. A primer that leans on several terms gets a short "A few terms" list near the
  top (see `networking/` or `working-with-ai/` primers for the pattern).
- **Name collisions with everyday words.** When a term's technical sense differs from its
  everyday sense ("target", "destination", "release"), say what it is *not* and give the
  plainer name.
- **One concrete example, walked step by step,** before the abstract rule. A running
  example (one made-up app, one packet, one ticket) that later sections keep using beats
  a new example per section. Introduce it before the first section that relies on it.
- **Flow.** No forward references to things explained later, no point made twice, and
  every section follows from the one before. Each table or list gets a sentence leading
  into it.
- **Trim.** Detail most readers don't need goes in `<details class="aside">` with a
  `<summary>`.
- **Mark platform-only content** (Decision 0012). A section that only explains how one
  vendor does it (Route 53, ACM, CloudFront) gets `{only: AWS}` at the end of its heading.
  A primer that's only about AWS gets `only: AWS` in its frontmatter instead. General
  explanations that just use AWS as the example aren't tagged.

## 3. Look for visuals

Always ask what a reader would understand faster from a picture than from the text, and
add it where one exists. Candidates:

| The text describes… | Try |
|---|---|
| Steps in order, or a request passing through components | A flow diagram with numbered steps |
| A size, count, or limit | A bar or scale with the limit marked |
| Something wrapped in something else | Nested boxes (see `.encap-layer`) |
| Which of several paths traffic takes | A path diagram with the two cases side by side |
| A comparison across options | A table (already a visual; keep it) |
| A calculation the reader could try | An interactive widget (CIDR calculator, command builder) |

A diagram that only restates one sentence isn't worth it. A diagram that replaces a
paragraph the reader would have to read twice is.

Conventions for inline SVG diagrams:

- Wrap in `<div class="<name>" role="img" aria-label="…">` with an `aria-label` that
  describes the whole picture in words, and `aria-hidden="true" focusable="false"` on the
  `<svg>`. Follow it with `<p class="bitgrid-caption">` saying what to notice.
- Style with classes in `src/styles/global.css`, prefixed per diagram (`.k8p-*`,
  `.air-*`), using only the palette tokens (`--ink`, `--muted`, `--surface`, `--line`,
  `--tech`) so light and dark both work. Teal is the only accent. Container
  `max-width: 32rem`, SVG `width: 100%; height: auto`.
- Text: names in `600 10px 'Bricolage Grotesque'`, detail in `8.5px 'IBM Plex Mono'`.
- Check it rendered: build, serve the output, take a headless Chrome screenshot
  (`gtimeout 40` with a fresh `--user-data-dir`), and look for overlapping labels and
  clipped text before calling it done.

## 4. Verify every claim

- Cite with `[@key]`, sources defined once in `src/data/references.mjs` (Decision 0007).
- Only cite what you actually read and checked supports the claim; set `accessed` to the
  date you checked. If a source can't be reached, don't cite it, and say so.
- For behavior the docs don't state (what order a tool does things in, how something is
  counted), read the source code and cite it pinned to a commit
  (`github.com/<org>/<repo>/blob/<full sha>/<path>#L<a>-L<b>`). Drafts often get this kind
  of detail wrong, so check it rather than trusting the draft.
- Numbers get checked by arithmetic, not by eye.

## 5. Commands

Where a command differs on Windows, add a `tab="Windows (PowerShell)"` block after the
`tab="macOS / Linux"` one (Decision 0008), and run the PowerShell with pwsh 7 (it runs on
macOS), stubbing external tools with a function if needed. Cite Microsoft docs for the
cmdlets and .NET APIs used. Commands that are identical everywhere stay one block. Give
the measuring or checking command whenever the text tells the reader to measure or check
something.

## 6. Voice

Same rules as posts: no em dashes, no throat-clearing, no clefts. Before handing back,
grep for `—`, `^What `, `\. What `, `the thing`, `here's`, `worth`, `actually`, and the
phrase list in AGENTS.md.

## 7. Build and PR

- `rm -rf .astro node_modules/.astro && node scripts/check-primers.mjs && npx astro build`.
- New topic: add it to `src/lib/primers.ts` (and `sections` if it has several parts).
- Open the PR, or push to the existing one, and say what changed and what each review
  step found. **Never merge a primer PR without Cam saying so** (AGENTS.md).
