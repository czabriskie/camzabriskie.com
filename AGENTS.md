# camzabriskie.com

Personal website for Cameron Zabriskie: resume plus two blogs ("bytes") — **Tech Bytes**
(engineering) and **Life Bytes** (everything else). Static Astro site deployed to GitHub
Pages at https://camzabriskie.com. LinkedIn posts point here for the long-form version.

## Documentation

Docs live in `docs/` (structure borrowed from the ClimbIQ project). Decision numbers in
comments (e.g. "Decision 0001") point to `docs/Decisions/`.

```
docs/
├── Site.md          project goals, content model, page inventory
└── Decisions/       ADR-style decision log — 000N-short-slug.md, zero-padded, incrementing
```

**Decisions/** rules: one file per consequential decision, written after the fact as a
record. Template: Status / Date / Context / Decision / Consequences. Never renumber or
edit an old record except to flip Status to `Superseded by 000M`. Next number = highest
existing + 1 — `ls docs/Decisions/` first.

## Content model

- Posts are markdown in `src/content/tech-bytes/` and `src/content/life-bytes/`.
- Frontmatter: `title`, `description`, `date` (YYYY-MM-DD), optional `draft: true`.
- Filename is the URL slug (`vault-in-the-container.md` → `/tech-bytes/vault-in-the-container/`).
- Posts get a "byte number" automatically — chronological order within their stream,
  displayed as 8 bits. Don't hand-assign numbers.
- **Voice**: first person, plain vocabulary, modest, run-on sentences over punchy
  fragments, no em dashes in post prose, endings trail off rather than summarize. The
  `byte-writer` agent has the full rules — new post drafts go through it.
- **No throat-clearing.** Don't announce a point before making it. Cut the sentence and
  keep the point. Cam flagged this himself (2026-09-07) as the thing that most makes a
  draft not sound like him, and it applies to blog posts and `linkedin/queue/` files
  alike. Banned outright, in any tense or person:
  "the thing I keep coming back to" / "what I keep coming back to", "the one thing" /
  "the one piece", "the thing is", "here's the thing", "here's what actually…",
  "the part that actually…" / "the part I actually…", "what actually let that happen",
  "the interesting part" / "the interesting thing" / "the interesting shift",
  "the way I think about it", "the honest complication" / "the honest shape of it",
  "worth noticing", "at the end of the day", "the truth is".
  Also the whole "the thing that…" family, which is the same move wearing a
  different hat: "the thing that actually got to me", "what really got me was",
  "the bit that stuck with me was". Front the point, don't build up to it.
  "The ads annoyed me, but the thing that actually got to me was X" becomes
  "The ads annoyed me. X annoyed me more."
  **And the underlying grammar, which is what actually keeps slipping through:
  the it-cleft / wh-cleft.** Any sentence of the shape "What <verb phrase> is <the
  point>" or "The one that <verb> is <the point>" delays the point for emphasis, and
  swapping one for another is not a fix. "What stuck with me is which feature turned
  out to be load-bearing", "What I got out of it is two things", "What actually
  determines the calendar is the testing rule", "The one I had wrong is the signing
  key" — all the same move. Rewrite subject-first ("The testing rule determines the
  calendar", "I got two things out of it") or delete the sentence and let the next
  one land on its own.
  The pattern matters more than the list: a sentence whose whole job is to tell the
  reader that the next sentence is important is filler, so delete it and let the next
  sentence do the work. Rewriting a banned phrase into a different cleft is the most
  common way this rule gets broken by someone trying to follow it, so before handing a
  draft back, grep it for `^What ` and `\. What ` as well as the phrase list.

## Primers

**Primers vs. Tech Bytes.** A Tech Byte is a post: something Cam did, built,
broke, or changed his mind about, dated, told in first person, and never revised after
publishing because it records a moment. A primer is a document: it explains one
concept to someone who doesn't know it yet, is read in an order that builds, uses
headings/tables/diagrams freely, and gets revised whenever understanding improves (so it
shows "updated", not a publish date). Test: if you'd send someone the link in six months
to explain the idea, it's a primer; if quietly editing it later would feel wrong,
it's a Tech Byte. One experience can produce both, and then the post links to the
document instead of explaining the concept inline. That split is also how work stays out
of it: the post can stay vague about the job while the document carries the substance.

- Primers aren't tech-only (Decision 0010): Philosophy is a topic too. Non-tech primers
  cite the Stanford or Internet Encyclopedia of Philosophy over podcasts, and say where
  the popular version and the scholarship disagree.
- Primers live in `src/content/primers/<topic>/<slug>.md` (Decision 0006);
  frontmatter `title`, `description`, `order` (reading order in the topic), `updated`,
  optional `draft`. New topics also need an entry in `src/lib/primers.ts`, and a new
  primer in a topic with sections (`sections` in the same file, Decision 0009) needs a
  line there too, or it lands in that topic's "More" group.
- **Strictly the material and Cam's understanding of it. Nothing from work.** Source
  notes usually come from real projects (often his work vault), so scrub before
  writing: no employer or customer names or abbreviations, hostnames, certificate
  names, real IPs or CIDRs, network layouts, vendor stacks tied to a specific customer,
  project options/decisions, ticket or Confluence links, diagram filenames, or "on this
  project we…" framing. Re-teach the concept with generic examples instead.
- Example addresses come only from RFC 1918 (`10/8`, `172.16/12`, `192.168/16`) or RFC
  5737 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`), IPv6 examples from RFC
  3849 (`2001:db8::/32`), and hostnames from `example.com`. `scripts/check-primers.mjs`
  fails the build on other IPv4 addresses; it can't catch IPv6 or names, so the scrub
  above is on the writer.
- Same voice rules as posts (no em dashes, no throat-clearing, no clefts), but structure
  is welcome: headings, tables, diagrams. Same merge rule too: Cam reads it first.
- **Cite sources** (Decision 0007). Define each source once in `src/data/references.mjs`
  and cite it with `[@key]`; the build numbers citations IEEE-style per page and appends
  a References section. Only cite what you actually read and checked supports the claim,
  and set `accessed` to the date you checked it. Unknown keys fail the build. After
  changing the citation plugin or formatter, `rm -rf .astro node_modules/.astro` before
  building locally, or you'll see cached output.
- **Commands get a PowerShell tab where they differ** (Decision 0008). Write the
  macOS/Linux version and the Windows version as consecutive fenced blocks with
  `tab="macOS / Linux"` and `tab="Windows (PowerShell)"` in the meta; the build groups
  them into tabs. Commands that are identical everywhere stay a single block. Test
  PowerShell where you can (pwsh 7 runs on macOS) and cite Microsoft's docs for
  Windows-only cmdlets. A `<div class="cmd-builder" data-default="example.com"
  data-label="Site"></div>` before a block lets readers fill in their own value.

## LinkedIn scheduler

LinkedIn posts are pushed and scheduled from this repo, not a third-party tool
(Decision 0005). Draft posts arrive as PRs adding files to `linkedin/queue/`; merging
schedules them, and `.github/workflows/linkedin-publish.yml` publishes due posts via
LinkedIn's free consumer API, moving each to `linkedin/posted/` as the publish record.
`linkedin/README.md` has the file format, setup, and token-renewal notes;
`linkedin/VOICE.md` is the style source the weekly drafting routine reads.

## Article backlog

- **Future article ideas live as GitHub issues on this repo, labeled `article`** — not in
  chat transcripts, vault notes, or a scratch file. The moment a conversation or a piece
  of work surfaces "this would make a good post," file the issue then and there: working
  title, which stream it belongs to (Tech Bytes or Life Bytes), the angle in a sentence
  or two, and links to the source material (a ClimbIQ research doc, a vault note, a PR).
  An idea that only exists in a transcript is lost by next week.
- If the idea is blocked on something happening first (an experiment that hasn't run,
  numbers that don't exist yet), say so in the issue body so nobody drafts it prematurely.
- When a post gets drafted (through `byte-writer`, per the voice rules above), reference
  the issue from the PR and close the issue when the post merges. The issue list stays a
  live backlog, not an archive.

## Writing code

- Astro 5, static output, no client-side framework. Keep it that way unless a Decision
  says otherwise. Styling is one global stylesheet (`src/styles/global.css`) with CSS
  custom properties for the palette; light and dark both derive from the same tokens.
- Two accent hues are load-bearing: teal = Tech Bytes, ochre = Life Bytes. Don't add more.
- `npm run build` must pass before any PR. There are no unit tests on this repo — the
  build (which type-checks content frontmatter against the collection schema) is the gate.

## PRs and merging

- Branch, PR, squash-merge. Cam has granted the same standing rule he uses on
  ClimbIQ: a PR authored through this repo's normal flow whose CI is green is
  pre-approved to squash-merge. Content-only PRs (posts, docs) skip CI by path filter;
  for those, a local `npm run build` before the PR is the gate.
- **Exception, and it overrides the standing rule: never merge a PR that adds or edits a
  blog post, a primer, or a `linkedin/queue/` file.** Writing published under
  Cam's name gets read by Cam before it goes live, every time, no matter how green CI
  is. Open the PR, say what it is, and leave it. This is what the weekly drafting routine does, and it applies to any
  agent or session. For queue files the merge itself is the schedule step (Decision 0005),
  which makes this rule load-bearing twice over.
- A push to `main` deploys to production (GitHub Pages). There is no staging site; that
  is a deliberate simplicity choice for a personal blog (Decision 0001). Preview locally
  with `npm run dev`.

## Agent flow

- `byte-writer` — drafts/edits posts in Cameron's voice; never invents facts or personal
  details, works from material Cameron provides (or his vault, in cloud sessions).
- `reviewer` — pre-PR gate for code changes: correctness, this repo's conventions,
  no secrets, build passes. Not needed for content-only changes.
- `docs-maintainer` — keeps `docs/` honest; new consequential choices get a Decision.

## Privacy

- Resume shows email + GitHub only — never the phone number, street address, or family
  details. Life Bytes may reference family only in ways Cameron has explicitly written
  or approved himself.
- No analytics, no trackers, no third-party scripts except Google Fonts.
