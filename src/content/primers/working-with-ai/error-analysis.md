---
title: Error analysis, or reading your traces before you measure them
description: How to find out what an AI feature gets wrong by reading what it did, writing a note on each failure, grouping the notes and counting them, and why that comes before any score, judge, or dashboard.
order: 6
updated: 2026-10-17
---

Say you change the prompt behind an AI assistant, ask it three questions you know well, like the answers, and ship it. A week later someone complains about an answer you never tried. Asking a few favorite questions and going on feel is a common way to test these systems, and OpenAI's evaluation guide names it as an anti-pattern, "vibe-based evals" [@openai-eval-best-practices]. An **eval** is the replacement: a test that tells you whether an AI system does what you want [@husain-shankar-evals-faq].

It's tempting to start by picking metrics. Hamel Husain, who has written more about this than most, argues for the opposite order. Read what the system did first, write down what went wrong in your own words, and only then decide what to measure. He calls this **error analysis** and ranks it as the most valuable activity in building an AI product [@husain-field-guide]. This primer walks through it on one made-up assistant. [Assertions and LLM judges](/primers/working-with-ai/assertions-and-llm-judges/) picks up from there, turning what you find into automated checks.

## A few terms

- **Trace**: the full record of one request, from the user's first message to the final answer, including every model call, tool call, and document the system looked up [@husain-shankar-evals-faq]. Anthropic's agent guide calls the same thing a **transcript** [@anthropic-agent-evals].
- **Failure mode**: one kind of thing that goes wrong, like "states the wrong hours on a holiday". Not one bad answer, but a pattern you'd recognize again.
- **Open coding**: reading traces and writing a short free-text note on each problem, with no categories decided in advance [@husain-shankar-evals-faq]. The term comes from qualitative research, where "coding" means labeling, not programming.
- **Axial coding**: grouping those notes into failure modes and counting how many traces fall in each [@husain-shankar-evals-faq].
- **Theoretical saturation**: the point where reading more traces stops turning up new failure modes [@husain-shankar-evals-faq].
- **Domain expert**: the person who knows what a good answer looks like for this product. Often not an engineer.

## The running example

A small public library runs an assistant on `library.example.com`. It answers patrons' questions using the library's policy pages, with [RAG](/primers/working-with-ai/rag-from-shared-notes/) finding the relevant page for each question, and it can book study rooms through a `book_room` tool. A trace for one question looks like this:

```text
patron:     Can I renew a book that someone else has on hold?
retrieval:  found "Renewals" (updated 2024) and "Holds" (updated 2026)
model:      "Yes, you can renew any item up to three times."
```

The "Holds" page says a held item can't be renewed. The model answered from the older page and ignored the newer one. No error was thrown, the answer reads well, and a test that only checks "did it answer" passes. A person reading the trace sees the problem in seconds.

## Step 1: gather about a hundred varied traces

Start with real traffic if you have it. If you don't, write test questions, but write them on purpose. Husain and Shreya Shankar suggest listing the **dimensions** your questions vary along, then combining values [@husain-shankar-evals-faq]. For the library:

| Dimension | Example values |
|---|---|
| Feature | renewals, holds, room booking, opening hours |
| Scenario | ordinary case, holiday, conflicting policies, missing information |
| Patron | first-time visitor, regular, staff member |

One combination, "room booking, holiday, regular", becomes a question like "Can I get the big study room on the 26th like usual?". Generating the combinations first and the wording second spreads the questions across the space instead of producing a hundred versions of the easiest one. Made-up questions have one hard limit, though: they can't tell you how often a failure happens in real use [@husain-shankar-evals-faq].

Husain and Shankar treat a pool of roughly 100 varied traces as a useful working size [@husain-shankar-evals-faq]. Run each question through the system and keep the whole trace, not just the final answer.

## Step 2: open coding, one note per trace

Read each trace and write one or two sentences on the first thing that went wrong. The first one matters most, because an early mistake causes later ones: a model that retrieves the wrong page will then give a wrong answer, and you want to log the retrieval, not the answer [@husain-shankar-evals-faq]. Write in your own words and don't reach for categories yet.

| Trace | Question | Note |
|---|---|---|
| 07 | Renew a book on hold? | Used the 2024 renewals page, ignored the 2026 holds page |
| 12 | Room on the 26th? | Booked it without asking which room or how long |
| 19 | Open on Monday? | Gave regular hours; Monday is a holiday |
| 23 | Late fee for a DVD? | Correct |
| 31 | Can a visitor print? | Said "check the website", which is this website |
| 44 | Hours this Sunday? | Gave weekday hours |

