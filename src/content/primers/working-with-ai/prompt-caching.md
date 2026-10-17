---
title: Prompt caching, and how it differs from other caches
description: What a cache is, why a model's prompt cache stores the work of reading a prompt rather than an answer, how much of an agent run it saves, how Claude's API does it, and what silently breaks it.
order: 5
updated: 2026-10-17
---

Every turn of an agent run sends the model the whole conversation again, as [Agent harnesses](/primers/working-with-ai/agent-harnesses/#the-loop-one-turn-at-a-time) shows. By the last turn of even a short run, almost all of that request is text the model already read a few seconds earlier. **Prompt caching** lets the provider keep the work it did reading that text, so the next request only pays for what's new. It cuts both the cost and the wait before the first word of each reply, and it's easy to break without noticing.

## A few terms

- **Token**: the unit a model reads and writes, a word or a piece of one. Prices, limits and cache sizes are all counted in tokens.
- **Prompt**: everything sent to the model in one request. For an agent that's the tool definitions, the system prompt (the harness's standing instructions), and the conversation so far.
- **Prefix**: the start of the prompt, up to some point. Two prompts share a prefix when they're identical up to that point, token for token.
- **Time to first token**: how long a request waits before the model's reply starts arriving. Reading a long prompt is part of that wait [@claude-prompt-caching].
- **Cache hit / cache miss**: a hit means the cache had what the request needed, a miss means it didn't and the work was done in full.
- **TTL** (time to live): how long a cache keeps an entry before throwing it away.
- **Invalidation**: anything that makes a cached entry stop matching, so the next request misses.

## Caching in general

A cache keeps the result of some work so the next request for the same thing can skip the work. Every cache has a **key** (how it recognizes "the same thing"), something it **stores**, and a **lifetime**. You've likely met two already:

| Cache | Key | What it stores | Lifetime | A hit skips |
|---|---|---|---|---|
| DNS resolver | the name and record type | the answer | the record's TTL ([Caching, TTLs, and "propagation"](/primers/networking/dns-resolution/#caching-ttls-and-propagation)) | asking the authoritative servers again |
| HTTP cache, in a browser or CDN | at least the request method and URL [@rfc9111] | the response | a freshness lifetime set by the response's headers [@rfc9111] | fetching from the origin server |
| Prompt cache | the exact prompt prefix | the model's work from reading that prefix | 5 minutes or 1 hour on Claude's API, reset each time it's used [@claude-prompt-caching] | reading the prefix again |

The first two store an *answer*. On a hit you get the old answer back, and if the world changed in the meantime the answer is stale. That's why DNS changes take time to "propagate".

A prompt cache stores no answer at all. The model still writes a fresh reply to every request, and Anthropic's documentation says the reply is identical to the one you'd get without caching [@claude-prompt-caching]. A prompt cache can't go stale. It can only hit or miss, which also means the only cost of getting it wrong is money and time, never a wrong result.

## What gets cached

A model handles a request in two steps. First it reads the whole prompt, computing internal values for every token, and only then does it start writing the reply one token at a time. The values that matter here are the "keys" and "values" the model's attention layers compute for each token, and keeping them so they aren't computed again is called a **KV cache** [@hf-kv-cache]. Reading is the part that grows with the length of the prompt.

**Prefix caching** keeps the KV cache from one request and reuses it when a later request starts with the same tokens. The open-source inference server vLLM explains its version: it splits the prompt into blocks and identifies each block by its own tokens *and every token before it*, so a block can only be reused when everything in front of it matches too. vLLM notes that this doesn't change the model's output, and that public endpoints, Anthropic's and OpenAI's among them, use it widely [@vllm-prefix-caching]. The idea isn't specific to one vendor. The details below are Claude's, but the shape is the same elsewhere.

Identifying blocks by everything in front of them gives prompt caching its one hard rule: **a change anywhere invalidates everything after it**. Edit one word near the start of a prompt and the whole rest of it is new, as far as the cache can tell.

## The bookshelf run, token by token

