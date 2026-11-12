# 0014. WoW Forever dashboard is fed by a daily data commit to main

**Status:** Accepted
**Date:** 2026-11-11

## Context

Cam is running small gold-making tests in WoW Forever and wanted a public page showing
the tests, what they made, and current prices. The numbers come from the
TradeSkillMaster and Auctionator addons' saved files, which only exist on his Windows PC.
A separate local repo (`wow-forever-ah`, not on GitHub) scrapes those files every morning
into a ledger of buys, sales, gold snapshots and price scans.

The ledger holds character names and other players' names, so it can't live in this
public repo. The page also changes every day, which doesn't fit the branch-and-PR flow
used for everything else here: a daily PR nobody needs to read is noise.

## Decision

- The page is `/projects/wow-forever/` (`src/pages/projects/wow-forever.astro`), rendered
  entirely at build time from `src/data/wow-forever.json`. No client-side script; hover
  values use SVG `<title>`, and every chart has the same numbers in a table.
- The local scraper builds that JSON with no character, account or player names in it
  (item totals, gold totals, the test log, price scans) and its daily job commits only
  that one file straight to `main` with the message `WoW Forever data YYYY-MM-DD`. The
  push redeploys the site like any other push.
- That direct commit is the only exception to branch-PR-merge, the same way the LinkedIn
  workflow commits queue moves itself (Decision 0005). Changes to the page, styles, or
  anything else still go through a PR.
- Charts reuse the existing tokens: sales in `--tech`, purchases in `--muted`, won/lost
  tests marked like the cert-chain checks (✓ in `--tech`, ✗ in `--life`). No new hue.
- The Projects page lists it under "Things I built". `Project` gained an optional `href`
  so an entry without a public repo can link to a page on this site instead.

## Consequences

- One small commit to `main` per day while the tests run, each triggering a deploy and a
  CI build. If that gets noisy, the job can skip days when nothing changed (it already
  does when the JSON is identical) or move to a weekly schedule.
- If the JSON shape changes in the scraper, the page has to change with it in the same
  day, or the build fails on the next data commit. The build is the gate, as everywhere
  else here.
- The local job pushes with Cam's GitHub credentials on his PC. Nothing in this repo's
  Actions needs a new secret.
