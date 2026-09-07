---
title: "Tech Bytes: the Gradle trick that keeps the tests runnable without an Android SDK"
publish_at: 2026-09-18T13:00:00Z
first_comment: "Wrote the longer version here: https://camzabriskie.com/tech-bytes/how-its-put-together/"
sources:
  - my own notes on the module split, from the czabriskie/bee-game repo
---

The Android game I've been building is split into two Gradle modules, which is just Android's way of saying two separate chunks of code that build on their own. One holds every rule the game has, the chart parsing, where the bee is at any given millisecond, how a tap gets graded, the scoring, the save. It's plain Kotlin with no Android in it anywhere. The other is the Android side, the Compose drawing and the audio and the input, and it doesn't decide anything, it just shows what the first one already decided.

Restricting that first module to kotlin.* only is enforced by a test rather than a habit, since a convention nobody checks stops being true in about a week. No java.*, no android.*, no reading the system clock, no threads. Time gets passed in, randomness is seeded so a run repeats, and a save is a plain string the Android side hands to SharedPreferences. A test scans the source and fails the build if any of that sneaks in.

That buys one command that runs all 157 rule tests on any machine with a Java install, no Android SDK, no emulator, no phone. Which led to a trick I hadn't needed before: the Android module is only included in the build when an SDK is actually discoverable on the machine. The Android Gradle Plugin fails during Gradle's configuration step if there's no SDK anywhere, before any compiling starts, and that failure takes the whole build down with it, including the tests for a module you weren't even trying to build. Checking for an SDK first and only including the Android module if one turns up means a machine without one still runs every rule the game has.

None of that is exotic, it's ordinary Gradle applied carefully. But the two decisions that made everything afterward easier were both made in the first hour, before there was anything to regret, which is usually the only time that kind of decision is cheap.
