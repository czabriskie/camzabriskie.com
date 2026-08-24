# Experiment 0001: AI-drafted vs. self-written LinkedIn posts

- **Status:** Not adopted (2026-08-24). Cam chose to review and edit every draft himself
  each week instead of running a formal test, which addresses the detection risk directly.
  Kept as a record of the design and the baseline numbers.
- **Date:** 2026-08-24
- **Owner:** Cam, with the weekly drafting routine doing the mechanical parts

## The question

Two questions, actually, and they need different instruments:

1. **Do AI-drafted posts perform worse (or better) than posts Cam writes himself?**
2. **Are the people following Cam because of these posts the audience he wants**
   (learners, students, early-career engineers, career switchers, job seekers, per the
   audience shift of 2026-08-22)?

One caution up front: engagement measures what LinkedIn's algorithm spreads, not what
readers think of Cam. Reputation damage from detectably-AI writing is mostly silent.
People rarely comment "this reads like AI"; they quietly discount the author and move
on. So this protocol has a third, faster instrument aimed directly at the real worry:
**can people who know Cam tell which posts he wrote?**

Note on labels: "AI" here means the weekly routine's drafts, which are sourced from
Cam's own Readwise notes and journal. Postbeam's built-in generator (which writes about
articles Cam never read) is a third thing, and it is excluded from publishing entirely
during the experiment. Detectably-generic AI content is precisely the brand risk being
tested; it does not also get to be an arm.

## Baseline: the first week of real data (as of 2026-08-24)

All five posts ever published through Postbeam went out 2026-08-18 through 08-22.
Engagement rate = (reactions + comments + reposts) / impressions.

| Published | Post (short) | Impr. | React. | Comm. | Eng. rate | URL in body? | Provenance (Cam to confirm) |
|---|---|---|---|---|---|---|---|
| 08-18 | Vault in the container / phone workflow | 626 | 15 | 0 | 2.4% | yes | routine draft, journal-sourced |
| 08-19 | MTTF/MTTR reliability | 2,437 | 30 | 2 | 1.3% | yes | Readwise-sourced (SRE book) |
| 08-20 | Percentiles over averages | 127 | 6 | 0 | 4.7% | yes | Readwise-sourced (SRE book) |
| 08-21 | Build the chat UI yourself | 213 | 6 | 0 | 2.8% | no | uncertain |
| 08-22 | Scope creep with AI | 126 | 0 | 0 | 0.0% | yes | uncertain |

The provenance column is a guess from context. **First task of the experiment: Cam
corrects this table from memory** (which drafts came from the Claude routine, which from
Postbeam's generator, which he touched heavily). Without that, the historical five are
uninterpretable and stay out of the analysis.

What the baseline already shows:

- 17 followers gained in 90 days; 16 of them during the Aug 19–21 posting window.
  Posting is what drives follows, so follower quality is measurable per posting week.
- Comments are near zero (2 total, all on the MTTR post). Comments are the main signal
  LinkedIn uses to widen distribution, so any comment at all moves a post's fate.
- Impressions swing 126 → 2,437 across five posts on similar topics. Per-post variance
  is enormous, which is why this design uses paired weeks and rates, not raw counts.
- Four of five posts had a URL in the body. The no-URL rule (links go in the first
  comment) only landed 2026-08-22, so **pre-experiment posts are not comparable to
  experiment posts** and are baseline color only.

## Track 1: the blind panel (fast, answers "can people tell")

Runs once, takes about a week, needs no publishing.

1. Assemble six unpublished texts: three AI drafts from the routine (unedited) and
   three short pieces Cam writes himself from his own notes (same topics-from-his-life
   sourcing, same length range). Unpublished is the point; published posts are
   guessable from memory.
2. Send all six, shuffled, to 3–5 people who know Cam's writing (former coworkers,
   friends in the field). Ask one question: "Which of these did Cam write himself?
   Label each, and for any you call AI, say what gave it away."
3. Score it. 5 judges × 6 texts = 30 guesses; chance is 50%. Above ~70% accuracy means
   the drafts are detectable and the "what gave it away" answers are a concrete edit
   list for the routine's voice rules. Near 50% means the voice layer is working and
   the reputational-detection worry is small, whatever the engagement numbers say.

Track 1 answers the reputation question directly and quickly. Track 2 is only worth
running to completion if Track 1 doesn't already settle the matter in one direction.

## Track 2: paired A/B on LinkedIn (slow, answers "what performs")

### Arms

