# camzabriskie.com

## Goals

1. A home for long-form writing that LinkedIn posts (drafted weekly via the Signal Log
   pipeline) can point to.
2. Two distinct streams, continuing the site's original identity: **Tech Bytes**
   (engineering) and **Life Bytes** (everything else).
3. A public, print-friendly resume.
4. Near-zero maintenance: static output, no database, no analytics, deploys on push.

## Pages

- `/` — intro + latest bytes from both streams
- `/tech-bytes/`, `/life-bytes/` — stream indexes
- `/tech-bytes/<slug>/`, `/life-bytes/<slug>/` — posts
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

## Publishing flow

Local: write markdown → `npm run build` → PR → merge → Pages deploys.
Cloud: the `byte-writer` agent can draft posts in a cloud session (with vault context via
the obsidian-cloud-sync setup) and open a PR for review.

## Deferred (revisit when wanted)

- RSS feeds per stream (`@astrojs/rss`)
- Sitemap (`@astrojs/sitemap`)
- OG images for posts
- `www.camzabriskie.com` redirect
