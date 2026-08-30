---
title: "Tech Bytes: one less integration to maintain"
publish_at: 2026-09-04T13:00:00Z
sources:
  - my note on AWS's Agent Toolkit and MCP server, from "Get Started With the Agent Toolkit for AWS in the AWS CLI"
---
I've spent a chunk of the last few months writing my own MCP servers and custom skill files so the coding agents I use actually understand a particular service or workflow instead of guessing at it. It works, but it's one more thing that's mine to keep updated every time the underlying API changes or a new endpoint shows up.

Then I read that AWS shipped an actual Agent Toolkit, a curated catalog of skills for its own services plus an MCP server a coding agent can just point at, maintained by the AWS service teams themselves instead of whoever happens to be using it. My first reaction was just relief, honestly. One less integration for me to maintain, kept current by the people who actually own the thing it's describing.

I think this is a pattern worth watching for anyone building with agents right now. For a while the answer to "how does my agent understand X" was write it yourself, because nobody else had. That's starting to flip, at least for the big platforms, and I'd rather adopt something maintained upstream than keep patching my own version every time something drifts.

Kind of makes me want to go audit what else I've hand-rolled that probably has an official version by now.
