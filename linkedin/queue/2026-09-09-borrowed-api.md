---
title: "Tech Bytes: the feature that needed nothing is the one that survived"
publish_at: 2026-09-09T13:00:00Z
first_comment: "Wrote the longer version here: https://camzabriskie.com/tech-bytes/borrowed-api/"
sources:
  - my own notes on the Spotify Web API constraints, from the czabriskie/heads-up repo
---

A while back I built a party game that plays like Heads Up but with songs, you hold the phone on your forehead and a track from one of your own Spotify playlists plays out loud while everyone else watches you fail to name it. It works, and building it taught me less about Android than it did about what you sign up for when the best part of your thing lives behind somebody else's endpoint.

The running list is longer than I expected. Playback needs Spotify Premium and needs the Spotify app already awake on the phone, or it doesn't register as a device and the round can't start. The path I was using to read a playlist's songs started returning a 403 and had to move. Spotify only lets an app read playlists you own or collaborate on, so every editorial playlist is simply invisible to me. And the nicest feature in the whole game, starting each song at its most recognizable part instead of the intro, was built on an audio analysis endpoint Spotify stopped serving to apps registered after late 2024, so a fresh app falls back to a guess about where the good part probably is.

None of that is Spotify wronging me, to be clear. It's their API and their data and a company narrowing what third parties can do usually has reasons that make sense from the inside. But there's a switch that turns playback off entirely, so the game just shows the title and artist and everyone hums the song instead, and it makes no calls to Spotify at all during a round. I built it as a nice option and almost skipped it, and it's the only part of that game nobody can take away.

Every dependency is a promise someone else can stop keeping, and you don't find out which ones matter until one of them goes. Worth knowing, before you build the demo around the API call, which version of your thing still works when that call returns a 403.
