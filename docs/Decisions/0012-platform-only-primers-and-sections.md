# 0012. Marking primers and sections that only apply to one platform

**Status:** Accepted
**Date:** 2026-10-09

## Context

Decision 0011 added an "AWS only" tag for sections that only explain how one platform
does something (Route 53 in the DNS primer, ACM in the certificates primer), and left
whole AWS primers untagged on the grounds that their titles already said so. Not every
title does ("Reaching private resources" is almost entirely AWS), and a reader scanning
the primer list or the topic page couldn't tell which primers they could skip. Cam asked
for whole documents to get the same tag.

## Decision

- **Sections** (unchanged from 0011): a heading ending in `{only: AWS}` gets a small
  "AWS only" tag under it. `src/lib/remark-only-sections.mjs` strips the tag from the
  heading and wraps the section up to the next heading of the same or higher level in a
  `<section class="only-section">`. A dashed border and a "Skip to…" link were tried and
  dropped; the tag alone is enough.
- **Whole primers**: frontmatter `only: AWS` (an optional string in the primer schema)
  puts the same tag next to the primer's date on its page, and next to its title
  everywhere primers are listed: the topic page, the topic cards, "Recently updated", and
  the filter results. The filter also matches the label, so typing "aws" finds them.
- A primer tagged as a whole doesn't also tag its sections.
- Any label works (`AWS`, `Azure`, `Kubernetes`), but it's for a vendor or product, not an
  ordinary subtopic. A section or primer that explains a general idea using AWS as the
  example isn't tagged; one that's only about how AWS does it is.
- The tag uses the existing palette (ink and muted), so no new hue is added.

## Consequences

- Tagging is a judgment made when writing or reviewing a primer, and the `primer` skill
  lists it as a check.
- Section tags only work on top-level markdown headings (not inside HTML blocks or
  asides), and a tagged `###` section ends at the next `###` or `##`.
- Without CSS the tag reads as plain text ("AWS only").
