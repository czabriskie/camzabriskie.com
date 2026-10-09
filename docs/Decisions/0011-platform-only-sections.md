# 0011. Marking sections that only apply to one platform

**Status:** Accepted
**Date:** 2026-10-09

## Context

Many primers explain a general idea and then show how one platform does it, usually
AWS: Route 53 in the DNS primer, ACM in the certificates primer, ALBs and NLBs in the
load balancer primer. A reader who doesn't use AWS had no way to tell, short of reading
it, that a section was safe to skip. Cam asked for a visual that says so.

## Decision

- A heading tagged `{only: AWS}` marks its section as platform-specific:
  `## Where Route 53 fits {only: AWS}`. Any label works (`{only: Azure}`,
  `{only: Kubernetes}`), but primers only use it for a vendor or product, not for an
  ordinary subtopic.
- A remark plugin (`src/lib/remark-only-sections.mjs`) removes the tag, so the heading
  text and its anchor stay clean, and wraps everything up to the next heading of the same
  or higher level in a `<section class="only-section">`.
- The section gets a small "AWS only" tag under its heading, and nothing else. A dashed
  border down the whole section and a "Skip to <next heading>" link were tried and
  dropped: the border was distracting, and the tag alone says the section can be
  skipped. The tag uses the existing palette (ink and muted), so no new hue is added.
- Whole primers that are about AWS (VPCs, EBS vs EFS) aren't tagged. Their titles and the
  topic's section blurb ("Skip this part if you don't use AWS") already say it.

## Consequences

- Tagging is a per-heading judgment made when writing or reviewing a primer, and the
  `primer` skill lists it as a check.
- The tag only works on top-level headings in the markdown (not headings inside HTML
  blocks or asides), and the wrapped section ends at the next heading of the same or
  higher level, so a tagged `###` stops at the next `###` or `##`.
- Without CSS the section still reads normally, with the tag as plain text.
