# 0010. Primers aren't limited to tech: Philosophy is the first non-tech topic

**Status:** Accepted
**Date:** 2026-10-08

## Context

Cam has been studying philosophy and theology (starting with the *Philosophize This!*
podcast) and wanted somewhere to keep polished versions of what he's learned. Decision
0006 introduced primers with networking as the first topic, and everything around them
(the IP-address check, PowerShell tabs, the teal accent) grew up around tech. The
question was whether non-tech subjects belong on this site, which doubles as his
professional site, or on a separate one.

## Decision

- **Primers can be about any subject.** The test from Decision 0006 (a document you'd
  send someone to explain an idea, revised as understanding improves) doesn't depend on
  the subject. Philosophy is added as a topic in `src/lib/primers.ts`, and theology or
  others can follow the same way.
- **Only polished explainers go here.** Rough notes and half-formed ideas from other
  subjects don't. If Cam wants a place for those later, it's a separate site, so the
  primer standard (cited, reviewed before merge) doesn't have to drop.
- **Same rules as every primer.** Voice rules, citations through `src/data/references.mjs`,
  and the never-merge-without-Cam-reading rule all apply. For philosophy, citations
  favor the Stanford Encyclopedia of Philosophy and the Internet Encyclopedia of
  Philosophy over the podcast, and a primer that follows a podcast or book says so and
  flags where the popular telling and the scholarship disagree.
- **Primers stay teal.** The accent marks the section, not the subject, so no new hue
  (the two-accent rule still holds).
- **Start broad, split later.** A topic can start with one primer covering a whole
  period (the first is "The Presocratics") and split into one primer per thinker or idea
  as it grows. Splitting means new slugs, and the broad primer can stay as the overview
  that links to them, so existing links don't break.

## Consequences

- The IP-address check in `scripts/check-primers.mjs` does nothing useful for non-tech
  primers, which is fine. It only fails on dotted-quad addresses.
- /primers/ copy ("explainers for things I've had to learn") still reads correctly for
  both kinds of topic, so it isn't changed.
- Mixing subjects on a professional site is a deliberate choice. Philosophy primers are
  explanatory, not confessional, which is what makes them fit next to the resume.
