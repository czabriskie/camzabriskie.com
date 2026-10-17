---
title: Agent harnesses, the loop around the model
description: What an agent harness does, how the tool-use loop works one turn at a time, and the three places a tool can run (where the harness is, on the provider's servers, or on an MCP server).
order: 3
updated: 2026-10-17
---

A language model on its own only writes text. Ask it to fix a failing test and it can describe a fix, but it can't run the tests, open the file, or save the edit. The program that does those things for it, and keeps going back to the model with the results until the job is done, is the **agent harness**. Claude Code has one, GitHub Copilot's cloud agent has one, and so does any chat app that can search the web before it answers.

## A few terms

- **Model**: the language model itself, reached over an API. It reads the conversation so far and writes the next response. It runs on the provider's servers, never on your machine, in every setup in this primer.
- **Tool**: an operation the model is allowed to ask for, described to it by a name, a description, and a schema for its inputs. The model only ever sees that description, never the code behind it [@claude-how-tool-use-works]. "Run a shell command", "read a file", and "search the web" are tools.
- **Tool call**: the model's structured request to use a tool, with the arguments filled in. In Claude's API it arrives as a `tool_use` block, and the answer goes back as a `tool_result` block [@claude-how-tool-use-works].
- **Harness**: the program around the model that sends it the conversation, runs the tools it asks for, sends back the results, and decides when to stop. You'll also see it called the **agent loop** or the **agent runtime**. It is not a *test harness*, the code that drives a test suite, even though an agent harness often ends up running one.
- **Turn**: one trip around the loop. The model answers with tool calls, the harness runs them, and the results go back to the model [@agent-sdk-agent-loop].
- **Sandbox**: an isolated place for tools to run, such as a container, so the agent can only reach the files and network it's been given [@managed-agents-choosing-environment].

## A running example

The examples use one made-up project, `bookshelf`, a small web app with one failing test. You give the agent one sentence: "Fix the failing test in `auth.ts`." Every section below comes back to that request.

## The loop, one turn at a time

The model never runs anything itself. It writes a structured request, something else runs the operation, and the result goes back into the conversation [@claude-how-tool-use-works]. The harness is that something else. When you write your own harness against Claude's API, it is a loop keyed on the response's `stop_reason` [@claude-how-tool-use-works]:

1. Send the conversation and the list of tools.
2. The model answers with `stop_reason: "tool_use"` and one or more tool calls.
3. Run each tool and collect the outputs as tool results.
4. Send everything again, now with the model's tool calls and your results added.
5. Repeat from step 2 while `stop_reason` is `"tool_use"`. Any other stop reason, such as `"end_turn"`, means the model has finished or stopped for a reason you should handle.

<div class="agh-loop" role="img" aria-label="Diagram of three boxes in a row: Tools on the left, the Harness in the middle, and the Model on the right. Step 1, the harness sends the prompt and the tool list to the model. Step 2, the model sends back a tool call. Step 3, the harness runs the tool, and the tool's output comes back to the harness. Step 4, the harness sends the tool result to the model. Steps 2 to 4 repeat once per turn. Step 5, the model sends a final answer with no tool calls, and the loop ends. Server tools such as web search run on the model's side and never reach the harness.">
<svg viewBox="0 0 400 210" aria-hidden="true" focusable="false">
<defs><marker id="agh-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="agh-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="agh-box" x="10" y="20" width="76" height="170" rx="5"/>
<text class="agh-name" x="48" y="40">Tools</text>
<text class="agh-small" x="48" y="54">bash, files,</text>
<text class="agh-small" x="48" y="66">your own</text>
<rect class="agh-box agh-harness" x="162" y="20" width="76" height="170" rx="5"/>
<text class="agh-name" x="200" y="40">Harness</text>
<text class="agh-small" x="200" y="54">runs the loop</text>
<rect class="agh-box" x="314" y="20" width="76" height="170" rx="5"/>
<text class="agh-name" x="352" y="40">Model</text>
<text class="agh-small" x="352" y="54">provider API</text>
<text class="agh-small" x="352" y="166">server tools</text>
<text class="agh-small" x="352" y="178">run here</text>
<line class="agh-arrow" x1="238" y1="80" x2="314" y2="80" marker-end="url(#agh-head)"/>
<text class="agh-small" x="276" y="75">1 prompt+tools</text>
<line class="agh-arrow" x1="314" y1="105" x2="238" y2="105" marker-end="url(#agh-head)"/>
<text class="agh-small" x="276" y="100">2 tool call</text>
<line class="agh-arrow" x1="162" y1="118" x2="86" y2="118" marker-end="url(#agh-head)"/>
<text class="agh-small" x="124" y="113">3 run tool</text>
<line class="agh-arrow agh-dashed" x1="86" y1="135" x2="162" y2="135" marker-end="url(#agh-head)"/>
<text class="agh-small" x="124" y="148">output</text>
<line class="agh-arrow" x1="238" y1="135" x2="314" y2="135" marker-end="url(#agh-head)"/>
<text class="agh-small" x="276" y="130">4 tool result</text>
<line class="agh-arrow" x1="314" y1="160" x2="238" y2="160" marker-end="url(#agh-head)"/>
<text class="agh-small" x="276" y="155">5 final answer</text>
</svg>
</div>

<p class="bitgrid-caption">Steps 2 to 4 repeat once per turn. The model is on the far side of every arrow on the right, so every turn is at least one round trip to the provider.</p>

For `bookshelf`, a typical run takes four turns. This is the example from the Agent SDK's documentation, which uses the same request [@agent-sdk-agent-loop]:

1. The model calls the shell tool to run `npm test`. The harness runs it and returns three failures.
2. The model calls the read tool on `auth.ts` and `auth.test.ts`. The harness returns both files.
3. The model calls the edit tool to change `auth.ts`, then the shell tool to run `npm test` again. All three tests pass.
4. The model answers in plain text, with no tool calls: the bug is fixed and the tests pass. The loop ends.

That's three turns with tool calls and one final text-only answer. A harness also needs a way to stop a run that doesn't end on its own. The Agent SDK lets you cap the number of turns, or the money spent, and suggests setting a budget for anything that runs unattended [@agent-sdk-agent-loop].

Running the loop is only part of what a production harness does. Claude Code's, for example, also decides which tools may run without asking you first (**permissions**), runs your own code before or after a tool call (**hooks**), saves the conversation so you can resume it (**sessions**), and loads project instructions and skills from the repository [@agent-sdk-overview]. Those are the parts you configure. The loop itself rarely changes.

## Three places a tool can run

A tool call is just a request, so it can be carried out wherever something is willing to run it. Claude's documentation sorts every tool by where its code executes, and treats that as the main way tools differ [@claude-how-tool-use-works]. Adding MCP servers gives three places in practice:

| Where it runs | Who runs the code | Examples | What the harness does |
|---|---|---|---|
| Wherever the harness runs (**client tools**) | You, or the harness you installed | shell commands, reading and editing files, your own functions | Runs the tool and sends back the result |
| On the provider's servers (**server tools**) | The provider | web search, web fetch, code execution | Turns the tool on, then reads what came back |
| On an **MCP server** | Whoever operates that server | a ticket system, a docs search | Passes the call to the server over MCP |

### Client tools: where the harness is

For a client tool, the API response carries the tool call and your harness runs it [@claude-how-tool-use-works]. In `bookshelf`, `npm test` runs on whatever machine the harness runs on, with that machine's copy of Node, its files, and its network. If the harness is Claude Code on your laptop, the test runs on your laptop. If it's a cloud session, it runs in a container somewhere else, against a fresh clone of the repository.

Some client tools have schemas the provider publishes, such as Claude's `bash` and `text_editor`. You still run them, but the model has been trained on those exact schemas, so it calls them more reliably than a home-made tool that does the same job [@claude-how-tool-use-works].

### Server tools: the provider's side

For a server tool, the provider runs the code and you never build a tool result. A request with only server tools can trigger several searches or code runs before the response reaches you, because the provider runs its own loop. That loop has an iteration limit, and a response that hits it comes back with `stop_reason: "pause_turn"`, which you continue by sending the conversation again [@claude-how-tool-use-works].

The code execution tool runs in a Linux container on Anthropic's side. That container has no internet access, so only its pre-installed libraries are available, and each request gets a new container unless you pass back the ID of an earlier one [@claude-code-execution-tool].

<details class="aside">
<summary>Two computers, one conversation</summary>

Give a model both the code execution tool and your own shell tool and it is working on two separate computers. The documentation warns that Claude can confuse them, using the wrong tool or assuming files are shared between them, and suggests saying so in the system prompt [@claude-code-execution-tool]. In `bookshelf`, a file the model writes with code execution is in Anthropic's container, not in your checkout.
</details>

### MCP servers: a third program

An MCP server is a separate program that offers tools over the Model Context Protocol ([Running an MCP server locally over stdio](/primers/working-with-ai/mcp-servers-over-stdio/) explains the protocol). Who connects to it depends on the harness. Claude Code on your laptop can start a stdio server as a child process on your machine. Claude's API can also connect to MCP servers itself, through the MCP connector, but then the connection comes from Anthropic's side, so the server must be reachable over HTTP and a local stdio server can't be used directly [@claude-mcp-connector]. The same tool can therefore run on your laptop with one harness and be out of reach with another.

## Harnesses you'll meet {only: Claude}

Anthropic ships several harnesses, and they differ mostly in who runs the loop and where [@agent-sdk-overview]:

| Option | Who runs the loop | Where client tools run |
|---|---|---|
| Messages API, with your own loop | Your code | Wherever your code runs |
| Claude Code (the CLI) | Claude Code, on your machine | Your machine |
| Agent SDK | Your application, which starts Claude Code as a subprocess [@agent-sdk-hosting] | Wherever you host that application |
| Managed Agents | Anthropic [@managed-agents-overview] | An Anthropic-managed sandbox, or a self-hosted one on your infrastructure [@managed-agents-overview] |

Other vendors draw the same lines in their own places. GitHub's Copilot cloud agent, for example, edits files and runs tests "in an ephemeral cloud development environment" rather than in your editor [@github-copilot-on-github].

Once the loop and the tools can sit on different machines, the choice of where each one goes decides how long setup takes, how long each turn waits, and what the agent can reach. [Where an agent runs](/primers/working-with-ai/where-agents-run/) picks that up.
