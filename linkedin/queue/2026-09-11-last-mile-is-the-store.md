---
title: "Tech Bytes: the code was the fast part, the store is the slow part"
publish_at: 2026-09-11T13:00:00Z
first_comment: "Wrote the longer version here: https://camzabriskie.com/tech-bytes/last-mile-is-the-store/"
sources:
  - my own notes on the Play submission kit, from the czabriskie/bee-game repo
---

The game I built for my kid has been done for a while. What's eating my week is everything between "it works" and "someone else can install it," and none of that got faster when AI started writing the code.

If you only need it on one phone, it really is easy. My CI builds an installable package on every push, I download it, copy it to the phone, allow installs from outside the store, and shrug off the warning the phone gives me for doing that. Publishing it properly is a different kind of problem, because almost none of it is code. There's a one-time $25 developer registration and a personal identity check against a government ID with no published turnaround time. And a personal account created after November 2023 can't reach production until it has run a closed test with at least twelve testers opted in continuously for fourteen days, where the clock starts per tester when they opt in, so twelve people signing up on twelve different days means you're counting from the last one. Recruiting twelve real people to install a rhythm game for two weeks is a social problem, not an engineering one.

This is the shape of most software, not just phone games. Writing the code got dramatically cheaper, and that was already the fun part, while the distribution, the compliance, and the two-week wait with actual humans in it all cost exactly what they did before.
