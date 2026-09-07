---
title: The last mile is the store
description: Writing the phone game was the fast part, and everything between a working build and a kid holding it turned out to be forms, an ID check, and a couple of permanent decisions.
date: 2026-09-07T11:00:00Z
---

I've been writing about the rhythm game I built and what it took to get the AI to build it well, but none of that is what's eating my week right now. The code was done a while ago. What's left is everything between "the game works on my machine" and "a kid can hold a phone and play it," and none of that has gotten one bit faster.

The easy version of this, if you only need it on one phone, is genuinely easy. Every time I push code, CI builds a debug APK, which is just the installable package format Android uses, and uploads it as a build artifact I can download from the Actions tab. That's sideloading: skipping the Play Store entirely and putting the file on the phone yourself, which means allowing "install from unknown sources" and shrugging off a Play Protect warning, because it's a debug build signed with a throwaway development key rather than anything the store vouches for, and the phone is right to be suspicious of it. The artifact expires after about 90 days, so if I wait too long I just re-run CI. What makes this livable day to day is that CI signs every debug build with the same key, so a new build installs right over the old one and the save file survives. If I ever built one from a different machine, with a different key, I'd have to uninstall first and lose the save. Small thing, but it's the difference between "update" and "start over," and I didn't think about it until I read it in the handoff notes.

## Then you try to actually publish it

The store is a different kind of problem, because none of it is code. The one-time developer registration is $25, plus a personal identity verification with a government ID, and Google doesn't publish a turnaround time for that anywhere I could find, which is exactly why you're supposed to start it on day one and just treat the wait as unknown.

What actually determines the calendar is the testing rule. A personal developer account created after November 13, 2023 can't reach production without running a closed test first, with a minimum of 12 testers opted in continuously for 14 days. Not 14 days total, 14 consecutive days per tester, so if your twelve people opt in on twelve different days, the clock doesn't really start until the last one does. Recruiting twelve real people with real Google accounts to install a rhythm game for two weeks is a social task, not a technical one, and it's the actual long pole in this whole thing. The useful loophole is that internal testing has none of this, no tester minimum, no day count, so my own family's phones can have the real Play build immediately, through the actual store, while the closed test clock runs separately in the background.

On top of that, Google requires apps to target a recent Android API level, and the requirement just moved again this August. The game tracks the current required level rather than pinning to one, which is the right call, but it also means I should expect the same kind of bump every year from here on, forever, as just part of owning an app on this store.

And then there's the Data safety form, which asks what the app collects. The honest answer is nothing, no network permission at all, so the whole form is "no" all the way down. Which sounds like it should be trivial, except the form still can't be submitted without a privacy policy at a URL that actually resolves, so before any of this can go anywhere, a static page has to exist somewhere first, even for an app that collects literally nothing.

## The two things you can't take back

Most of the above is annoying but recoverable, wait longer, recruit more people, fix the form. Two things aren't.

The first is the signing key you use to publish updates. It lives in two places, in CI secrets and in one directory on my laptop that git doesn't back up, and if I lose both copies, that's it, that specific app can never be updated on the store again. Google has a recovery process, but it's slow and not guaranteed, so the actual mitigation is just "don't lose the file," which is a strange thing to be the load-bearing plan for a piece of software.

The second is the applicationId, which is the string that tells Android what app this is, forever, the moment it's published. I renamed the project before it went out and moved the package off its placeholder name to the real one, and because Android treats a changed applicationId as an entirely different app, installing the new one didn't update anything, it just started fresh: new private storage, no old save, no play history carried over, and both the old and new icons sitting on the home screen at once until I uninstalled the old one by hand. That's fine before launch. Doing that after launch would mean every existing player loses their save the day you push the update, which isn't really an option at all, it's just a mistake you get to make exactly once.

So that's the shape of it. An AI made the code dramatically faster and did nothing at all for the rest, it's forms, an ID check, a two-week wait with actual people in it, and a couple of decisions that are permanent the first time you get them wrong. If it's just for one kid on one phone, you can skip almost all of it, sideload a debug build and call it done, and that's a real answer, not a consolation prize. It's only once you want it on someone else's phone that the last mile turns out to be most of the mile.
