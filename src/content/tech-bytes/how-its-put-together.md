---
title: How Rhythm Gardens is put together
description: A plain look at the Kotlin and Gradle setup behind an Android rhythm game, from the module split to getting a build onto a real phone.
date: 2026-09-07T14:00:00Z
---

I've been building a small Android game called Rhythm Gardens, a one-thumb rhythm game where every level is a public domain song and a bee hops flower to flower on the beat and you tap in time with the landings. I want to write about how it's actually put together, since the build has a few decisions in it that aren't obvious unless you've built an Android app before, and I think they're more interesting than the game itself.

## Two modules

A Gradle module is just a separate chunk of a project that builds on its own and gets pulled in by name, and this project has exactly two of them.

```
:core   plain Kotlin JVM library, every game rule, zero Android imports
:app    Android/Compose, rendering + audio + input + persistence only
```

`:core` holds every rule the game has. `ChartParser.kt` turns a notation string like `"E5 D5:2 C5:.5"` into actual notes and beats, `HopTimeline.kt` works out exactly where the bee is at any given millisecond, `TapJudge.kt` grades a tap the moment it comes in, `ScoreState.kt` keeps score, and `Progression.kt` is the save file logic. `:app` is supposed to be thin on purpose: Compose Canvas drawing, audio, reading input, writing the save, and nothing that actually decides anything about the game. If a rule changes, it changes in `:core`, and `:app` just draws whatever `:core` says happened.

## kotlin.\* only, and a test that checks it

`:core` is restricted to `kotlin.*` and nothing else, no `java.*`, no `android.*`, no reading the system clock directly, no threads. Time gets passed in as a parameter instead of read off the device, randomness is seeded so it's repeatable, and a save is just a plain string that the platform side hands to Android's `SharedPreferences` to actually write. A test called `PortabilityTest` scans the `:core` source and fails the build if any of that sneaks in, so the rule isn't a habit, it's enforced.

`./gradlew :core:test` then runs the whole rules suite, 157 tests as of the last run, on any machine with a JDK, no Android SDK, no emulator, no phone plugged in, and it finishes in seconds. The forward-looking reason for the restriction is that `:core` could move into a Kotlin Multiplatform `commonMain` without changing a line, which keeps an iOS port cheap without actually committing to building one.

## Only including :app when there's an SDK to build it with

`:app` only gets included in the build at all when an Android SDK is actually discoverable, which it checks for by looking for a `sdk.dir` line in `local.properties`, or the `ANDROID_HOME` or `ANDROID_SDK_ROOT` environment variables. That's not defensiveness, it's specific: the Android Gradle Plugin, the tool that knows how to turn Kotlin and resources into an Android module, fails during Gradle's configuration step, before any real compiling has even started, if there's no SDK anywhere on the machine, and that failure takes the entire build down with it, `:core:test` included, over a module nobody was even trying to touch. So the fix is to check for an SDK first and only call `include(":app")` if one turns up, which means a machine with no Android SDK at all still gets to run every rule the game has.

## Three numbers that sound like the same thing and aren't

`minSdk`, `targetSdk`, and `compileSdk` trip people up because they all sound like "which Android version," and they're actually three independent knobs. `minSdk` is the oldest version of Android the app will even install on, 26 here. `targetSdk` is the behavior the app is opting into, and it's also the specific number the Play Store's required-level check reads when it decides whether an app meets the current bar, 36 here. `compileSdk` is just what the code compiles against, and it's free to sit ahead of the other two, 37 here, one ahead of `targetSdk`, because a Compose library this project depends on has packaging metadata that demands compiling against API 37 even though the app still targets 36 for the store. It's easy to assume `compileSdk` and `targetSdk` have to match. They don't, and this project is a case where they're deliberately one apart.

## Signing, and why it matters before you've published anything

The debug build's signing setup points at an explicit keystore file when an environment variable is set, instead of letting the Android Gradle Plugin fall back to its own default keystore. That sounds small, but it matters every single day of development: it means every debug build, whether it comes out of CI or off a local machine, gets signed with the same key, and Android treats an app's signing key as its identity, so `adb install -r` can update an already-installed app in place and the save file already on the phone survives the update. A build signed with a different key needs an uninstall first, which also wipes the save. The comment next to this setting explains why it exists at all: relying on the default keystore location didn't work on the CI runner, which resolved a different preferences directory than expected and would have minted a fresh throwaway key on every single run.

## Getting a build onto a phone

Getting an actual build onto a phone starts on the phone itself. Settings, then About phone, then tap the build number seven times until it tells you that you're now a developer, which unlocks a new Developer options menu. In there, turn on USB debugging. Plug the phone into the computer, accept the prompt asking whether to trust it, and then either press Run in Android Studio or run `./gradlew :app:installDebug` from a terminal. If Android Studio isn't around at all, CI builds a debug APK on every push and uploads it as a workflow artifact, so it's just as easy to download that from GitHub Actions and sideload the APK file directly, allowing installs from an unknown source when it asks.

A debug build also gets you something a release build doesn't. `adb shell run-as com.rhythmgardens.app cat files/taps.log` reads a file straight out of the app's own private storage on the device, no root required, which is how this game's on-device play log actually gets pulled off a phone for a look.

## The design space and the clock

The whole game is drawn on a single Compose `Canvas` inside a fixed 390 by 640 design space, and that fixed space gets letterboxed onto whatever the real screen actually is, wider or taller, with bars filling whatever's left over. Every coordinate the game logic ever touches is just a number inside that one fixed space, so none of it has to know or care what phone it happens to be running on.

The timing model took the most care to get right. The run clock is just milliseconds accumulated frame by frame, and every sound cue fires the moment that same clock crosses an integer beat, so the audio and the grading logic are reading off the exact same clock and can't drift apart from each other over the course of a song. What can still drift is the phone's own audio hardware, which takes some number of milliseconds to turn a scheduled sound into an actual audible one, and that number is different from device to device. The grading windows are plus or minus 70 milliseconds for a Perfect and plus or minus 160 for a Good, and a fixed 70 millisecond offset gets subtracted from every tap before it's checked against those windows, to cancel out that hardware latency. That 70 comes from logging real play data and measuring the actual error, not from a guess, and a way to calibrate it per device is still on the list rather than done.

None of this is exotic, and none of it is specific to games either, it's mostly ordinary Gradle and Android decisions applied carefully rather than skipped. The module split and the fact that one command runs every rule the game has with no device plugged in anywhere are the two choices that ended up making everything after them easier, and they got decided in the first hour of the project instead of after something had already gone wrong because of their absence, which is usually how it works out when it works out at all.
