# 0007. Primer citations: one source list, IEEE numbering per page

**Status:** Accepted
**Date:** 2026-10-05

## Context

Primers explain technical material that comes from standards and vendor documentation,
and Cam wanted readers to see where each claim comes from and where to read further.
Several primers draw on the same sources (the AWS VPC User Guide, the address-range
RFCs), so per-page bibliographies written by hand would duplicate entries and drift.
IEEE-style numbered citations were the requested format.

## Decision

- Every source is defined once in `src/data/references.mjs`, keyed by a short ID, with
  authors, title, container, date, URL, and the date it was last checked.
- Primers cite with `[@key]` (or `[@key1, @key2]`) in markdown. A remark plugin
  (`src/lib/remark-citations.mjs`, registered in `astro.config.mjs`) replaces each with a
  linked `[n]`, numbering sources per page in order of first citation as IEEE does, and
  appends a "References" section with the entries in IEEE format.
- Each citation gets its own id, and each reference links back to where it was cited
  (↩ for one use, ↩ a b c for several, Wikipedia-style), so readers can return to the
  sentence they came from without relying on the browser's Back button.
- `/primers/references/` lists every cited source once, sorted by author, with links
  back to the primers that cite it.
- `scripts/check-primers.mjs` fails the build on a citation key that isn't defined.
  The plugin throws too, but Astro logs content-render errors and keeps building, so the
  pre-build check is the real gate.
- A source only goes in the list if it was actually read and supports what it's cited
  for. Facts a primer states without a source stay uncited rather than getting a
  plausible-looking reference.

## Consequences

- Numbers are per page, so `[3]` means different sources on different primers. The
  shared page links by key instead of number.
- Astro caches rendered content in `node_modules/.astro`. After changing the plugin or
  the reference formatter, delete that directory (and `.astro`) before a local build,
  or pages show stale output. CI always builds from scratch.
- `accessed` dates go stale. When a primer is revised, re-check the sources it cites and
  update their dates.
