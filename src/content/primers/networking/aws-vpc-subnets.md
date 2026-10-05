---
title: AWS VPCs, subnets, and routing
description: How a VPC is carved into subnets, how route tables make a subnet public or private, how security groups and network ACLs filter traffic, and how to lay it all out.
order: 2
updated: 2026-10-05
---

Most of the subnets I deal with live in AWS, inside a VPC (Virtual Private Cloud), which is your own private network in an AWS region. AWS follows the same CIDR rules as everywhere else and adds a few of its own on top. Inside the VPC, route tables decide where traffic can go and two kinds of firewall decide what's allowed to get there.

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

## Route tables

Every subnet is associated with one route table, a list of routes that decides where traffic leaving the subnet goes next. Each route is a destination range and a target:

| Destination | Target | Meaning |
|---|---|---|
| `10.0.0.0/16` | `local` | traffic for anywhere in the VPC stays in the VPC |
| `10.20.0.0/16` | a peering connection | traffic for another VPC goes over the peering link |
| `0.0.0.0/0` | an internet gateway | everything else goes to the internet |

Every route table has the `local` route for the VPC's own range, which is why two subnets in the same VPC can reach each other without you adding anything (the firewalls below still have to allow it). When more than one route matches an address, the most specific one wins. AWS calls this longest prefix match: for `10.20.5.9`, the `/16` route beats `0.0.0.0/0` because 16 locked bits says more than 0 does. It's the same CIDR reading as everywhere else, just used to pick a path.

A subnet you don't explicitly associate with a route table uses the VPC's main route table, so changing the main one quietly changes every subnet still relying on it.

### Public and private subnets

AWS has no "public" setting on a subnet. A subnet is public or private because of its route table:

- **Public subnet:** has a route to an internet gateway, usually `0.0.0.0/0 → igw-…`. A resource in it also needs a public IPv4 address (or an Elastic IP) to use that route. With only a private address, it can't reach the internet even from a public subnet.
- **Private subnet:** no route to an internet gateway. To reach out (downloading packages, calling an outside API), it sends `0.0.0.0/0` to a **NAT gateway** that sits in a public subnet. The NAT gateway sends the traffic out from its own public address and passes the replies back, but nothing on the internet can start a connection into the private subnet through it.
- **VPN-only subnet:** has a route to a VPN connection and none to the internet.
- **Isolated subnet:** no routes outside the VPC at all, only `local`.

NAT gateways live in one availability zone, so the usual setup is one per zone, with each zone's private subnets routing to the NAT gateway in the same zone. Then losing a zone only takes out that zone's internet access. NAT gateways also charge for every gigabyte that passes through them, which is why traffic to S3 usually gets its own more specific route to a gateway VPC endpoint instead of going through the NAT.

## Security groups and network ACLs

A VPC has two layers of firewall, and they behave differently enough that mixing them up causes a lot of confusion.

**Security groups** attach to a resource's network interface: an EC2 instance, a load balancer, a database, a Lambda function running in the VPC.

- They're **stateful**. If a request is allowed in, the reply is allowed back out automatically, so you only write rules for whoever starts the connection.
- They only have allow rules. Anything no rule allows is dropped.
- A new security group allows nothing in and everything out.
- A rule's source can be a CIDR range or another security group. "Allow port 5432 from the app servers' security group" keeps working as app servers come and go, with no addresses to keep up to date.

**Network ACLs** (NACLs) attach to a subnet, and every subnet has exactly one.

- They're **stateless**. Every packet is checked on its own, so replies need their own rules.
- Rules are numbered and checked from the lowest number up. The first match decides, and a final `*` rule denies anything nothing else matched.
- Rules can deny as well as allow, which makes NACLs useful for blocking a specific range.
- The VPC's default NACL allows everything in both directions, which is why many VPCs effectively run on security groups alone. A NACL you create yourself denies everything until you add rules.
- They only check traffic entering or leaving the subnet, not traffic between two resources inside it.

Because NACLs are stateless, the reply side catches people out. A reply goes back to whatever port the client picked for its end of the connection, called an ephemeral port, and different clients pick from different ranges. Linux usually uses 32768–61000, newer Windows uses 49152–65535, and NAT gateways, load balancers, and Lambda use 1024–65535. So a web server's subnet needs an inbound NACL rule for port 443 and an outbound rule for 1024–65535 (AWS's suggested catch-all) to let the replies out.

| | Security group | Network ACL |
|---|---|---|
| Attached to | A resource's network interface | A subnet |
| State | Stateful: replies allowed automatically | Stateless: replies need their own rules |
| Rules | Allow only | Allow and deny, checked in number order |
| Default | New groups: nothing in, everything out | Default NACL: everything allowed. New NACLs: everything denied. |
| Typical use | The main firewall for each resource | A coarse fence around a whole subnet |

Traffic coming into a subnet passes the NACL first and then the resource's security group, and it has to get through both. Neither one filters traffic to the VPC's own DNS server (the base address plus two) or the instance metadata service, so you can't block those with either.

### When traffic doesn't get through

Most "can't connect" problems in a VPC come down to one of these, and the return path is the one that gets missed:

1. **A route there.** The source's subnet has a route that covers the destination.
2. **A route back.** The destination's subnet has a route back to the source. For anything coming from outside the VPC (a VPN, a peered VPC), this is a separate route you have to add, and without it the request arrives but the reply has nowhere to go.
3. **The NACLs, both ways.** On both subnets, including the outbound rule for ephemeral ports.
4. **The security group on the destination.** It allows the source's range (or security group) on the right port.
5. **Something is actually listening.** The service is running and listening on that address and port, not only on `localhost`.

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

