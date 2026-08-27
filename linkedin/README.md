# LinkedIn self-scheduler

Free replacement for Postbeam (Decision 0005). Posts to Cam's personal LinkedIn
profile via LinkedIn's own consumer Share API (`w_member_social`, the self-serve
"Share on LinkedIn" product — no cost, 150 posts/member/day, which is not a real
limit here). LinkedIn's API has no native scheduling, so this directory plus the
`LinkedIn publish` workflow IS the scheduler.

## How a post flows

1. A draft lands as a markdown file in `queue/` **via a pull request** (the weekly
   drafting routine opens these). The PR is the review gate: **merging the PR is
   the approve-and-schedule step.** The never-merge rule for writing under Cam's
   name applies to these PRs exactly as it does to blog posts.
2. Edit `publish_at` in the PR (or on main) to move the slot. A `publish_at` in
   the past publishes on the next 15-minute tick — that's the "post now" button.
3. `.github/workflows/linkedin-publish.yml` ticks every 15 minutes, publishes any
   due post, then tries to add `first_comment` as the post's first comment (links
   live there because links in the body suppress reach). If the comment API call
   fails, the daily nudge routine tells Cam to paste it from his phone.
4. The file moves to `posted/` with `posted_at`, `post_urn`, and
   `first_comment_status` stamped into its frontmatter, committed straight back
   to main. Status values: `posted` (comment went on automatically), `failed`
   (comment API said no), `none` (post had no `first_comment`), or `pending`
   (the run died between publish and comment — treated like `failed` by the
   nudge). `posted/` is the publish history the routines read; don't edit it.

## Queue file format

Filename: `YYYY-MM-DD-short-slug.md` (the intended publish date). Frontmatter
values are single-line (`first_comment` especially — it's one paste-able line):

```markdown
---
title: Tech Bytes: shelf label for humans, not part of the post
publish_at: 2026-09-01T13:00:00Z
first_comment: Wrote more about this on my site: https://camzabriskie.com/tech-bytes/some-post/
sources:
  - my note on X, from <book or article>
---
The post body, exactly as it should appear on LinkedIn. Plain text, paragraphs
separated by blank lines. No URLs, no hashtags.
```

`title` and `sources` are for the PR reviewer (provenance receipt); only
`publish_at`, `first_comment`, `visibility` (optional, `PUBLIC` default or
`CONNECTIONS`) and the body reach LinkedIn. Text-only for now: image posts need
the upload/assets API and can be added when actually wanted.

## One-time setup (and every ~60 days)

1. Once: create an app at <https://www.linkedin.com/developers/apps>, add the
   free products **Share on LinkedIn** and **Sign In with LinkedIn using OpenID
   Connect**, and add `http://localhost:8914/callback` as an authorized redirect
   URL.
2. Locally: `LINKEDIN_CLIENT_ID=... LINKEDIN_CLIENT_SECRET=... node
   scripts/linkedin-auth.mjs`, approve in the browser, then run the printed
   `gh secret set` commands (`LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN`,
   `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`).
3. Tokens last ~60 days and the consumer tier has no programmatic refresh. The
   Monday `token-health` job fails (= emails) when under 14 days remain; the fix
   is re-running step 2 and updating `LINKEDIN_ACCESS_TOKEN`.

Set the secrets before merging the first queue file — a due post with no
credentials fails the tick until one or the other changes.

## The two Routines

The weekly draft pull and the daily first-comment nudge are claude.ai Routines,
and their prompts live (versioned) in `routines/`. Agents can't edit Routines a
person created, so after changing a prompt file here, paste its contents into
the matching Routine in the claude.ai Routines UI — and keep the two in sync.

## What Postbeam had that this doesn't

- **Analytics.** Post/account analytics need LinkedIn's partner-gated Marketing
  APIs. The distribution rules learned from the Postbeam era are written into the
  weekly routine's prompt; there is no live number to check anymore.
- **A drafting UI.** The PR diff is the UI.
- **Media posts.** Deliberately deferred, see above.
