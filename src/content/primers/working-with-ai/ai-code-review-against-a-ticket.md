---
title: Reviewing code with an AI, against a ticket
description: How to set up an AI code review so it checks the change against the ticket's requirements first and code health second, and why it should run the code instead of only reading it.
order: 0
updated: 2026-10-08
---

A code review answers two different questions. Does this change do what was asked? And is it written so the next person can live with it? An AI reviewer that reads only the diff can answer a rough version of the second question and has nothing to measure the first against. One way to fix that is to give the reviewer three things: the requirement it's checking against, the running code, and a narrow job.

## Two questions, two passes

Take a ticket that says "reject uploads over 10 MB with a 413". The diff adds a size check. Reading it, the size check looks right. Whether it returns 413 and not 400, whether exactly 10 MB passes, and whether the limit applies to the second upload endpoint nobody mentioned are all questions the diff alone does not answer.

Several review tools already pull in the ticket for this reason. One validates a pull request against the linked issue's requirements [@coderabbit-pr-validation], and another surfaces fetched ticket fields, including acceptance criteria where the tracker has them, next to the code changes [@qodo-ticketing]. Google's guidance asks the first reviewer question in plain words: does the change do what the developer intended, and is what they intended good for the people who use the code [@google-review-looking-for]?

So the review splits in two:

| Pass | Question | Output |
|---|---|---|
| Requirement traceability | Does the change do what the ticket asks, and nothing extra? | One verdict per requirement, with evidence |
| Code health | Is it correct, secure, simple, tested, and consistent with the repo? | Findings with a label, a severity, and a file and line |

Running them as two separate reviewers with different instructions keeps each focused. The traceability reviewer never comments on naming. The code-health reviewer never decides whether the ticket was satisfied.

## Pass one: requirement traceability

Start by turning the ticket into a numbered list, one line per acceptance criterion. Then each line gets a verdict and the evidence behind it.

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Uploads over 10 MB return 413 | Met | `upload.py:42`, observed `413` on an 11 MB file |
| 2 | Exactly 10 MB is accepted | Not met | Check uses `>=`, observed `413` at 10 MB |
| 3 | Error message is helpful | Flagged as untestable | "Helpful" has no pass condition |

Four verdicts cover the cases: Met, Partially met, Not met, and Unverifiable (it can't be checked here, for example because it needs production access). A criterion with no pass condition ("as needed", "improve", "helpful") doesn't get a verdict at all. It gets flagged as untestable and goes back to whoever wrote the requirement as a question. A reviewer of any kind has nothing to check a vague requirement against, so it's easy to wave through, and catching these by a simple rule works better than leaving it to judgment.

Two extra outputs make this pass useful. Changes in the diff that map to no requirement are scope creep. Requirements with no test covering them are missing tests.

## Run the code

Reading code finds a lot, but some requirements are about behavior, and behavior is cheap to check. Google's guidance says a reviewer can validate the change and that it matters most when the effect on users is hard to see from the code alone [@google-review-looking-for]. An AI reviewer with a shell can do that on every change.

The practical shape:

1. Check the change out in an isolated worktree or temporary clone, so the author's working tree is untouched.
2. Install dependencies with the repo's own tooling, then run the existing tests and linters.
3. Call each changed public function, command, or endpoint with a normal input, an edge case the requirements imply, and an invalid input.
4. For a modification, run the same calls on the base branch and compare.
5. Keep every command and its trimmed output as an execution log in the review.

A verdict of Met for a behavioral requirement needs an observed result or an existing passing test as evidence. Anything that cannot run safely, because it needs production credentials or infrastructure that does not exist locally, is marked Unverifiable and never assumed to work. Use local, mock, or development resources only.

Tests and linters run first, and the reviewers receive their results. A model asked to review what a linter already flagged only adds noise.

## Pass two: code health

Google's list gives the order to look in: design, functionality, complexity, tests, naming, comments, style, documentation [@google-review-looking-for]. It also says when to stop: reviewers should favor approving a change once it definitely improves the overall health of the code, even if it is not perfect [@google-review-standard]. An AI reviewer has no tiredness to make it stop, so the instruction has to say so.

Google flags over-engineering, meaning code made more generic than the problem needs, as something reviewers should watch for especially [@google-review-looking-for]. A reviewer that's asked to find improvements can easily suggest more abstraction than the change needs, so it helps to say plainly that simpler is the goal.

Each finding carries enough structure to triage at a glance:

- A label: issue, suggestion, question, nitpick, or praise.
- Blocking or non-blocking.
- Severity and a confidence score, with low-confidence findings dropped or rewritten as questions.
- A file and line, why it matters, and a suggested fix.

The labels follow the idea behind Conventional Comments, which exists because a bare "this loop could be simpler" does not tell the author whether it is a requirement or an idea [@conventional-comments]. A cap on nitpicks keeps the one real bug from sitting under a dozen style remarks.

The pass also lists what it checked and found fine. A review that only lists complaints hides its own coverage, and a reader cannot tell "looked and fine" from "never looked".

## After the two passes

The two passes then get merged into one report: duplicates removed, any finding whose cited file and line don't exist dropped, and every requirement checked for a verdict. A finding with no evidence behind it gets deleted.

The result works best as advice. The reviewer reports and a person decides, and the review itself never approves the change or edits the code.

## When there's no ticket

All of this assumes the change has a written requirement somewhere: a ticket, an issue, or even a few lines in the pull request description. Without one, pass one has nothing to trace against, and the review quietly turns into a code-health pass that says nothing about whether the change does what was meant. Writing the requirement down first, even briefly, is usually the cheapest fix.

## Limits

Tickets can be wrong or thin, and a perfectly traced review of a bad ticket still ships the wrong thing. The process finds mismatches between ticket and code and says nothing about whether the ticket was a good idea. Running code locally also costs time and needs a working development setup, which makes the review slower than a read-through. The trade is worth it for changes where behavior matters and harder to justify for a one-line docs fix.
