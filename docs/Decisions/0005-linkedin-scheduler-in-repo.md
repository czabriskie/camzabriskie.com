# 0005 — LinkedIn scheduling moves from Postbeam into this repo

**Status:** Accepted
**Date:** 2026-08-27

## Context

Weekly LinkedIn drafts (the Signal Log routine) and the daily first-comment
nudge ran through Postbeam, a paid tool reached over MCP: drafts were pushed
there for Cam's review, he approved and scheduled in its UI, and it published to
LinkedIn and held the analytics. Cam wanted a free replacement that keeps the
two things that matter: pushing posts programmatically and scheduling them.

LinkedIn's own consumer API covers the publish half at no cost — the self-serve
"Share on LinkedIn" product grants `w_member_social`, which posts to Cam's own
profile via `POST /v2/ugcPosts` (150/member/day). It has no scheduling, no
analytics for members (partner-gated Marketing APIs only), and its ~60-day
tokens have no programmatic refresh at this tier. Self-hosted schedulers
(Postiz, Mixpost) would cover scheduling but need a server, which isn't free and
is more moving parts than one profile's worth of posts justifies.

## Decision

Scheduling lives in this repo. `linkedin/queue/` holds approved posts as
markdown files with `publish_at` frontmatter; `linkedin-publish.yml` ticks every
15 minutes on GitHub Actions (free on this public repo), publishes due posts via
`scripts/linkedin-publish.mjs` (dependency-free Node), tries to post the
`first_comment` (where links go, since body links suppress reach) via the
socialActions API, and commits the file's move to `linkedin/posted/` as the
publish record.

The PR is the approval UI: the weekly routine opens drafts as a PR against
`queue/`, and Cam merging it is the approve-and-schedule step. The never-merge
rule for writing under Cam's name extends to these PRs. Postbeam's style
training is snapshotted in `linkedin/VOICE.md`; the two Routines' prompts are
repointed at the repo (queue/posted state) instead of Postbeam's MCP tools.

Token renewal stays manual (`scripts/linkedin-auth.mjs` locally, ~every 60
days), with a Monday `token-health` job that fails loudly when under 14 days
remain.

## Consequences

- Zero recurring cost; the whole pipeline is inspectable in one repo, and the
  publish history is a git log.
- Publish times quantize to the 15-minute tick, and a merged queue file with a
  past `publish_at` posts on the next tick — that is the "post now" button.
- Analytics are gone. The distribution heuristics learned while Postbeam's
  numbers were available are frozen into the weekly routine's prompt.
- A ~bimonthly manual errand (token renewal) now exists, alerted by email via
  the failing weekly job.
- Text-only posts for now; images/documents would need LinkedIn's asset upload
  flow and a Decision when wanted.
- Postbeam stays only until its last scheduled post goes out, then the
  subscription can be cancelled and its MCP connector removed.
