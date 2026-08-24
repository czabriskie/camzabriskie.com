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
├── Decisions/       ADR-style decision log — 000N-short-slug.md, zero-padded, incrementing
└── Experiments/     protocols for content experiments — same numbering scheme; the
                     protocol is public, but per-post data (e.g. which posts are
                     AI-drafted) stays out of this public repo
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
  blog post.** Writing published under Cam's name gets read by Cam before it goes live,
  every time, no matter how green CI is. Open the PR, say what it is, and leave it. This
  is what the weekly drafting routine does, and it applies to any agent or session.
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
