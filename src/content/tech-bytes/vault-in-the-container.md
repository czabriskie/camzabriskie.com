---
title: "Getting my Obsidian vault into Claude's cloud containers"
description: "Obsidian Sync is end-to-end encrypted with no public API, and Claude's cloud containers start empty. A config-only repo turned out to be the whole answer."
date: 2026-08-18
---

I pay for Obsidian Sync, and I've started running Claude Code in cloud sessions, which are just disposable VMs that spin up, do some work, and get thrown away. I wanted Claude to be able to read my notes in those sessions, and the naive answer is that it can't. Obsidian Sync has no public API, people have been asking for one since 2021, and because the whole thing is end-to-end encrypted, Obsidian's servers couldn't hand my notes to anyone even if they wanted to.

The thing I kept missing is that sync data is just files. Obsidian Sync's entire job is to keep a plain-markdown copy of the vault on local disk, so on my own machine the problem doesn't exist at all. You just point Claude Code at the vault folder. The cloud containers were the only real problem, because they don't have my disk. They needed a way to become one of my devices.

## The unlock

In 2026 Obsidian quietly shipped exactly the missing piece: [obsidian-headless](https://github.com/obsidianmd/obsidian-headless), an open-beta npm package that speaks the Sync protocol from the command line. `ob login`, `ob sync-setup`, `ob sync`. No desktop app, same end-to-end encryption, and it has non-interactive flags built for CI and agents. A container that runs it is just another sync device. It pulls the encrypted vault and decrypts it locally, the same way the app on my phone does.

## The architecture

Claude Code cloud sessions require a GitHub repo as their workspace, so the repo itself became the delivery vehicle. Mine contains no application code at all, it's pure configuration:

1. A **SessionStart hook** fires a small script at the start of every cloud session. The script is a no-op unless it detects it's running remotely, so it can never fight the desktop app on my Mac (running both on the same machine causes sync conflicts).
2. The script logs in with credentials from the environment config and pulls the vault to `~/vault`.
3. **Skills live in the repo** too. Personal skills in `~/.claude` stay on your machine, but skills in the repo's `.claude/skills/` folder travel into every container. That one took me a bit to internalize.
4. A **permissions allowlist** pre-approves the sync commands so unattended runs never stall on a prompt.
5. A **weekly scheduled routine** re-verifies the whole pipeline and keeps the environment snapshot warm.

## MFA without turning MFA off

The part I expected to be a dealbreaker wasn't. `ob login` takes an MFA code, and an MFA code is just a computation over a secret seed. I put the TOTP seed (the base32 string behind the authenticator QR code) in the environment config, and twenty lines of Node compute the current 6-digit code at login time. Inside that environment the seed sits next to the password, so MFA adds nothing there, but it still protects the account against a password leak anywhere else, which is kind of the whole point of MFA anyway.

## The shakedown cruise

The first validation run failed, and honestly that failure sold me on the design more than the success did. The beta CLI had already drifted from its own docs, `ob login` dropped a flag my script used. The weekly agent hit the error, read `ob --help`, patched the script, committed, and pushed the fix, because the skill told it that's what to do when a beta CLI drifts. Then it correctly reported the real blocker instead of working around it. Two config values later the next run came back: fully synced, 1,882 files, pulled before the agent had said a word.

Total footprint is six files and 179 lines. The hard part wasn't code, it was realizing the wall (no API) had a door (an official headless client), and that the repo a cloud session clones is the natural place to carry your keys, your hooks, and your skills. Now any scheduled agent I run starts from what I actually know and think instead of an empty container. Curious how far that goes.
