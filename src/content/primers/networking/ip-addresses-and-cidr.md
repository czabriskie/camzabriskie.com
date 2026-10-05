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

<div class="cidr-calc" data-ip="10.0.1.0" data-n="24"></div>

| Prefix | Free bits | Addresses | Example |
|---|---|---|---|
| `/32` | 0 | 1 | `203.0.113.4/32`, a single host, which is how a firewall rule allows exactly one IP |
| `/28` | 4 | 16 | `10.0.1.0/28` = `10.0.1.0`–`10.0.1.15` |
| `/26` | 6 | 64 | `10.0.1.0/26` = `10.0.1.0`–`10.0.1.63` |
| `/24` | 8 | 256 | `10.0.1.0/24` = `10.0.1.0`–`10.0.1.255`, the classic subnet |
| `/16` | 16 | 65,536 | a common size for a whole cloud network (VPC) |
| `/0` | 32 | about 4.3 billion | `0.0.0.0/0`, which means anywhere |

## Reading a range without binary

Each extra bit past `/24` cuts a `/24` in half again, so `/25` blocks hold 128 addresses, `/26` hold 64, `/27` hold 32, and `/28` hold 16.

### Where blocks can start

Blocks always start on a multiple of their size. The free bits are the lowest bits of the address, and the first address in a block has all of them set to 0. A number whose bottom 6 bits are all 0 is always a multiple of 2<sup>6</sup> = 64, so every `/26` starts on a multiple of 64. Inside a `/24` that gives you exactly four of them, starting at `.0`, `.64`, `.128`, and `.192`.

| Prefix | Block size | Blocks inside a `/24` start at |
|---|---|---|
| `/25` | 128 | `.0`, `.128` |
| `/26` | 64 | `.0`, `.64`, `.128`, `.192` |
| `/27` | 32 | `.0`, `.32`, `.64`, `.96`, `.128`, `.160`, `.192`, `.224` |
| `/28` | 16 | `.0`, `.16`, `.32`, and so on up to `.240` |

Splitting `10.0.1.0/24` into `/26`s gives you these four ranges, and they don't overlap or leave gaps:

| Range | First address | Last address |
|---|---|---|
| `10.0.1.0/26` | `10.0.1.0` | `10.0.1.63` |
| `10.0.1.64/26` | `10.0.1.64` | `10.0.1.127` |
| `10.0.1.128/26` | `10.0.1.128` | `10.0.1.191` |
| `10.0.1.192/26` | `10.0.1.192` | `10.0.1.255` |

### Finding the range an address belongs to

Given an address and a prefix, like `10.0.1.100/26`, you can find the whole range in four steps:

1. **Find the octet where the prefix ends.** `/26` is past 24, so it ends in the 4th octet, with 26 − 24 = 2 bits locked in that octet. Every octet before it is locked completely and stays as it is.
2. **Work out the block size in that octet.** It's 2 to the power of the free bits left in the octet: 8 − 2 = 6 free bits, so 2<sup>6</sup> = 64. (Same thing as 256 / 2<sup>locked bits</sup>.)
3. **Round that octet down to a multiple of the block size.** 100 rounds down to 64. That's where the range starts.
4. **Add the block size minus one to get the end.** 64 + 63 = 127. Any octets after this one run from 0 to 255.

So `10.0.1.100` sits in `10.0.1.64/26`, which covers `10.0.1.64` to `10.0.1.127`.

The same steps work when the prefix ends in an earlier octet. For `10.0.37.5/20`:

1. `/20` ends in the 3rd octet, with 20 − 16 = 4 bits locked there. `10.0` stays as it is.
2. 8 − 4 = 4 free bits in that octet, so the block size is 2<sup>4</sup> = 16.
3. 37 rounds down to 32.
4. 32 + 15 = 47, and the 4th octet runs the full 0 to 255.

So the range is `10.0.32.0/20`, covering `10.0.32.0` to `10.0.47.255`, which is 16 × 256 = 4,096 addresses (matches 2<sup>12</sup>).

Type in any address and prefix to check your work against the steps:

<div class="cidr-calc" data-address data-ip="10.0.1.100" data-n="26"></div>

### Checking whether an address is in a range

This comes up constantly with firewall rules: a rule allows `10.0.1.64/26`, and you want to know whether `10.0.1.130` gets through. Find the range's first and last address using the steps above (`10.0.1.64` to `10.0.1.127`) and see if the address falls between them. 130 is past 127, so it doesn't. It's in the next block over, `10.0.1.128/26`.

### When the address isn't on a boundary

You'll sometimes see something like `10.0.1.50/26`. 50 isn't a multiple of 64, so `10.0.1.50` can't be the start of a `/26`. The notation can still be correct, though. It depends on what it's describing.

**On a machine, it's normal.** Run `ip addr` on a Linux server and you'll see lines like `inet 10.0.1.50/26`. That reads as "this machine's address is `10.0.1.50`, and the subnet it's on is a `/26`." The machine uses the prefix to work out which other addresses are on its own subnet, so it can talk to them directly. Anything else goes to the router. Using the steps above, `10.0.1.50/26` belongs to `10.0.1.0/26`, so the machine treats `10.0.1.0` through `10.0.1.63` as local and sends everything else, `10.0.1.64` included, to the router. People sometimes call this interface notation: one address, plus the size of the network around it.

**In a range, it's a mistake.** Subnets, route tables, and firewall rules describe a block of addresses, and a block has to start on its boundary. Tools disagree on what to do when it doesn't:

- **Some reject it.** Python's `ipaddress` module refuses `ip_network("10.0.1.50/26")` with a "has host bits set" error. Linux won't add a route for it either ("Invalid prefix for given prefix length").
- **Some correct it without telling you.** They clear the free bits and store `10.0.1.0/26`.

Quiet correction can make a firewall rule much wider than intended. Say someone meant to allow just the one server at `10.0.1.50` and typed `/26` out of habit. The firewall stores `10.0.1.0/26`, and now 64 addresses are allowed instead of one, and the rule still looks almost right when you read it back.

So when you see an address that isn't on a boundary in a range, work out what was meant:

- **One machine:** use `/32`, as in `10.0.1.50/32`.
- **The whole subnet that machine is on:** round down with the steps above, which gives `10.0.1.0/26`.

(The calculator above shows it too: type `10.0.1.50` with `/26` and it shows `10.0.1.0/26`.)

## Network, broadcast, and usable addresses

The first address in a subnet identifies the network and the last one is the broadcast address, so neither can be given to a host. AWS reserves three more on top of that (the second through fourth addresses, for the router, DNS, and future use), which leaves 251 usable addresses in a `/24` subnet instead of 256.

## Private ranges

Three ranges are set aside for private networks and never get routed on the public internet ([RFC 1918](https://www.rfc-editor.org/rfc/rfc1918)):

- `10.0.0.0/8`
- `172.16.0.0/12` (that's `172.16.x.x` through `172.31.x.x`)
- `192.168.0.0/16`

If you see one of these on a diagram, it's traffic inside a cloud network or an office network. A single public address that a firewall allows in usually shows up as a `/32`.
