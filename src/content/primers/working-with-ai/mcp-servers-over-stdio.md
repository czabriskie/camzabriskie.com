---
title: Running an MCP server locally over stdio
description: How an AI client starts an MCP server as a child process and talks to it through standard input and output, how to register one, and how to test changes to it before anyone else depends on it.
order: 1
updated: 2026-10-13
---

An MCP server gives an AI assistant tools it doesn't have on its own, such as querying a database or filing a ticket. A server can run on a shared machine that many people connect to, or on your own laptop, started by the assistant itself. The second way is called **stdio**, and it is also the quickest way to try a change to a server you're writing, because nothing has to be deployed first.

## A few terms

- **MCP (Model Context Protocol)**: an open standard for connecting AI applications to tools and data. Messages are encoded as JSON-RPC [@mcp-transports].
- **Client**: the AI application, such as an editor or a command-line assistant. It decides which servers to talk to.
- **Server**: the program that offers the tools. In this primer, a server you run or are building.
- **Transport**: how the messages travel between the two. The spec defines two standard ones, stdio and Streamable HTTP [@mcp-transports].
- **Subprocess**: a program started by another program, which can then read its output and write to its input.
- **stdin, stdout, stderr**: the three text streams every process on macOS, Linux, and Windows has. A program reads **stdin** (standard input), writes results to **stdout** (standard output), and writes diagnostics to **stderr** (standard error).

## What stdio means

The examples in this primer use one made-up server called `notes-server`, a Python program that lets an assistant search a folder of notes. It lives in `/Users/example/projects/notes-server`.

With stdio, you never start `notes-server` yourself. You tell the client the command that starts it, and the client runs that command as a subprocess. From then on the client writes requests to the server's stdin and reads replies from its stdout. The server may write log lines to stderr, which the client can capture, forward, or ignore [@mcp-transports].

<div class="mcp-stdio" role="img" aria-label="Diagram of a client and a server process. Step 1: the client launches the server as a subprocess. Step 2: the client writes JSON-RPC requests to the server's stdin. Step 3: the server writes JSON-RPC replies to its stdout. Step 4: the server may write log lines to stderr. When the client closes stdin and ends the process, the server stops.">
<svg viewBox="0 0 400 190" aria-hidden="true" focusable="false">
<defs><marker id="mcp-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="mcp-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="mcp-box" x="15" y="20" width="120" height="150" rx="5"/>
<text class="mcp-name" x="75" y="42">Client</text>
<text class="mcp-small" x="75" y="56">editor or CLI</text>
<rect class="mcp-box mcp-server" x="265" y="20" width="120" height="150" rx="5"/>
<text class="mcp-name" x="325" y="42">Server process</text>
<text class="mcp-small" x="325" y="56">notes-server</text>
<line class="mcp-arrow" x1="135" y1="78" x2="265" y2="78" marker-end="url(#mcp-head)"/>
<text class="mcp-small" x="200" y="73">1 launch</text>
<line class="mcp-arrow" x1="135" y1="105" x2="265" y2="105" marker-end="url(#mcp-head)"/>
<text class="mcp-small" x="200" y="100">2 requests to stdin</text>
<line class="mcp-arrow" x1="265" y1="130" x2="135" y2="130" marker-end="url(#mcp-head)"/>
<text class="mcp-small" x="200" y="125">3 replies on stdout</text>
<line class="mcp-arrow mcp-dashed" x1="265" y1="155" x2="135" y2="155" marker-end="url(#mcp-head)"/>
<text class="mcp-small" x="200" y="150">4 logs on stderr</text>
</svg>
<p class="bitgrid-caption">Replies and logs travel on separate streams. Only valid MCP messages may go on stdout.</p>
</div>

The spec adds a few rules that matter in practice [@mcp-transports]:

- Each message is one line of JSON, with no line breaks inside it.
- The server must not write anything to stdout that isn't a valid MCP message.
- The client must not write anything to the server's stdin that isn't a valid MCP message.
- Clients should support stdio whenever possible.

The first rule explains the most common stdio bug. A stray `print("starting up")` in the server lands on stdout, the client reads it as a message, and the connection fails. Logging belongs on stderr.

## Registering a server with a client

A client needs three things to start a stdio server: the **command**, its **arguments**, and any **environment variables**. The same server looks like this in a portable config file, which is the `mcpServers` format that several clients read [@vscode-mcp-servers]:

