# 0008. Primer commands: macOS/Linux and PowerShell tabs, copy buttons, command builders

**Status:** Accepted
**Date:** 2026-10-06

## Context

Primers show commands readers can run (`openssl`, `dig`, `curl`, `aws ssm`), and they
were all written for zsh/bash. Readers on Windows would have to translate them, and some
don't translate at all (`</dev/null`, `&` and `sleep`, `\` line continuations, `dig`
itself). Cam asked for tabs per terminal type, and for that to be the standard across
every primer. He also wanted readers to run the certificate-inspection command against
any site from the page. Actually running it would need a server, which this static site
doesn't have (Decision 0001), so the page builds the command and the reader runs it.

## Decision

- Two tabs: **macOS / Linux** (zsh and bash share it, since the commands primers use
  behave the same in both) and **Windows (PowerShell)**. A separate bash tab, or
  OS-specific tabs like Linux and macOS, get added only where the commands really differ.
- Only blocks that differ get tabs. A command that's identical everywhere (`ssh -J`,
  `openssl x509 -text`) stays a single block.
- Markdown syntax: consecutive fenced blocks with `tab="Label"` in the meta string
  (```` ```powershell tab="Windows (PowerShell)" ````). A remark plugin
  (`src/lib/remark-code-tabs.mjs`) wraps each run of them in a `.code-tabs` group.
- `src/scripts/code-tabs.ts` turns the groups into tabs. Picking a tab switches every
  group on the page with that label and is remembered in `localStorage` (this browser
  only, nothing sent anywhere). With no saved choice, Windows visitors start on the
  PowerShell tab. Without JavaScript, every panel shows under its label.
- Every code block in a primer gets a Copy button.
- The script only loads on primer pages. A post using `tab=` would show every version
  under its label, with no tabs.
- Command builder: `<div class="cmd-builder" data-default="camzabriskie.com"
  data-label="Site"></div>` right before a code block or tab group adds an input that
  replaces every occurrence of the default value in that block as the reader types. It
  validates hostnames and stays in the browser.
- PowerShell versions get the same check as everything else: run in PowerShell 7 where
  possible, and cite Microsoft's docs for cmdlets that only exist on Windows.

## Consequences

- Every new command in a primer needs a decision about whether it differs on Windows,
  and a PowerShell version if it does. That's more work per primer and more to keep
  correct, which is why identical commands stay as single blocks.
- Some tools aren't on Windows by default (OpenSSL, `dig`). The PowerShell tab either
  uses the Windows equivalent (`Resolve-DnsName`) or says what needs installing.
- The command builder can't show output, only the command. Readers still need the tool
  installed locally.
