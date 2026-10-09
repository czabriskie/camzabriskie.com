# 0009. Primer navigation: topic cards, sections, recently updated, and a filter

**Status:** Accepted
**Date:** 2026-10-08

## Context

/primers/ listed every topic and every primer with its full description on one page.
With Networking past ten primers and three more topics on the way, the page became a
long scroll, and the topics after Networking were easy to miss. Cam asked for the
primers to be navigable by topic.

## Decision

- **/primers/ shows topic cards.** One card per topic: title, blurb, primer count, the
  first three primer titles, and a "+ N more" link to the topic page. The full list with
  descriptions lives on each topic page.
- **"Recently updated"** sits above the cards: the five primers with the newest
  `updated` dates across all topics, since primers get revised over time.
- **A filter box** above that searches every primer's title, description, and topic as
  you type (`src/scripts/primer-filter.ts`, plain JavaScript). The page renders the full
  list hidden, and the script shows matches and hides the cards. Without JavaScript the
  box never appears and the cards stay.
- **Sections inside a topic.** A topic page can split its primers into labeled groups
  with jump links at the top. The groups are defined in one place, `sections` in
  `src/lib/primers.ts`, by primer slug, rather than as a frontmatter field, so primers
  still in open PRs can be placed without editing those PRs. A listed slug that isn't
  published is skipped, and a published primer that isn't listed falls into a final
  "More" group, so nothing disappears. Each primer keeps its reading-order number from
  `order`, so numbers within a section can skip.

## Consequences

- A new primer in a sectioned topic should be added to `sections`, or it shows under
  "More".
- Reading order (`order`) and sections are independent. Sections are for browsing, the
  numbers and the previous/next links on primer pages still follow `order`.
- The filter searches only what's on the index page (titles, descriptions, topic
  names), not primer bodies.
