---
title: Subnets in an AWS VPC
description: The rules AWS adds on top of CIDR, the five addresses it reserves in every subnet, and how to lay out a VPC so it has room to grow.
order: 2
updated: 2026-10-05
---

Most of the subnets I deal with live in AWS, inside a VPC (Virtual Private Cloud), which is your own private network in an AWS region. AWS follows the same CIDR rules as everywhere else and adds a few of its own on top. A subnet can't be resized once it exists, so most of these rules matter when you're planning, not later.

This builds on [IP addresses and CIDR](/primers/networking/ip-addresses-and-cidr/), so if `/20` or "starts on a multiple of 16" doesn't mean anything yet, start there.

## The VPC and its subnets

- A VPC gets an IPv4 CIDR block between `/16` (65,536 addresses) and `/28` (16). `10.0.0.0/16` is the common choice, and it's the largest a single block can be.
- A subnet is a slice of the VPC's range ([what a subnet is](/primers/networking/ip-addresses-and-cidr/#subnets)), and it's where your resources actually get their addresses. Every instance, database, or load balancer is launched into a subnet and gets an address from that subnet's range. Subnets also have to be between `/16` and `/28`. They can't overlap each other, and each one lives in exactly one availability zone (roughly, one data center in the region).
- You can't change a subnet's CIDR after creating it. If a subnet fills up, you make a new one. If the whole VPC fills up, you can add more CIDR blocks to it (up to five by default) and put new subnets in those.

## The five reserved addresses

AWS takes five addresses out of every subnet, the first four and the last one, instead of the usual two ([network and broadcast](/primers/networking/ip-addresses-and-cidr/#network-broadcast-and-usable-addresses)). In `10.0.1.0/24`:

| Address | Reserved for |
|---|---|
| `10.0.1.0` | the network address |
| `10.0.1.1` | the VPC router, which is the subnet's gateway to everything else |
| `10.0.1.2` | DNS (the DNS server itself sits at the VPC's base address plus two, so `10.0.0.2` in a `10.0.0.0/16` VPC) |
| `10.0.1.3` | reserved by AWS for future use |
| `10.0.1.255` | the broadcast address. VPCs don't support broadcast, but AWS reserves it anyway. |

That leaves 2<sup>(32 − n)</sup> − 5 usable addresses ([AWS's subnet sizing docs](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html) have the full list): 251 in a `/24`, 59 in a `/26`, and only 11 in a `/28`, the smallest subnet AWS allows. The first address you can hand out is always the fifth one (`10.0.1.4` here).

## Planning a layout

A common pattern is a `/16` VPC with a public subnet and a private subnet in each of three availability zones. Public subnets hold the few things that face the internet, mostly load balancers and NAT gateways, so they can stay small. Private subnets hold everything else and should be much bigger:

| Subnet | CIDR | Usable |
|---|---|---|
| public, zone a | `10.0.0.0/24` | 251 |
| public, zone b | `10.0.1.0/24` | 251 |
| public, zone c | `10.0.2.0/24` | 251 |
| private, zone a | `10.0.16.0/20` | 4,091 |
| private, zone b | `10.0.32.0/20` | 4,091 |
| private, zone c | `10.0.48.0/20` | 4,091 |

Each `/20` starts on a multiple of 16 in the third octet, which is the [boundary rule](/primers/networking/ip-addresses-and-cidr/#where-blocks-can-start) from the CIDR primer. `10.0.3.0` through `10.0.15.255` and everything from `10.0.64.0` up are left empty on purpose, so new subnets have room later without any renumbering.

Private subnets need room because more things use VPC addresses than you'd expect. Every EC2 instance, load balancer node, database, and Lambda network interface takes at least one. On EKS with the default networking setup, every Kubernetes pod takes its own VPC address too, so a cluster can run through a `/24` surprisingly quickly.

## Don't overlap with networks you'll connect to

If a VPC will ever be connected to another VPC (peering, a Transit Gateway) or to an office network over a VPN, their ranges can't overlap. A route table has no way to tell which `10.0.1.0/24` you mean. Giving every VPC `10.0.0.0/16` works fine until the day two of them need to talk, so give each VPC its own range from the start, like `10.0.0.0/16`, `10.1.0.0/16`, `10.2.0.0/16`, and so on.

(The default VPC AWS creates in every region uses `172.31.0.0/16`, with a `/20` subnet in each availability zone. It's handy for experiments. Leave `172.31.0.0/16` out of the VPCs you plan yourself, so they never overlap with a default VPC you might want to connect to later.)

