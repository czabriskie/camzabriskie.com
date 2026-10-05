# 0006. Primers: topic-grouped explainers, scrubbed of anything from work

**Status:** Accepted
**Date:** 2026-10-05

## Context

Cam wanted a place to share what he's learned (networking first) in a form other people
can learn from. The source material comes out of real work, so it arrives mixed with
customer names, hostnames, project decisions, and internal links that must never be
published. Tech Bytes didn't fit either: they're dated, chronological posts that record
a moment, while explainers are read in a deliberate order and get revised as
understanding improves.

## Decision

Add a third section, **Primers** (content collection `primers`, URL `/primers/`). Not
"Bytes", because on this site a byte is a post, and not "Learning", because these explain
things Cam already understands well enough to teach. The line between primers and Tech
Bytes:

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

Mechanics:

- Notes live at `src/content/primers/<topic>/<slug>.md` and render at
  `/primers/<topic>/<slug>/`. Topics are listed by hand in `src/lib/primers.ts`
  (title, blurb, display order); a topic with no published notes doesn't render.
- Frontmatter is `title`, `description`, `order`, `updated`, optional `draft`. Notes are
  sorted by `order` within a topic and shown as a two-digit position (`02 / 05`), not a
  byte number, and show the last-updated date instead of a publish date.
- Styled with the teal accent; no new hue.
- Primers can carry small interactive pieces (first one: the CIDR calculator in
  `src/scripts/cidr-calc.ts`). These are the site's first client-side JavaScript, so the
  rules are: plain TypeScript, no framework or dependency, loaded only on primer pages,
  and progressive enhancement. Markdown holds an empty placeholder `div`, the script
  fills it in, and the page still reads fine without JavaScript.
- **Material and understanding only.** No employer or customer names, hostnames, real
  addresses, network layouts, configs, project decisions, or internal links. Examples
  use RFC 1918 private ranges, RFC 5737 documentation ranges, and `example.com`.
- `scripts/check-primers.mjs` runs before `astro build` and fails the build if a note
  contains an IPv4 address outside the private, documentation, and special-purpose
  ranges, which is the most likely way a real environment leaks in via copy-paste.

## Consequences

- The IP check can't catch names, hostnames, or a described architecture. Keeping a
  denylist of customer names in this public repo would itself leak them, so that part
  stays a review rule: notes are writing under Cam's name and follow the same
  never-merge-without-Cam-reading rule as posts.
- Re-ordering notes is a frontmatter edit, and positions shift with it; URLs are slugs
  and don't change.