The notes are specific to this library. "Ignored the newer policy page" tells you where to look, and a score of 3.4 out of 5 for "helpfulness" doesn't. Husain argues generic metrics are worse than useless, because they give a feeling of measurement without pointing at anything to fix [@husain-field-guide].

Do at least the first 30 of these yourself, by hand, before letting a model suggest notes [@husain-shankar-evals-faq]. A model can help you find more examples of a failure you've already named. It can't tell you which failures matter to your patrons.

## Step 3: axial coding, piles and counts

Once you have notes on all of them, sort the notes into piles, name each pile, and count. Say 38 of the 100 traces had a problem:

| Failure mode | Traces | Share of the 38 |
|---|---|---|
| Holiday or special hours wrong | 14 | 37% |
| Booked a room without confirming details | 9 | 24% |
| Answered from an outdated policy page | 7 | 18% |
| Sent the patron back to the website | 5 | 13% |
| Other | 3 | 8% |

The counts add up to 38 because each trace was filed once, under its first failure. The hours problem is the biggest pile, and it probably has one cause: the assistant never sees the holiday calendar.

Keep reading new traces, adding notes and adjusting the piles, until new traces stop producing new piles. That's theoretical saturation, and it's the signal to stop [@husain-shankar-evals-faq]. In an earlier post Husain gives the same rule informally: keep reading until you feel you aren't learning anything new [@husain-evals].

## Step 4: fix the obvious ones before measuring anything

Some piles are just bugs. If the assistant never receives the holiday calendar, give it the calendar, and rerun those 14 questions. Husain and Shankar advise against building an automated check for every failure you find. Fix the cheap ones in the prompt or the code first, and keep automated evaluators for problems you expect to keep working on [@husain-shankar-evals-faq]. They also argue against writing evaluators for failures you imagine rather than ones you've seen [@husain-shankar-evals-faq], which is the strongest case for doing this step before choosing metrics.

The failures that survive a fix, or that you'll be tuning for months, are the ones that get an automated check. That's [the next primer](/primers/working-with-ai/assertions-and-llm-judges/).

## Making the reading cheap

None of this happens if reading a trace is a chore. Husain's advice is to remove every bit of friction from looking at data, which usually means building a small viewer for your own traces instead of reading raw logs [@husain-evals]. For the library, that might be one page per trace with the question, the retrieved policy pages side by side with their dates, the answer, and a box for your note. He reports that teams with a good viewer iterate about ten times faster [@husain-field-guide]. He doesn't point to a study behind that figure, so read it as one practitioner's estimate.

Decide early who has the final word on what counts as a failure. Husain and Shankar recommend starting with one domain expert, a "benevolent dictator", whenever you can [@husain-shankar-evals-faq]. One consistent standard is easier to turn into checks than several people's slightly different ones. For the library, that's a librarian, not the engineer who wrote the prompt. Expect that person's standards to shift as they read: you can't fully pin down the criteria before you've seen the outputs, a problem Husain calls criteria drift [@husain-field-guide].

## RAG and agents

The library assistant is both a RAG system and a small agent, and each adds one habit to the reading.

For the RAG part, split the trace into retrieval and generation and note which half failed. "Found the right page and misread it" and "never found the page" have different fixes. Husain and Shankar suggest judging retrieval as a search problem first, did the right page come back, before judging the answer written from it [@husain-shankar-evals-faq].

For the agent part, the trace is longer and the first failure is further from the final answer. Their advice is to check the whole task first (did the room get booked correctly?) and then, for failures, find the first step that went wrong: the tool choice, the arguments, or what the agent did with the result [@husain-shankar-evals-faq]. Anthropic's guide to agent evals makes the same point from the other side: you won't know whether your automated checks work unless you read the transcripts yourself [@anthropic-agent-evals].

## Where the sources disagree

Anthropic's prompt-engineering docs give the opposite advice on volume. They list "prioritize volume over quality" as a design principle: many automatically graded questions with slightly lower signal beat a few carefully hand-graded ones [@anthropic-develop-tests]. Husain and Shankar spend their effort the other way, on a hundred traces read closely by a person, and say error analysis and evaluation take 60 to 80% of their development time [@husain-shankar-evals-faq]. Anthropic's own later guide on agent evals lands closer to Husain: start with 20 to 50 tasks taken from real failures, and read transcripts [@anthropic-agent-evals].

The two fit together if you take them as different stages. Close reading tells you what to measure. Volume matters once you're measuring something you already understand, and a large automated eval of the wrong thing is just a confident wrong answer.

Read before you measure: traces, then notes, then piles, then counts.
