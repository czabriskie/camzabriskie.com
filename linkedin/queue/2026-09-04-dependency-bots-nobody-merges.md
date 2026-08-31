---
title: "Tech Bytes: the PR nobody was ever going to click merge on"
publish_at: 2026-09-04T13:00:00Z
sources:
  - my note on automated dependency PRs, from "Build Your Own Continuous Modernization Pipeline With AWS Transform Custom"
---
A dependency bot, Renovate, Dependabot, whatever your team's running, opens the update PR, the tests pass, and it just sits there. I've seen this happen on basically every team I've worked with that has one of these turned on. Nobody's against merging it exactly, it's just that reviewing a routine version bump never wins against whatever's actually on fire that day, so it ages in the queue until it's stale enough that merging it feels riskier than leaving it alone.

Reading about AWS's continuous modernization pipeline got me thinking about this differently. Instead of a bot opening a PR and hoping a human eventually clicks the button, what if the pipeline just merged it itself when the tests are green, and only stopped to ask a person when something actually failed. The bar for human attention flips from "review every routine bump" to "only look at the ones that broke something," which is a much smaller and much more honest ask of anyone's time.

I don't think this works for every dependency, a major version bump on something core probably still wants a human looking at the diff. But for the boring, patch-level stuff that's most of what actually piles up, I'd rather trust a green test suite than trust that someone finds the spare twenty minutes to click merge on something that isn't urgent.

Curious how many teams have actually tried auto-merging the safe tier of these instead of just generating more PRs nobody opens.
