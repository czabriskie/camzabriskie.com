# 0002. Two byte streams, numbered in binary

**Status:** Accepted
**Date:** 2026-08-18

## Context

The original camzabriskie.com had two blogs, "Tech Bytes" and "Life Bytes". The reboot
needed a content structure and a visual identity that wasn't a template default.

## Decision

Keep the two-stream split as separate content collections with identical schemas.
The "byte" identity becomes the design signature: every post gets a byte number —
its chronological position within its stream, rendered as 8 bits (post 3 = `00000011`)
in a mono badge tinted by stream color (teal = tech, ochre = life). Numbers are
derived at build time from dates, never hand-assigned.

## Consequences

- The 8-bit badge caps a stream at 255 posts before the joke breaks; acceptable, and
  post 256 rolling over to `00000000` would honestly be on-brand.
- Deleting or re-dating an old post shifts later byte numbers in that stream. Accepted:
  the number is presentation, not identity — URLs are slugs and never change.
