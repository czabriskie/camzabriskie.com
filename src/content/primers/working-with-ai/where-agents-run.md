---
title: Where an agent runs, and what it costs in setup and waiting
description: The common places to run an agent harness and its tools (your laptop, your own containers, a cloud session, a managed service), how much setup each needs, where the time in a run goes, and which to pick.
order: 4
updated: 2026-10-17
---

[Agent harnesses](/primers/working-with-ai/agent-harnesses/) explains the loop: the model asks for a tool, the harness runs it, the result goes back, and that repeats until the job is done. The model always runs on the provider's servers. The harness and its tools can run on your laptop, on servers you run, or on the provider's side, and the choice decides how long setup takes, how long the agent waits on each turn, what it can reach, and whether it keeps going after you close the lid.

## A few terms

- **Harness, tool, turn**: as in the previous primer. The harness runs the loop, a tool is an operation the model can ask for, and a turn is one trip around the loop.
- **Latency**: time spent waiting. Here, mostly the time a turn takes from the model's request to the next model call.
- **Round trip**: a request going out and its answer coming back. Every turn includes at least one, because the model is on the other end of an API [@claude-how-tool-use-works].
- **Cold start**: the time from asking for a fresh environment to it being ready for the first request [@agent-sdk-hosting]. A container that has to install Node and your dependencies before the agent can run `npm test` has a long one.
- **Sandbox**: an isolated place, such as a container, where the agent's tools run and work on files [@managed-agents-choosing-environment].
- **Egress**: traffic going out of a network. A sandbox's egress rules decide which outside hosts the agent can reach.

## Five common setups

The running example is the same made-up `bookshelf` app with a failing test in `auth.ts`. The agent will run `npm test`, read some files, edit one, and run the tests again. Five setups cover most of what you'll meet, and each puts the pieces in a different place:

1. **Local CLI.** Claude Code (or a similar tool) in a terminal on your laptop. The loop and the tools run on your machine [@claude-code-sandboxing].
2. **Agent SDK on your own servers.** Your application starts the harness as a subprocess, in a container you run. Loop and tools are both in your container [@agent-sdk-hosting].
3. **Cloud session.** Claude Code started from the browser, the phone app, or `claude --cloud`, running in an isolated VM that Anthropic manages [@claude-code-cloud-sessions].
4. **Managed agent, cloud environment.** Anthropic runs the loop and gives each session a fresh Linux container for the tools [@managed-agents-choosing-environment].
5. **Managed agent, self-hosted sandbox.** Anthropic still runs the loop, but a **worker** process on your infrastructure claims the session, runs each tool call locally, and posts the result back [@managed-agents-self-hosted].

<div class="agw-grid" role="img" aria-label="A grid with five rows, one per setup, and three columns: your machine, your servers, and the provider. A dashed line separates the provider column from the other two. Local CLI: loop and tools on your machine, model at the provider. Agent SDK: loop and tools on your servers, model at the provider. Cloud session: loop, tools and model all at the provider. Managed agent in a cloud environment: all three at the provider. Managed agent with a self-hosted sandbox: tools on your servers, loop and model at the provider.">
<svg viewBox="0 0 400 228" aria-hidden="true" focusable="false">
<text class="agw-head" x="150" y="16">Your machine</text>
<text class="agw-head" x="250" y="16">Your servers</text>
<text class="agw-head" x="350" y="16">Provider</text>
<line class="agw-rule" x1="300" y1="24" x2="300" y2="224"/>
<line class="agw-row" x1="0" y1="68" x2="400" y2="68"/>
<line class="agw-row" x1="0" y1="106" x2="400" y2="106"/>
<line class="agw-row" x1="0" y1="144" x2="400" y2="144"/>
<line class="agw-row" x1="0" y1="182" x2="400" y2="182"/>
<text class="agw-name" x="4" y="46">1 Local CLI</text>
<text class="agw-small" x="4" y="58">your laptop</text>
<rect class="agw-chip" x="118" y="42" width="30" height="14" rx="3"/><text class="agw-label" x="133" y="52">loop</text>
<rect class="agw-chip agw-tools" x="151" y="42" width="30" height="14" rx="3"/><text class="agw-label" x="166" y="52">tools</text>
<rect class="agw-chip" x="335" y="42" width="30" height="14" rx="3"/><text class="agw-label" x="350" y="52">model</text>
<text class="agw-name" x="4" y="84">2 Agent SDK</text>
<text class="agw-small" x="4" y="96">your container</text>
<rect class="agw-chip" x="218" y="80" width="30" height="14" rx="3"/><text class="agw-label" x="233" y="90">loop</text>
<rect class="agw-chip agw-tools" x="251" y="80" width="30" height="14" rx="3"/><text class="agw-label" x="266" y="90">tools</text>
<rect class="agw-chip" x="335" y="80" width="30" height="14" rx="3"/><text class="agw-label" x="350" y="90">model</text>
<text class="agw-name" x="4" y="122">3 Cloud session</text>
<text class="agw-small" x="4" y="134">managed VM</text>
<rect class="agw-chip" x="303" y="118" width="30" height="14" rx="3"/><text class="agw-label" x="318" y="128">loop</text>
<rect class="agw-chip agw-tools" x="335" y="118" width="30" height="14" rx="3"/><text class="agw-label" x="350" y="128">tools</text>
<rect class="agw-chip" x="367" y="118" width="30" height="14" rx="3"/><text class="agw-label" x="382" y="128">model</text>
<text class="agw-name" x="4" y="160">4 Managed, cloud</text>
<text class="agw-small" x="4" y="172">managed sandbox</text>
<rect class="agw-chip" x="303" y="156" width="30" height="14" rx="3"/><text class="agw-label" x="318" y="166">loop</text>
<rect class="agw-chip agw-tools" x="335" y="156" width="30" height="14" rx="3"/><text class="agw-label" x="350" y="166">tools</text>
<rect class="agw-chip" x="367" y="156" width="30" height="14" rx="3"/><text class="agw-label" x="382" y="166">model</text>
<text class="agw-name" x="4" y="198">5 Managed + worker</text>
<text class="agw-small" x="4" y="210">your sandbox</text>
<rect class="agw-chip agw-tools" x="235" y="194" width="30" height="14" rx="3"/><text class="agw-label" x="250" y="204">tools</text>
<rect class="agw-chip" x="318" y="194" width="30" height="14" rx="3"/><text class="agw-label" x="333" y="204">loop</text>
<rect class="agw-chip" x="351" y="194" width="30" height="14" rx="3"/><text class="agw-label" x="366" y="204">model</text>
</svg>
</div>

