# 0003. Projects page is a hand-curated list, not the GitHub API

**Status:** Accepted
**Date:** 2026-08-19

## Context

The resume links to `github.com/czabriskie` and stops there, which leaves a visitor to
sort 23 public repos by themselves. Cam wanted a page that showcases the projects and
says what they do.

Two ways to build it: fetch the repos from the GitHub API at build time and render
whatever comes back, or keep the list in the repo and write the copy by hand.

## Decision

Hand-curated. The list lives in `src/lib/projects.ts` as plain data — name, stack, and a
blurb written from each repo's README — and `src/pages/projects.astro` renders it in three
groups: tools Cam uses, experiments, and IS 3600 teaching material.

Curation rule: a repo earns a spot by doing something. Practice scratch repos, one-line
READMEs, and anything superseded by a fuller example are left off entirely rather than
listed for completeness. Private repos never appear.

## Consequences

- The page goes stale on its own. A new public repo shows up only when someone adds it
  here, which is the tradeoff for having real descriptions instead of GitHub blurbs. A
  weekly routine ("Projects page drift check", Mondays 8am MT) covers the drift: it diffs
  the live public repos against `src/lib/projects.ts`, drafts blurbs for anything that
  clears the curation bar, and opens a PR for Cam to read. It never merges, and a week
  with nothing new produces no PR and no notification.
- Enumerating the repos only works through the GitHub MCP `search_repositories` tool. The
  session proxy answers 403 to `api.github.com/users/<user>/repos` and to github.com
  profile pages, allowing only endpoints scoped to the session's own repositories;
  `raw.githubusercontent.com` is reachable, which is how READMEs get read.
- No build-time network call, no API token, no rate limit; the build stays offline and
  deterministic, consistent with Decision 0001.
- Repo metadata that would be free from the API (stars, last push, language) is absent by
  choice. Stars are all zero and a "last updated" date on a finished project reads as
  neglect rather than information.
