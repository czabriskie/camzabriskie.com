# 0001. Astro static site on GitHub Pages

**Status:** Accepted
**Date:** 2026-08-18

## Context

Rebooting camzabriskie.com as a personal site (resume + two blogs) whose main job is
hosting long-form posts that weekly LinkedIn drafts link to. The prior site went dormant;
the domain (owned through 2028 at GoDaddy) currently serves a parking page. Cameron asked
to mirror the ClimbIQ repo's agent/workflow setup. ClimbIQ itself is Next.js on Vercel,
but that stack earns its complexity from auth, a database, and server actions — none of
which a content site has.

## Decision

- **Astro 5, fully static** — content collections give typed frontmatter for the two
  post streams; zero client-side JS by default.
- **GitHub Pages via GitHub Actions** — deploys stay in the same GitHub workflow world
  as the rest of the setup (CI, agents, scheduled cloud sessions); free; custom-domain
  support via CNAME. No new hosting account or secrets.
- **Deploy on push to `main`**, not tag-gated like ClimbIQ production: a personal blog
  has no staging environment or database boundary to protect, and "merged = live" is the
  behavior a blog wants.

## Consequences

- No server-side features (forms, comments, previews-per-PR) without revisiting hosting.
- DNS must be pointed at GitHub Pages (A records for apex + CNAME for www); until then
  the site is only reachable at czabriskie.github.io.
- Repo must be public (GitHub Pages on the free plan) — acceptable: the content is
  public by definition, and the workflow/docs structure is worth showing anyway.