<p class="bitgrid-caption">The dashed line is the internet between you and the provider. In rows 1, 2 and 5 every turn crosses it once: for the model call in 1 and 2, for the tool call in 5. Rows 3 and 4 keep the whole turn on the provider's side.</p>

## Where the time in a run goes

Each turn costs the model's time to respond, the tool's time to run, and one round trip for whichever of those is on the far side of the line in the diagram. Every tool call is at least one extra round trip, and for small tasks that overhead can exceed the work itself [@claude-how-tool-use-works].

A worked example, with made-up numbers you should replace with your own. Say `bookshelf`'s fix takes 20 turns, the model takes 5 seconds to respond each turn, the tools average 1 second, and a round trip between you and the provider is 0.1 seconds:

| Part | Per turn | × 20 turns |
|---|---|---|
| Model responding | 5 s | 100 s |
| Tools running | 1 s | 20 s |
| Round trip across the line | 0.1 s | 2 s |
| **Total** | | **122 s** |

Moving the loop so it sits next to the model (row 4) or next to the tools (rows 1 and 2) removes at most those 2 seconds. Three other things move the total much more:

- **The number of turns.** Each turn you avoid saves a whole model response. If the model reads three files in one turn instead of three, that's two fewer turns, which with these numbers is 2 × (5 + 0.1) = 10.2 seconds. Claude can ask for several tools in one turn, and independent read-only calls are the usual candidates for running together [@claude-parallel-tool-use].
- **How slow the tools are.** If `npm test` takes 40 seconds instead of 1, it dominates everything else, and a faster machine for the tools matters more than where the loop is.
- **The cold start.** If a fresh container spends 3 minutes installing dependencies before the first turn, that 180 seconds is more than the entire run above.

To see your own round trip to the API, time one request. The output shows when the TCP connection, the TLS handshake, and the first byte of the reply each finished, counted from the start [@curl-manpage]:

```bash tab="macOS / Linux"
curl -o /dev/null -s -w 'connect %{time_connect}s  tls %{time_appconnect}s  first byte %{time_starttransfer}s\n' https://api.anthropic.com/
```

```powershell tab="Windows (PowerShell)"
(Measure-Command { try { Invoke-WebRequest https://api.anthropic.com/ -UseBasicParsing } catch {} }).TotalMilliseconds
```

The macOS and Linux version prints one line like this:

```text
connect 0.031s  tls 0.072s  first byte 0.118s
```

`connect` is roughly one network round trip, `tls` adds the handshake, and `first byte` is the whole request, including a little time for the server to answer. The PowerShell version prints one number, the total time in milliseconds, comparable to `first byte` [@ms-measure-command] [@ms-invoke-webrequest]. The `catch` is there because the bare URL returns an error status, and only the timing matters here. If the number is a few hundredths of a second, the line in the diagram costs you almost nothing per turn.

## Setup, from least to most

The setups differ much more in what you have to build and run than in per-turn latency.

**Local CLI.** Install it and sign in. The tools are your own machine's tools, so `npm test` uses the Node and the `node_modules` you already have, and there's no cold start beyond launching the program. It also stops when your laptop sleeps. Claude Code's Remote Control lets you steer a local session from your phone or a browser, but the session still runs on your machine, so the machine has to stay on [@claude-code-remote-control].