- **HUMAN:** Cam writes the post himself from a "source packet" (his highlight + note,
  or his journal thread, plus a suggested angle — but **no draft text**, so there is no
  anchoring). Typo-level cleanup by tooling is fine.
- **AI:** the weekly routine's draft, published as-is or with factual corrections only.
- If Cam substantially rewrites an AI draft, that post becomes **MIXED**: still worth
  publishing, logged honestly, excluded from the pairwise comparison.

### Pairing and controls

Each experiment week publishes exactly one pair:

- Same stream (Tech Bytes; LinkedIn is the professional surface).
- Same topic class within a pair: Readwise-idea posts pair with Readwise-idea posts,
  journal/build-story posts with journal/build-story posts.
- Fixed slots: Tuesday and Thursday, 13:00 UTC (the slots already in use).
- Which arm gets Tuesday is a logged coin flip each week.
- Both posts follow the same packaging rules (no URL in body, link in first comment,
  no hashtags, closing line a reader can actually answer). The packaging rules are
  held constant, not tested.
- Nothing from Postbeam's generator publishes during the window, and off-schedule
  extra posts are avoided so pairs don't cannibalize each other's early window.

### Metrics (pre-registered, measured at 7 days via Postbeam analytics)

- **Primary:** engagement rate = (reactions + comments + reposts) / impressions.
  Pair winner = higher engagement rate; ties broken by comment count.
- **Secondary:** comment count; followers gained in the 48h after each post (from the
  daily series); impressions (reported, but never the decider — impressions mostly
  measure the algorithm's early-test roll of the dice).
- **Qualitative:** any DM, in-person mention, or "saw your post" — logged per post.
  For a 400-connection account these are arguably the realest signal there is.

### Analysis and honest expectations

Ten pairs, then a sign test: 9–10 HUMAN wins (or 9–10 AI wins) out of 10 is a real
result (p < .05); 8 is suggestive; anything closer is noise. At one pair a week that is
**about ten weeks**, and it costs Cam one self-written post a week. There is no faster
honest version of Track 2; small-sample engagement reads on LinkedIn are astrology.
That is exactly why Track 1 exists and runs first.

Stop early only if Track 1 comes back decisive **and** the first four pairs all lean
the same way; at that point the question is answered well enough to act.

### Logging and blinding

Both repos are public, so **arm assignments never live in this repo or in
obsidian-cloud-sync**. A reader finding a labeled list of which posts are AI would both
contaminate the test and be the exact reputation problem this experiment is about.

- Postbeam draft titles (never published) carry the arm: `[H]` / `[AI]` / `[M]` suffix.
- The Signal Log artifact (default-private) gets one experiment table: pair number,
  arm, Postbeam id, slot, coin-flip result, 7-day numbers, follower counts, notes.
- Public posts carry no disclosure either way during the window; Cam can (and probably
  should) write the whole experiment up afterward, which is a good post in itself.

## The follower-quality audit (question 2)

Postbeam only reports follower *counts* (daily `followers_gained`); identities are only
visible in LinkedIn itself, so this part is manual and deliberately tiny:

- Weekly, ~5 minutes: open LinkedIn → profile → followers (sorted by most recent),
  review the new ones (the daily series says how many to expect), and tally them into
  five buckets: **target** (student / learner / early-career / switcher / job seeker),
  **peer engineer**, **recruiter or sourcer**, **sales / spam / bot-ish**, **other**.
- Log the tally per week in the Signal Log table, attributed to that week's posts
  (follows cluster within ~48h of a post, per the baseline data).
- Read: if AI-arm weeks pull a higher spam/low-fit share, that is a strike against the
  AI arm that engagement rate would never show. If target-bucket followers cluster on
  particular posts, those posts' topics and framings are what the audience shift says
  to write more of, whoever drafted them.

## Routine changes this requires (proposed, not yet applied)

1. **Weekly Draft Pull:** during the window, produce one AI draft and one source packet
   per week (packet = the highlight/note or journal thread + suggested angle, no draft
   text); tag Postbeam titles with the arm; add the pair row to the Signal Log table;
   never let Postbeam-generator drafts into the publish queue.
2. **New weekly scorecard check** (or a step bolted onto an existing Monday routine):
   pull `get_post_analytics` and the daily follower series, fill in 7-day numbers for
   any pair that has matured, and send one push notification with the pair's numbers
   plus the follower-audit nudge ("N new followers since last week, 5-minute tally").
3. **First Comment Nudge:** unchanged; it already serves both arms equally.

Exact prompt edits ship when Cam adopts the experiment; a Decision record gets written
at the same time (this file is the protocol, not the decision).