The running example is the four-turn `bookshelf` fix from [Agent harnesses](/primers/working-with-ai/agent-harnesses/#a-running-example): a sign-in check compares seconds with milliseconds, the agent runs the tests, reads two files, fixes one line, reruns the tests, and reports. The token counts below are made up but plausible. Say the tool definitions and system prompt come to 12,000 tokens, and your request "Fix the failing test" adds 20.

Each request is the previous request, plus the model's tool calls, plus their results. Nothing earlier ever changes, which is the best possible case for a prefix cache:

| Turn | New since last request | Request size | Read from cache | Written to cache |
|---|---|---|---|---|
| 1 Run the tests | tools, system prompt, your request | 12,020 | 0 | 12,020 |
| 2 Read two files | the `npm test` call (40) and its output (150) | 12,210 | 12,020 | 190 |
| 3 Edit, rerun | two read calls (60) and both files (1,000) | 13,270 | 12,210 | 1,060 |
| 4 Report | the edit and test calls (120) and their results (80) | 13,470 | 13,270 | 200 |

<div class="pcb-bars" role="img" aria-label="Four horizontal bars, one per turn, drawn to the same scale, showing how much of each request was read from cache and how much was written. Turn 1, 12,020 tokens, all written. Turn 2, 12,210 tokens, 12,020 read and a sliver of 190 written. Turn 3, 13,270 tokens, 12,210 read and 1,060 written. Turn 4, 13,470 tokens, 13,270 read and a sliver of 200 written.">
<svg viewBox="0 0 400 156" aria-hidden="true" focusable="false">
<text class="pcb-name" x="4" y="25">Turn 1</text>
<text class="pcb-small" x="4" y="36">12,020</text>
<rect class="pcb-write" x="76" y="16" width="267.7" height="18"/>
<text class="pcb-name" x="4" y="55">Turn 2</text>
<text class="pcb-small" x="4" y="66">12,210</text>
<rect class="pcb-read" x="76" y="46" width="267.7" height="18"/>
<rect class="pcb-write" x="343.7" y="46" width="4.2" height="18"/>
<text class="pcb-name" x="4" y="85">Turn 3</text>
<text class="pcb-small" x="4" y="96">13,270</text>
<rect class="pcb-read" x="76" y="76" width="271.9" height="18"/>
<rect class="pcb-write" x="347.9" y="76" width="23.6" height="18"/>
<text class="pcb-name" x="4" y="115">Turn 4</text>
<text class="pcb-small" x="4" y="126">13,470</text>
<rect class="pcb-read" x="76" y="106" width="295.5" height="18"/>
<rect class="pcb-write" x="371.5" y="106" width="4.5" height="18"/>
<rect class="pcb-read" x="76" y="140" width="12" height="9"/>
<text class="pcb-legend" x="93" y="148">read from cache</text>
<rect class="pcb-write" x="196" y="140" width="12" height="9"/>
<text class="pcb-legend" x="213" y="148">written to cache</text>
</svg>
</div>

<p class="bitgrid-caption">After the first turn, almost every token is a cache read. Only the newest tool calls and results are written.</p>

On Claude's API, writing to a 5-minute cache costs 1.25 times the normal input price, and reading from it costs 0.1 times, or less on some newer models [@claude-prompt-caching]. Counting in "normal input tokens":

- **Without caching**: 12,020 + 12,210 + 13,270 + 13,470 = 50,970.
- **With caching**: writes of 12,020 + 190 + 1,060 + 200 = 13,470, times 1.25, is 16,837.5. Reads of 12,020 + 12,210 + 13,270 = 37,500, times 0.1, is 3,750. Together, 20,587.5, about 40% of the uncached cost.

Turn 1 alone costs *more* with caching, 1.25 times as much, because it writes and reads nothing, so a prompt that's never repeated within the cache's lifetime only loses. And the longer the run, the better caching does, because each new turn adds a small write and a large read. A real coding session runs dozens of turns over a growing conversation, so the read side dominates even more than here.

The time saved follows the same pattern. On a hit the model skips reading the cached part, which shortens the time to first token, and Anthropic points to long documents as where that shows [@claude-prompt-caching]. In [Where an agent runs](/primers/working-with-ai/where-agents-run/#where-the-time-in-a-run-goes) terms, caching makes the "Model" column shorter on every turn after the first.

## Prompt caching in Claude's API {only: Claude}

### Turning it on

The simplest form is **automatic caching**: add one `cache_control` field at the top level of the request, and the API puts the cache point on the last block it can cache, moving it forward as the conversation grows [@claude-prompt-caching]. That matches an agent loop exactly, since each request is the last one plus a little more.

For more control, put `cache_control` on individual blocks instead. Each one is a **cache breakpoint**, a marker saying "store everything up to here". You can have up to four [@claude-prompt-caching]. A few rules decide whether a breakpoint ever hits [@claude-prompt-caching]:

- **The prefix is built in a fixed order**: tool definitions, then the system prompt, then the messages. A change at one level invalidates that level and everything after it.
- **Matching is exact.** Every token up to the breakpoint has to be identical.
- **Entries are written only at breakpoints.** On a later request the API looks back up to 20 blocks from each breakpoint for an entry an earlier request wrote. It doesn't find stable content and cache it on its own, so a breakpoint placed on a block that changes every request writes a fresh entry every time and never reads one.
- **Short prompts aren't cached.** Below a minimum length, 512 tokens on the newest models and more on some older ones, the request runs uncached with no error.

### Lifetime and price

An entry lives 5 minutes by default, and each hit resets the clock at no charge. The 5 minutes count from the start of the request that wrote or read it, so a reply that takes 4 minutes to stream leaves about 1 minute for the next request. A 1-hour lifetime is also available, at 2 times the input price to write instead of 1.25 [@claude-prompt-caching]. In the `bookshelf` run the turns are seconds apart, so 5 minutes is plenty. The 1-hour lifetime suits a conversation where a person stops to read and think between messages.

Two more details matter when you run several requests at once. A new entry can only be used once the response that wrote it has started, so parallel requests that share a prefix only hit if you wait for the first one to begin. And caches are kept separate between organizations, and between workspaces within one on Claude's own API [@claude-prompt-caching].

### Checking that it worked

Every response reports cache use in its `usage` field [@claude-prompt-caching]:

- `cache_creation_input_tokens`: tokens written to the cache by this request.
- `cache_read_input_tokens`: tokens read from the cache.
- `input_tokens`: tokens after the last breakpoint, which were neither. This is not the total; the total is the sum of all three.

If both cache fields are 0, nothing was cached, most often because the prompt was under the minimum length [@claude-prompt-caching].

To see it happen, send the same request twice within 5 minutes. Save this as `request.json`, with a few pages of text as the system prompt (any long document works, with its quotes and line breaks escaped the way JSON requires) so it clears the minimum:

```json
{
  "model": "claude-opus-5-5",
  "max_tokens": 50,
  "cache_control": { "type": "ephemeral" },
  "system": "PASTE A FEW PAGES OF TEXT HERE",
  "messages": [{ "role": "user", "content": "Summarize the text in one sentence." }]
}
```

Then send it, with your API key in the `ANTHROPIC_API_KEY` environment variable. `anthropic-version` names the API version, and `2023-06-01` is the current one [@claude-api-versions]:

```bash tab="macOS / Linux"
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d @request.json
```

```powershell tab="Windows (PowerShell)"
$headers = @{ 'x-api-key' = $env:ANTHROPIC_API_KEY; 'anthropic-version' = '2023-06-01' }
(Invoke-RestMethod https://api.anthropic.com/v1/messages -Method Post -Headers $headers -ContentType 'application/json' -InFile request.json).usage
```

The macOS and Linux version prints the whole response, with `usage` near the end. The PowerShell version prints only `usage` [@ms-invoke-restmethod]. With made-up numbers, the first run writes the prefix:

```text
"cache_creation_input_tokens": 2310, "cache_read_input_tokens": 0, "input_tokens": 3
```

and the second, sent a minute later, reads it:

```text
"cache_creation_input_tokens": 0, "cache_read_input_tokens": 2310, "input_tokens": 3
```

Change one word near the start of the system prompt and send it again, and you'll see a fresh write, which is the next section in miniature.

## What breaks a cache

Since everything after a change is new, the question for any prompt is what changes, and where. Anthropic's documentation lists what invalidates which part [@claude-prompt-caching]. The ones an agent is most likely to hit:

| Change | What's invalidated |
|---|---|
| Any tool definition (a name, description, or parameter) | Everything: tools, system prompt, and messages |
| Turning web search or citations on or off | The system prompt and messages, because the system prompt changes |
| `tool_choice`, or adding or removing an image anywhere | The messages |

And the mistakes that cost the most because nothing reports them:

- **Something that changes every request near the start.** A timestamp or a request ID in the system prompt makes every request a miss. Put changing content at the end, and the breakpoint just before it [@claude-prompt-caching].
- **JSON keys in a different order.** Some languages, Go and Swift among them, don't keep key order when they build JSON, so the "same" tool input serializes differently and stops matching [@claude-prompt-caching].
- **Changing the tool list mid-session.** Connecting another MCP server, or a harness that adds and removes tools as it goes, changes the tool definitions, which sit at the very front of the prefix.
- **Gaps longer than the lifetime.** Leave a 5-minute cache alone for 6 minutes and the next request writes it all again.

In each case the fix is to keep the front of the prompt fixed and let only the end grow.

## Where you'll meet it

If you use Claude Code, a managed agent, or another finished harness, caching is already set up, and your part is mostly not breaking it. Managed Agents, for example, lists prompt caching among the optimizations its harness handles for you [@managed-agents-overview].

If you write your own loop on the Messages API, add the top-level `cache_control`, check `cache_read_input_tokens` on the second turn, and keep anything that changes per request at the end of the prompt. For an app whose first user would otherwise pay the full read, a **pre-warming** request can load the shared system prompt and tool definitions into the cache before anyone arrives [@claude-prompt-caching].