**Cloud session.** No hosting, but the first session in an environment pays a cold start: the VM clones the repository and runs your **setup script**, a Bash script that installs whatever isn't pre-installed [@claude-code-cloud-environments]. If the script finishes in roughly five minutes, Anthropic snapshots the filesystem and later sessions start from the snapshot and skip it. The snapshot is rebuilt when you change the script or the allowed hosts, or after about seven days. It keeps files, not running processes, so a database the script started has to be started again in each session [@claude-code-cloud-environments]. An idle session's VM pauses after a few minutes with its files saved and resumes on your next message [@claude-code-cloud-environments].

**Managed agent, cloud environment.** Nothing to operate. Each session gets a fresh container with common languages and tools already installed, and you set its network rules and any extra packages [@managed-agents-choosing-environment]. You talk to it through an API, which suits an agent built into your own product.

**Agent SDK on your own servers.** You build and run the container. Anthropic's hosting guide suggests 1 GiB of RAM, 5 GiB of disk, and 1 CPU per agent as a starting point, and points out that session transcripts live on the container's local disk and vanish on a restart unless you copy them to a store [@agent-sdk-hosting]. It describes a few patterns, each with its own cold-start trade-off [@agent-sdk-hosting]:

| Pattern | Container lifetime | Cold start |
|---|---|---|
| Ephemeral | One container per task, destroyed after | Paid every task, so it needs to be sub-second |
| Long-running | Stays up and serves many sessions | Paid once, and the SDK can pre-warm processes before traffic arrives |
| Hybrid | Spins down when idle, restores the session from a store when the user comes back | Paid after each idle period |

**Managed agent, self-hosted sandbox.** You run the worker hosts, harden them, control their egress, and rotate the key the worker uses. You also give up some of the cloud environment's conveniences, such as automatic mounting of files and GitHub repositories and the pre-installed runtimes [@managed-agents-choosing-environment].

## What the agent can reach

Where the tools run decides which network they're on, and that is often what makes the choice for you.

- **Local CLI**: whatever your laptop can reach, including a VPN you're connected to. Claude Code's optional sandbox can restrict shell commands to the domains you allow, on macOS, Linux and WSL2 [@claude-code-sandboxing].
- **Cloud session**: whatever the environment's network access level allows. The levels are None, Trusted (package registries, GitHub, cloud SDKs and other allowlisted domains), Full, and Custom [@claude-code-cloud-environments]. Nothing on your private network.
- **Self-hosted sandbox or your own containers**: your network. The worker runs bash and file tools inside it, so they can reach internal hosts that aren't publicly routable [@managed-agents-choosing-environment].

MCP servers follow their own rule. When Anthropic's side connects to an MCP server, through the API's MCP connector or a managed agent, the server has to be reachable over HTTP from the internet [@claude-mcp-connector]. That's true even with a self-hosted sandbox, because Anthropic, not your worker, connects to the agent's MCP servers [@managed-agents-choosing-environment]. For a server that must stay private, MCP tunnels carry the traffic over an outbound-only connection from your network, so no inbound port has to be opened. They were a research preview when this was written [@claude-mcp-tunnels].

<details class="aside">
<summary>A self-hosted sandbox keeps files, not results</summary>

With a self-hosted sandbox the files and processes stay on your worker, but the conversation and every tool result still go to Anthropic, because that's how the model sees what a tool returned [@managed-agents-choosing-environment]. If `npm test` prints a secret, the model sees the secret. Keeping data in your network means keeping it out of what the tools return, too.
</details>

## Making a slow agent faster

The levers, in the order the arithmetic above suggests:

1. **Cut turns.** Let independent reads run in one turn [@claude-parallel-tool-use], and don't hand the model a tool for something it can answer without one [@claude-how-tool-use-works].
2. **Cache the prompt.** Prompt caching lets the API reuse a prefix it has already processed (the system prompt, the tool definitions, the conversation so far), which cuts the time to the first token of each response. A pre-warming request can load the cache before the first user arrives [@claude-prompt-caching].
3. **Pay the cold start once.** Keep setup-script work under the cache limit in a cloud session [@claude-code-cloud-environments], or keep SDK containers warm when users arrive in bursts [@agent-sdk-hosting].
4. **Speed up the slowest tool.** A test suite that runs only the affected tests helps every turn that runs it.

## Which to pick

| Your situation | Start with |
|---|---|
| Working interactively on code that's on your laptop | Local CLI |
| A long task you want to leave running, or several at once | Cloud session (`claude --cloud "…"` starts one from a terminal [@claude-code-cloud-sessions]) |
| Steering a local session from your phone | Local CLI with Remote Control |
| An agent inside your own product, without running sandboxes | Managed agent, cloud environment |
| An agent inside your product, with full control of the container | Agent SDK on your servers |
| Tools that must run inside your network | Self-hosted sandbox, or a local CLI on a machine inside it |

Anthropic's own advice for managed agents is to start with the cloud environment and move to a self-hosted sandbox only when tools must run on infrastructure you control [@managed-agents-choosing-environment]. The same reasoning works for the rest of the table: begin where setup is cheapest, and move only when the reach or the data rules force it, since per-turn latency rarely decides it.
