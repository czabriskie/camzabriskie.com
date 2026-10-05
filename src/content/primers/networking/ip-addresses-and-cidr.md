---
title: IP addresses and CIDR
description: An IPv4 address is one 32-bit number, and the /n in CIDR notation says how many of those bits are locked.
order: 1
updated: 2026-10-05
---

A CIDR range like `10.0.1.0/24` is a short way to write down a block of IP addresses, in this case the 256 addresses from `10.0.1.0` to `10.0.1.255`. Firewall rules, route tables, and VPN configs are all written in ranges like this, so once you can look at one and tell how big it is and where it starts and ends, most of a network diagram becomes readable.

## Bits and octets

An IPv4 address is one 32-bit number, 32 switches that are each 0 or 1. Nobody wants to read 32 binary digits, so it gets written as four groups of 8 bits (octets), each converted to decimal, which is why every part of an address falls between 0 and 255.

`10.0.1.25` is really:

```
00001010 . 00000000 . 00000001 . 00011001
   10          0           1         25
```

## IPv4 and IPv6

Everything so far has been IPv4, the version that's been around since 1981. 32 bits only gives you about 4.3 billion addresses, which is fewer than the number of devices online now, and the pool of unassigned IPv4 addresses ran out in 2011. It keeps working mostly because of private ranges (more on those below) and NAT, which lets a lot of machines share one public address.

IPv6 is the replacement. Its addresses are 128 bits instead of 32, which works out to about 3.4 × 10<sup>38</sup> addresses, so running out isn't a real concern. 128 bits is a lot to write down, so IPv6 addresses are written as eight groups of four hex digits separated by colons, with two shortcuts: leading zeros in a group can be dropped, and one run of all-zero groups can be replaced with `::`. These are the same address:

```
2001:0db8:0000:0000:0000:0000:0000:0001
2001:db8::1
```

(`2001:db8::/32` is the IPv6 range set aside for documentation, the same idea as the `192.0.2.0/24` and `203.0.113.0/24` examples on this page.)

The CIDR notation in the rest of this page works the same way for IPv6, just counting out of 128 bits instead of 32, and a typical IPv6 subnet is a `/64`. Most cloud networks still run on IPv4, often with IPv6 added alongside it (called dual-stack), so the examples here stick with IPv4.

## What the /n means

CIDR notation (`a.b.c.d/n`) is an address, a slash, and a prefix length. The prefix length says how many of the 32 bits, counting from the left, are locked in place. Those locked bits are the network part. The bits left over are the host part, and they can be anything, which is what makes it a range instead of one address.

In `10.0.1.0/24`, the first 24 bits are locked to `10.0.1` and the last 8 are free, so every address from `10.0.1.0` to `10.0.1.255` is in the range:

<div class="bitgrid" role="img" aria-label="10.0.1.0/24: 24 network bits, 8 host bits">
  <div class="octet"><div class="bits"><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">1</span><span class="n">0</span><span class="n">1</span><span class="n">0</span></div><span class="dec">10</span></div>
  <div class="octet"><div class="bits"><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span></div><span class="dec">0</span></div>
  <div class="octet"><div class="bits"><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">1</span></div><span class="dec">1</span></div>
  <div class="octet"><div class="bits"><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span></div><span class="dec">0–255</span></div>
</div>

<p class="bitgrid-caption">10.0.1.0/24. Teal bits are locked, open bits can be anything: 2<sup>8</sup> = 256 addresses.</p>

`10.0.1.0/26` locks two more bits, which spill into the last octet. Those two bits are both 0 here, so only the bottom 6 bits are free, and the range shrinks to `10.0.1.0` through `10.0.1.63`:

<div class="bitgrid" role="img" aria-label="10.0.1.0/26: 26 network bits, 6 host bits">
  <div class="octet"><div class="bits"><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">1</span><span class="n">0</span><span class="n">1</span><span class="n">0</span></div><span class="dec">10</span></div>
  <div class="octet"><div class="bits"><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span></div><span class="dec">0</span></div>
  <div class="octet"><div class="bits"><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">0</span><span class="n">1</span></div><span class="dec">1</span></div>
  <div class="octet"><div class="bits"><span class="n">0</span><span class="n">0</span><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span></div><span class="dec">0–63</span></div>
</div>

<p class="bitgrid-caption">10.0.1.0/26. Two more bits locked, six free: 2<sup>6</sup> = 64 addresses.</p>

So a bigger number after the slash means more bits locked, which means a smaller range. It works kind of like a zoom level.

## The one formula

A range with prefix length `n` has `32 − n` free bits, and each free bit doubles the count, so:

**addresses in the range = 2<sup>(32 − n)</sup>**

| Prefix | Free bits | Addresses | Example |
|---|---|---|---|
| `/32` | 0 | 1 | `203.0.113.4/32`, a single host, which is how a firewall rule allows exactly one IP |
| `/28` | 4 | 16 | `10.0.1.0/28` = `10.0.1.0`–`10.0.1.15` |
| `/26` | 6 | 64 | `10.0.1.0/26` = `10.0.1.0`–`10.0.1.63` |
| `/24` | 8 | 256 | `10.0.1.0/24` = `10.0.1.0`–`10.0.1.255`, the classic subnet |
| `/16` | 16 | 65,536 | a common size for a whole cloud network (VPC) |
| `/0` | 32 | about 4.3 billion | `0.0.0.0/0`, which means anywhere |

## Reading a range without binary

Each extra bit past `/24` cuts a `/24` in half again, so `/25` blocks hold 128 addresses, `/26` hold 64, `/27` hold 32, and `/28` hold 16. Blocks always start on a multiple of their size, which means `/26` ranges inside a `/24` start at `.0`, `.64`, `.128`, and `.192`.

To get the block size from the prefix, count how many bits are locked in the octet where the prefix ends, and divide 256 by 2 to that power. For `/26` that's 2 locked bits in the last octet, so 256 / 2<sup>2</sup> = 64. The same trick works one octet up: a `/20` locks 4 bits of the third octet, so blocks step by 16 there (`10.0.0.0/20`, `10.0.16.0/20`, `10.0.32.0/20`, and so on).

## Network, broadcast, and usable addresses

The first address in a subnet identifies the network and the last one is the broadcast address, so neither can be given to a host. AWS reserves three more on top of that (the second through fourth addresses, for the router, DNS, and future use), which leaves 251 usable addresses in a `/24` subnet instead of 256.

## Private ranges

Three ranges are set aside for private networks and never get routed on the public internet ([RFC 1918](https://www.rfc-editor.org/rfc/rfc1918)):

- `10.0.0.0/8`
- `172.16.0.0/12` (that's `172.16.x.x` through `172.31.x.x`)
- `192.168.0.0/16`

If you see one of these on a diagram, it's traffic inside a cloud network or an office network. A single public address that a firewall allows in usually shows up as a `/32`.