```json
{
  "mcpServers": {
    "notes-local": {
      "command": "uv",
      "args": ["run", "--directory", "/Users/example/projects/notes-server", "notes-server"],
      "env": { "NOTES_DIR": "/Users/example/notes" }
    }
  }
}
```

VS Code reads the same entry from `.vscode/mcp.json`, where the top-level key is `servers` and not `mcpServers` [@vscode-mcp-servers]. A server given as `command` and `args` runs locally, while one given as a `url` with `"type": "http"` is a remote one [@vscode-mcp-servers].

Three details in that entry prevent most "it works in my terminal but not in the client" problems:

- **Use an absolute directory.** The client's working directory is whatever it was launched from, not your project. The `--directory` flag tells `uv` where the project is. Other runners have an equivalent, or you can give the full path to the script.
- **Put secrets in `env`, or use the client's input prompts, and keep them out of the file you commit.** VS Code's docs warn against hardcoding API keys in `mcp.json` [@vscode-mcp-servers].
- **Check where the config applies.** A workspace file applies to one project, and a user-level file applies everywhere. Registering the same server in both can show every tool twice.

Many clients also have an "add server" command that writes this entry for you. VS Code's is **MCP: Add Server** [@vscode-mcp-servers].

<details class="aside">
<summary>Trust: a local server can run any code</summary>

A stdio server is a program running on your machine with your permissions. VS Code's documentation warns that local servers can run arbitrary code and asks you to add only servers from sources you trust [@vscode-mcp-servers]. That includes your own half-finished one, if it shells out or deletes files.
</details>

## The edit, restart, test loop

The client starts the server when a session begins and ends it when the session closes, so a running server never sees edits made after it started. The loop for changing a server is:

1. Edit the server's code.
2. Restart the client session, or use the client's restart command for that one server.
3. Call the changed tool from the assistant.
4. Run the project's own tests before committing.

Step 4 matters because a session with an assistant exercises one path once. A unit test exercises the tool's logic every time, without needing the client at all.

## Testing without a client

The MCP Inspector is the reference tool for poking at a server by hand. It takes the same command you would put in the config and starts the server itself [@mcp-inspector]:

```bash
npx @modelcontextprotocol/inspector uv run --directory /Users/example/projects/notes-server notes-server
```

It needs Node 22.19.0 or newer. The command opens a browser UI where you can list the server's tools, call one with arguments, and read the raw JSON-RPC exchange, which is where a stray stdout line shows up [@mcp-inspector]. The same package has a scriptable mode that lists tools and exits [@mcp-inspector]:

```bash
npx @modelcontextprotocol/inspector --cli uv run --directory /Users/example/projects/notes-server notes-server --method tools/list
```

If a tool works in the Inspector but not in the client, the problem is in the client's config. If it fails in both, the problem is in the server.

## Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Client reports a parse or connection error right after launch | Something other than MCP messages on stdout | Send logs to stderr; remove `print` calls |
| "command not found" in the client only | A graphical client has a shorter `PATH` than your terminal | Use the absolute path from `which uv` (macOS, Linux) or `Get-Command uv` (PowerShell) |
| Server starts but can't find its files | Working directory is not the project | Pass the directory flag or an absolute path |
| Every tool appears twice | Same server registered in two config files | Remove one registration |
| Edits have no effect | Server still running from before the edit | Restart the client session |
| Works locally, fails against a shared copy | Local runs use your credentials, a shared server uses its own | Test the shared deployment's permissions separately |

## Trying the HTTP transport on your own machine

Streamable HTTP runs the server as an independent process that clients connect to by URL [@mcp-transports]. To test that path locally, start the server yourself and register `http://localhost:8000/mcp` as a `url` entry (port and path depend on the server). The spec says a server running locally should bind to `127.0.0.1` and not `0.0.0.0`, and that it must validate the `Origin` header, because otherwise a web page could reach it through DNS rebinding [@mcp-transports].

## Quick reference

| Goal | Command |
|---|---|
| Run the server by hand (it waits on stdin) | the same command the client runs, for example `uv run notes-server` |
| Register it | add `command`, `args`, `env` under `mcpServers` (or `servers` in `.vscode/mcp.json`) |
| Poke at it without a client | `npx @modelcontextprotocol/inspector <command> <args>` |
| Load an edit | restart the client session |
| Go shared | switch to the HTTP transport and a `url` entry |

**One rule to remember:** the client runs your command and talks to it over stdin and stdout, so restart the client to load edits and keep stdout for protocol messages only.
