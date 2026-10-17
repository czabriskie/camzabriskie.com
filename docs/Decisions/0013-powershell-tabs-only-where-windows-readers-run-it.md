# 0013. PowerShell tabs only where a Windows reader would run the command

**Status:** Accepted
**Date:** 2026-10-14

## Context

Decision 0008 gave primer commands a Windows (PowerShell) tab wherever the command
differs from the macOS/Linux version. The JVM heap primer had one command,
`kubectl exec <pod> -- java -XX:+PrintFlagsFinal -version | grep …`, whose only Windows
difference was the local `| grep`. Everything after `--` runs inside a Linux container, so
the tab added a whole second block for one pipe. Cam asked to drop it and "just use Linux."

## Decision

- A PowerShell tab is added only where a Windows reader would plausibly run the command:
  on their own machine, against their own system, or with tools that behave differently
  on Windows.
- Commands aimed at Linux (run inside a Linux container, on a Linux server, or in a
  Kubernetes pod) stay a single Linux block, even when a local pipe like `| grep` would
  technically differ in PowerShell.
- Everything else in Decision 0008 still applies: the tab mechanics, copy buttons, the
  command builder, and testing PowerShell in pwsh 7.

## Consequences

- Fewer tabs on infrastructure primers, and less PowerShell to keep correct.
- A Windows reader who runs `kubectl` from PowerShell has to swap `grep` for
  `Select-String` or use WSL themselves. That's an acceptable cost for commands whose real
  work happens on Linux.
