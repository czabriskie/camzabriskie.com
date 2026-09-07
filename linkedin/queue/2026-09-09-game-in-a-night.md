---
title: "Tech Bytes: the overnight build worked because of the test suite, not the model"
publish_at: 2026-09-09T13:00:00Z
first_comment: "Wrote the longer version here: https://camzabriskie.com/tech-bytes/game-in-a-night/"
sources:
  - my own notes on the :core and :app module split, from the czabriskie/bee-game repo
---

I built a rhythm game for my kid overnight, with Claude doing most of the typing, and the easy read on that is that AI writes code fast. I don't think that's what happened. The reason it worked is that the project was shaped so the agent could check its own work at two in the morning with nobody watching and no phone plugged in anywhere.

The game rules live in their own chunk of code that has no Android in it at all, just plain Kotlin. The notes, the timing, the judge that decides whether your tap landed on the beat, the scoring, all of it sits there, and the Android side is a thin shell that draws flowers and hands taps over to be graded. It doesn't decide anything. That split means the whole rules suite runs in seconds on any machine with a Java install, no emulator, no device, which is the only reason an agent could run change, test, check, repeat all night and actually know whether it was right.

A rule like "the core doesn't touch Android" stops being true in about a week if nothing enforces it, especially when an agent is writing the code and just trying to make the feature work. So the rule is a test. There's one that scans every file in that module and fails the build if anything platform-specific sneaks in, and nobody has to remember it. Same instinct behind keeping "code written," "compiles," "tests passing," and "verified on a real phone" as four separate rows in the status doc instead of one checkmark, because an agent will tell you it's done either way and those are four different claims.

None of this is new advice, splitting logic out and testing it is what people have been saying for decades. What's different is that the payoff used to be eventual and now it's immediate, because the agent is the one running the loop, and it can only run it honestly if there's something fast and pure for it to run against. Which makes me wonder how much of what I've built over the years was slow because of the code, and how much was slow because of the checking.
