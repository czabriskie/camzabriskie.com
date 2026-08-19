# 0004. Repo enumeration for the drift check runs in GitHub Actions

**Status:** Accepted
**Date:** 2026-08-19

## Context

Decision 0003 set up a weekly routine to catch drift between `src/lib/projects.ts` and
Cam's public repos, and had the fired cloud session enumerate the repos itself with the
GitHub MCP `search_repositories` tool.

The first smoke run produced no PR and no branch. That is also what a quiet week looks
like, so the run was ambiguous, and a session's transcript cannot be read from another
session. Two things came out of digging into it:

- The trigger's stored tool allowlist has no `ToolSearch`. MCP tool schemas load on
  demand through it, so a fired session most likely cannot reach `mcp__github__*` at all,
  whatever is connected. The trigger API available here can change a routine's prompt,
  schedule, model, and enabled state, but not its tool allowlist.
- Enumeration has no fallback. Repo-scoped `api.github.com/repos/<owner>/<repo>` and
  `raw.githubusercontent.com` are reachable from a session, while
  `api.github.com/users/<user>/repos` and github.com profile pages answer 403 by policy.

So the routine's one unavoidable step sat on the one capability that could silently go
missing, in a run whose silence is indistinguishable from success.

## Decision

Move enumeration out of the session and into this repo, where GitHub's own API has no
proxy in front of it.

`.github/workflows/projects-drift.yml` runs Mondays at 13:45 UTC, fifteen minutes before
the routine. It lists the public repos, subtracts every name already in
`src/lib/projects.ts`, and opens or updates one issue labeled `projects-drift` holding
the remainder as a markdown table plus a fenced JSON block. When nothing is unlisted it
closes the issue instead, so a merged PR tidies up after itself.

The routine now reads that issue over the repo-scoped issues endpoint, which is
reachable with plain `curl` and needs no MCP tool and no token. An empty result means a
quiet week: stop, no branch, no PR, no message.

## Consequences

- The routine needs no GitHub tools at all now, only `curl`, `git`, and the repo clone.
  Its remaining tool dependency is for opening the PR, which already degrades to pushing
  the branch and putting a compare link in the final message.
- Enumeration failures are now visible. A broken workflow run shows up in the Actions tab
  and emails Cam, rather than looking like a quiet week.
- The candidate list is a public issue in a public repo. It only ever names public repos,
  so nothing private is disclosed by it — the workflow filters on `private` as well as
  relying on the repo-scoped token.
- Two schedules now have to stay in step. If the routine's cron moves, the workflow's
  cron has to move with it, and a mismatch means the routine reads a week-old issue.
