# 0006. Pages published here on behalf of other projects

**Status:** Accepted
**Date:** 2026-09-07

## Context

Rhythm Gardens, an Android game in the private repo `czabriskie/bee-game`,
needs a **publicly reachable privacy policy URL** before it can be listed on
Google Play — required even though the app collects nothing, because Play's
data safety form demands the link in order to declare zero collection, and a
child-directed app must carry it in the listing and in the app itself.

The game's repo is private, so GitHub Pages from it is not a free option.
This site is already public, already on Pages, already deploys on merge, and
sits on a domain Cameron owns — so the URL survives anything that happens to
a hosting account. That makes it the right place to publish, and it creates a
problem worth naming: a document whose **facts live in another repository**
now sits in this one, where the next person to tidy a page has every reason to
think they may edit it.

## Decision

Pages published on behalf of another project are **hosted here, owned there.**

- `AGENTS.md` gains a "Content owned by other projects" table: path, owning
  repo, source of truth, and what event should cause the text to change.
- Each such page carries a banner comment naming the upstream repo, the source
  file, and the copy date.
- `.github/CODEOWNERS` gates those paths so a PR touching them requests review.
  CODEOWNERS can only name users and teams, never a repository, so it is a
  tripwire and not the record of ownership — the table is.
- The first entry is `/src/pages/rhythm-gardens/`, owned by
  `czabriskie/bee-game`.

## Consequences

- Fixing a fact in one of these pages is a two-repo change, deliberately. The
  friction is the point: a privacy policy that drifts from the app it
  describes is worse than one that is slightly out of date and known to be.
- These URLs become long-lived commitments. Play requires the policy link to
  keep resolving for as long as the app is listed, so renaming or removing the
  path is a store problem, not a site problem.
- The site keeps its "no third-party anything" posture; a hosted policy is
  static text and adds no scripts.
- If a second project ever needs the same treatment, it is a row in the table,
  not a new mechanism.
