# camzabriskie.com

## Goals

1. A home for long-form writing that LinkedIn posts (drafted weekly via the Signal Log
   pipeline) can point to.
2. Two distinct blog streams, continuing the site's original identity: **Tech Bytes**
   (engineering) and **Life Bytes** (everything else).
3. A public, print-friendly resume.
4. Primers: explainer documents for things Cam has learned, kept separate from the
   posts (Decision 0006 draws the line).
5. Near-zero maintenance: static output, no database, no analytics, deploys on push.

## Pages

- `/` — intro + latest bytes from both streams
- `/tech-bytes/`, `/life-bytes/` — stream indexes
- `/tech-bytes/<slug>/`, `/life-bytes/<slug>/` — posts
- `/primers/`, `/primers/<topic>/`, `/primers/<topic>/<slug>/` — Primers:
  explainers grouped by topic, read in order, revised over time (Decision 0006). Topics
  are listed in `src/lib/primers.ts`. /primers/ shows topic cards, recently updated
  primers, and a filter; topic pages can group primers into sections (Decision 0009).
- `/primers/references/` — every source cited by any primer (Decision 0007).
- `/projects/` — curated public GitHub projects, grouped as tools / experiments / teaching
- `/resume/` — resume (email + GitHub only; no phone/address)

Project entries live in `src/lib/projects.ts`, hand-written rather than pulled from the
GitHub API (Decision 0003). Adding a project means adding it there. Drift against Cam's
actual public repos is caught weekly by `.github/workflows/projects-drift.yml`, which
files the unlisted ones as a `projects-drift` issue for the routine to draft from
(Decision 0004).

## Content model

See `AGENTS.md` → "Content model". Short version: markdown files in
`src/content/<stream>/`, frontmatter `title`/`description`/`date`/`draft`, filename is
the slug, byte numbers assigned chronologically at build time.

Primers live in `src/content/primers/<topic>/` with frontmatter
`title`/`description`/`order`/`updated`/`draft`. They hold the material and Cam's
understanding of it, never anything specific to an employer or customer; the build
rejects real-looking public IP addresses in them.

## Publishing flow

Local: write markdown → `npm run build` → PR → merge → Pages deploys.
Cloud: the `byte-writer` agent can draft posts in a cloud session (with vault context via
the obsidian-cloud-sync setup) and open a PR for review.

LinkedIn posts are scheduled from this repo too (Decision 0005): the weekly routine opens
PRs against `linkedin/queue/`, merging schedules, and an Actions cron publishes via
LinkedIn's free API. See `linkedin/README.md`.

## Deferred (revisit when wanted)

- RSS feeds per stream (`@astrojs/rss`)
- Sitemap (`@astrojs/sitemap`)
- OG images for posts
- `www.camzabriskie.com` redirect
