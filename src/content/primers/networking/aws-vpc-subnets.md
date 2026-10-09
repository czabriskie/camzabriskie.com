---
title: AWS VPCs, subnets, and routing
description: How a VPC is carved into subnets, how route tables make a subnet public or private, how security groups and network ACLs filter traffic, and how to lay it all out.
order: 8
updated: 2026-10-08
---

Most of the subnets I deal with live in AWS, inside a VPC (Virtual Private Cloud), which is your own private network in an AWS region. AWS follows the same CIDR rules as everywhere else and adds a few of its own on top. Inside the VPC, route tables decide where traffic can go and two kinds of firewall decide what's allowed to get there.

This builds on [IP addresses and CIDR](/primers/networking/ip-addresses-and-cidr/), so if `/20` or "starts on a multiple of 16" doesn't mean anything yet, start there.

## The VPC and its subnets

- A VPC gets an IPv4 CIDR block between `/16` (65,536 addresses) and `/28` (16). `10.0.0.0/16` is the common choice, and it's the largest a single block can be [@aws-vpc-cidr-blocks].
- A subnet is a slice of the VPC's range ([what a subnet is](/primers/networking/ip-addresses-and-cidr/#subnets)), and it's where your resources actually get their addresses. Every instance, database, or load balancer is launched into a subnet and gets an address from that subnet's range. Subnets also have to be between `/16` and `/28` [@aws-vpc-subnet-sizing]. They can't overlap each other, and each one lives in exactly one availability zone (roughly, one data center in the region) [@aws-vpc-subnets].
- You can't change a subnet's CIDR after creating it [@aws-ec2-create-subnet]. If a subnet fills up, you make a new one. If the whole VPC fills up, you can add more CIDR blocks to it (up to five by default) and put new subnets in those [@aws-vpc-cidr-blocks, @aws-vpc-quotas].

Here's the whole thing at once, using the layout from [Planning a layout](#planning-a-layout) further down (two of its three zones). Each piece gets its own section below:

<div class="vpc-map" role="img" aria-label="A VPC with the range 10.0.0.0/16 and an internet gateway at its edge. It spans two availability zones. Zone a has a public subnet 10.0.0.0/24, which uses the shared public route table and holds a load balancer node and a NAT gateway, and a private subnet 10.0.16.0/20, which uses route table private-a and holds an app server and a database. Zone b has a public subnet 10.0.1.0/24, also on the public route table, with a load balancer node and a NAT gateway, and a private subnet 10.0.32.0/20 on route table private-b with an app server and a database. Each subnet sits inside its network ACL, and each resource except the NAT gateways sits inside its own security group.">
<div class="vpc-edge" aria-hidden="true"><span class="vpc-tag">VPC · <code>10.0.0.0/16</code></span><span class="vpc-igw">internet gateway <code>igw-…</code></span></div>
<div class="vpc-zones" aria-hidden="true">
<div class="vpc-zone"><span class="vpc-zone-name">Availability zone a</span>
<div class="vpc-subnet"><div class="vpc-subnet-head"><span class="vpc-tag">public · <code>10.0.0.0/24</code></span><span class="vpc-rt">route table: public</span></div><div class="vpc-res"><span class="vpc-sg">ALB node</span><span class="vpc-nosg">NAT gateway</span></div></div>
<div class="vpc-subnet"><div class="vpc-subnet-head"><span class="vpc-tag">private · <code>10.0.16.0/20</code></span><span class="vpc-rt">route table: private-a</span></div><div class="vpc-res"><span class="vpc-sg">app</span><span class="vpc-sg">database</span></div></div>
</div>
<div class="vpc-zone"><span class="vpc-zone-name">Availability zone b</span>
<div class="vpc-subnet"><div class="vpc-subnet-head"><span class="vpc-tag">public · <code>10.0.1.0/24</code></span><span class="vpc-rt">route table: public</span></div><div class="vpc-res"><span class="vpc-sg">ALB node</span><span class="vpc-nosg">NAT gateway</span></div></div>
<div class="vpc-subnet"><div class="vpc-subnet-head"><span class="vpc-tag">private · <code>10.0.32.0/20</code></span><span class="vpc-rt">route table: private-b</span></div><div class="vpc-res"><span class="vpc-sg">app</span><span class="vpc-sg">database</span></div></div>
</div>
</div>
<div class="vpc-legend" aria-hidden="true"><span><span class="vpc-key vpc-key-nacl"></span>dashed edge: the subnet's network ACL</span><span><span class="vpc-key vpc-key-sg"></span>solid ring: a security group</span><span><span class="vpc-key vpc-key-none"></span>no ring: NAT gateways can't have one</span></div>
</div>

<p class="bitgrid-caption">Both public subnets share one route table, which sends <code>0.0.0.0/0</code> to the internet gateway. Each private subnet has its own, sending <code>0.0.0.0/0</code> to the NAT gateway in the same zone. Network ACLs wrap whole subnets, and security groups wrap individual resources.</p>

## The five reserved addresses

AWS takes five addresses out of every subnet, the first four and the last one, instead of the usual two ([network and broadcast](/primers/networking/ip-addresses-and-cidr/#network-broadcast-and-usable-addresses)). In `10.0.1.0/24`:

| Address | Reserved for |
|---|---|
| `10.0.1.0` | the network address |
| `10.0.1.1` | the VPC router, which is the subnet's gateway to everything else |
| `10.0.1.2` | DNS (the DNS server itself sits at the VPC's base address plus two, so `10.0.0.2` in a `10.0.0.0/16` VPC; see [where Route 53 fits](/primers/networking/dns-resolution/#where-route-53-fits)) |
| `10.0.1.3` | reserved by AWS for future use |
| `10.0.1.255` | the broadcast address. VPCs don't support broadcast, but AWS reserves it anyway. |

That leaves 2<sup>(32 − n)</sup> − 5 usable addresses [@aws-vpc-subnet-sizing]: 251 in a `/24`, 59 in a `/26`, and only 11 in a `/28`, the smallest subnet AWS allows. The first address you can hand out is always the fifth one (`10.0.1.4` here).

## Route tables

Every subnet is associated with one route table [@aws-vpc-subnet-route-tables]. **The subnet the packet leaves from picks the table, and the packet's destination picks the row in it.** The matching row says where to send the packet next. A route table doesn't allow or block anything (that's the firewalls' job, further down). It only picks the next step.

### Which table, which row

Every packet carries two addresses: its **source**, where it came from, and its **destination**, where it's going. When an instance at `10.0.1.25` sends something to a server at `10.20.5.9`, the source is `10.0.1.25` and the destination is `10.20.5.9`, and both stay written on the packet the whole way.

1. **The subnet the packet leaves from picks the route table.** For an instance sending its own traffic, that's the subnet its source IP is in, so `10.0.1.25` uses the route table of the subnet that holds `10.0.1.0/24`. The source address never appears inside the table. It's already settled by which table you're looking at.
2. **The destination IP picks the row.** The VPC compares `10.20.5.9` against each row's Destination column and uses the row that matches (the most specific one, if several do).

So a route table never asks "where did this come from?" It only asks "where is this going, and which way out gets it closer?"

### Destination and target

Each route is one row with two columns, and AWS's names for them are confusing, because in everyday English "destination" and "target" mean the same thing. In a route table they don't:

- **Destination** is a range of addresses the packet might be going to, a CIDR block, and it's compared against the packet's destination address (not its source). Read it as "if the packet is headed for an address in this range…"
- **Target** is the **next hop**: which way to send the packet next, not where it ends up. Read it as "…hand it to this." It's usually a gateway or connection out of the VPC, or `local`, which means "it's somewhere inside this VPC, deliver it directly." Most networking equipment outside AWS calls this column "next hop" or "gateway," which describes it much better.

Driving directions work the same way. If you're going to Salt Lake City, that's your destination, and the sign that says "Salt Lake City: take I-15 North" doesn't take you there. It tells you which road to get on next. When you reach the next junction, another sign tells you the next road. A route table is a set of those signs for one subnet: *for addresses in this range, take this way out*. The packet keeps its real destination the whole time, and each place it passes through looks it up in its own route table to pick the next hop. A peering connection hands the packet to the other VPC, and that VPC's route tables take it from there.

### What the targets are

These are the next hops a route can point at. Each one is a way out of the subnet, and the ID prefix tells you which kind it is when you're reading a route table in the console.

| Target | Looks like | Sends traffic to |
|---|---|---|
| Local | `local` | Other addresses in the same VPC |
| Internet gateway | `igw-…` | The public internet (the resource also needs a public IP) |
| NAT gateway | `nat-…` | The internet, outbound only (see [below](#public-and-private-subnets)) |
| Peering connection | `pcx-…` | One other VPC |
| Transit gateway | `tgw-…` | A hub connecting many VPCs and VPNs |
| Virtual private gateway | `vgw-…` | A site-to-site VPN to an office or data center |
| Gateway VPC endpoint | `vpce-…` | S3 or DynamoDB, without going out to the internet |

AWS's routing options page shows an example route for each [@aws-vpc-routing-options].

Here's a route table for a subnet in a VPC that uses `10.0.0.0/16`, is peered with another VPC that uses `10.20.0.0/16`, and has an internet gateway:

| Destination (where it's headed) | Target (next hop) | Read it as |
|---|---|---|
| `10.0.0.0/16` | `local` | Headed anywhere in this VPC? Deliver it inside the VPC. |
| `10.20.0.0/16` | `pcx-…` (a peering connection) | Headed for the other VPC's range? Hand it to the peering connection. |
| `0.0.0.0/0` | `igw-…` (an internet gateway) | Headed anywhere else? Hand it to the internet gateway. |

`0.0.0.0/0` matches every IPv4 address there is, because a `/0` [locks none of the bits](/primers/networking/ip-addresses-and-cidr/#what-the-n-means). It's called the **default route**, the place traffic goes when nothing more specific applies.

### When more than one route matches

Since `0.0.0.0/0` matches everything, almost every packet matches at least two routes: the default route and something more specific. The route table needs a rule for picking one, and the rule is that **the route with the longest prefix wins**, meaning the biggest number after the slash. AWS calls this longest prefix match [@aws-vpc-route-priority].

A bigger number after the slash means a [smaller, more specific range](/primers/networking/ip-addresses-and-cidr/#the-one-formula). `/0` is every address, `/16` is 65,536 of them, `/24` is 256, and `/32` is exactly one. So the rule amounts to this: the route that describes the destination most precisely wins.

Sorting mail works the same way. Say there's one bin for anything going to the US, one for anything going to Utah, and one for anything going to Salt Lake City. A letter for Salt Lake City fits in all three bins, but it goes in the Salt Lake City one, because that's the most specific. A letter for Denver only fits the US bin, so that's where it goes. Routes are the same, with CIDR ranges in place of places, and `0.0.0.0/0` as the "anywhere" bin.

Here's the table above deciding where a packet headed for `10.20.5.9` goes:

| Route | Is `10.20.5.9` in its Destination range? | Prefix length |
|---|---|---|
| `10.0.0.0/16 → local` | No. This range only covers `10.0.x.x`. | |
| `10.20.0.0/16 → pcx-…` | Yes | **16** |
| `0.0.0.0/0 → igw-…` | Yes, every address does | 0 |

Two routes match, and 16 is longer than 0, so the packet goes over the peering connection.

The order of the rows doesn't matter, only how specific each route is. (Network ACLs work the other way, checking rules in number order, which is one of the reasons the two get mixed up.) This makes it easy to have a broad default and carve out exceptions. If the table also had `10.20.8.0/24 → tgw-…`, then `10.20.8.7` would go to the transit gateway (`/24` beats `/16`), while `10.20.5.9` would still go over the peering connection, because it isn't in `10.20.8.0/24`.

### Following a packet

Here are three packets leaving an instance at `10.0.1.25` (so this subnet's route table is the one used), each headed for a different destination:

| Packet going to | Routes it matches | Winner | What happens |
|---|---|---|---|
| `10.0.2.40`, a database in another subnet of the same VPC | `10.0.0.0/16` and `0.0.0.0/0` | `local` (`/16`) | Delivered directly inside the VPC |
| `10.20.5.9`, a server in the peered VPC | `10.20.0.0/16` and `0.0.0.0/0` | `pcx-…` (`/16`) | Sent over the peering connection |
| `203.0.113.50`, a server on the internet | only `0.0.0.0/0` | `igw-…` (`/0`) | Sent out through the internet gateway |

Try any destination address against the same table:

<div class="route-lookup" data-ip="10.20.5.9" data-routes='[["10.0.0.0/16","local","delivered inside this VPC"],["10.20.0.0/16","pcx-…","sent over the peering connection"],["10.20.8.0/24","tgw-…","sent to the transit gateway"],["0.0.0.0/0","igw-…","sent out through the internet gateway"]]'></div>

(This version includes the `10.20.8.0/24` route from above, so `10.20.8.7` and `10.20.5.9` end up going different ways.)

### Which table a subnet uses

- One route table can serve many subnets, but each subnet uses exactly one at a time [@aws-vpc-subnet-route-tables]. That's why a layout usually needs only a handful of tables, not one per subnet.
- Every route table has the `local` route for the VPC's range, and it can't be deleted. That's why two subnets in the same VPC can reach each other without you adding anything, as long as the firewalls allow it.
- A subnet you don't explicitly associate with a route table uses the VPC's **main route table**, so changing the main one quietly changes every subnet still relying on it [@aws-vpc-subnets].
- A route table only decides where traffic **leaving** its subnet goes. When the database at `10.0.2.40` replies, the reply leaves the database's subnet, so the database subnet's route table decides where the reply goes. Inside one VPC the `local` route covers that. For traffic from outside the VPC, like a VPN or a peered VPC, the destination's subnet needs its own route back to wherever the request came from. A missing return route is behind a lot of "the request gets there but nothing comes back" problems, and it's step 2 of the [checklist below](#when-traffic-doesnt-get-through).

### Public and private subnets

AWS has no "public" setting on a subnet. A subnet is public or private because of its route table [@aws-vpc-subnets]:

- **Public subnet:** has a route to an internet gateway, usually `0.0.0.0/0 → igw-…`. A resource in it also needs a public IPv4 address to use that route, either one AWS assigns at launch or an **Elastic IP**, a public IPv4 address you allocate to your account and keep until you release it, so you can move it from one resource to another [@aws-ec2-elastic-ip]. With only a private address, a resource can't reach the internet even from a public subnet.
- **Private subnet:** no route to an internet gateway. To reach out (downloading packages, calling an outside API), it sends `0.0.0.0/0` to a **NAT gateway**. The NAT gateway sends the traffic out from its own public address and passes the replies back, but nothing on the internet can start a connection into the private subnet through it [@aws-vpc-nat-gateways].
- **VPN-only subnet:** has a route to a VPN connection and none to the internet.
- **Isolated subnet:** no routes outside the VPC at all, only `local`.

<div class="vpc-note">

**Public and private describe the route table, not the addresses.** Every subnet, public or private, takes its addresses from the VPC's private range, and an instance only ever knows its private address. The internet gateway translates between that and the instance's public address on the way in and out [@aws-vpc-igw]. Something is reachable from the internet only when it has a public IPv4 address, its subnet's route table sends traffic to an internet gateway, and its security group (further down) allows the traffic in [@aws-vpc-igw, @aws-vpc-security-groups].

</div>

Say an app at `10.0.16.20` in a private subnet calls a server on the internet, through a NAT gateway whose private address is `10.0.0.10` and whose Elastic IP is `203.0.113.25`. The source address changes twice on the way out [@aws-vpc-nat-gateways]:

| Hop | Source the packet carries | What happened |
|---|---|---|
| App to NAT gateway | `10.0.16.20` | The private subnet's route table sent `0.0.0.0/0` to `nat-…`. |
| NAT gateway to internet gateway | `10.0.0.10` | The NAT gateway swapped the app's address for its own private address. |
| Internet gateway to the internet | `203.0.113.25` | The internet gateway swapped the NAT gateway's private address for its Elastic IP. |
| The reply, coming back | arrives for `203.0.113.25` | The internet gateway translates it back to `10.0.0.10`, and the NAT gateway translates it back to `10.0.16.20`. |

The outside server only ever sees `203.0.113.25`. It can answer, but it can't start a connection of its own to the app, because the NAT gateway only passes back replies to connections that started inside the VPC [@aws-vpc-nat-gateways].

NAT gateways come in two kinds. The standard kind, which AWS now calls a **zonal** NAT gateway, lives in one availability zone and sits in a public subnet, so the usual setup is one per zone, with each zone's private subnets routing to the NAT gateway in the same zone. Then losing a zone only takes out that zone's internet access [@aws-vpc-nat-gateway-basics]. A **regional** NAT gateway is newer: one NAT gateway that spreads across availability zones on its own as your workloads appear in them, and doesn't need a public subnet at all [@aws-vpc-regional-nat]. Either way, NAT gateways charge for the data they process, which is why traffic to S3 usually gets its own more specific route to a gateway VPC endpoint instead of going through the NAT [@aws-vpc-routing-options].

## Security groups and network ACLs

A VPC has two layers of firewall, and they behave differently enough that mixing them up causes a lot of confusion.

**Security groups** attach to a resource's **network interface**, the virtual network card that connects it to a subnet and holds its private address [@aws-ec2-eni]. EC2 instances, load balancers, databases, and Lambda functions running in the VPC all have one.

- They're **stateful**. If a request is allowed in, the reply is allowed back out automatically, so you only write rules for whoever starts the connection [@aws-vpc-security-groups].
- They only have allow rules. Anything no rule allows is dropped.
- A new security group allows nothing in and everything out.
- A rule's source can be a CIDR range or another security group. "Allow port 5432 from the app servers' security group" keeps working as app servers come and go, with no addresses to keep up to date.

**Network ACLs** attach to a subnet, and every subnet has exactly one. **NACL** is short for **network access control list** (people usually say it like "nackle"). An access control list, or ACL, is just what it sounds like: a list of rules, each one saying a kind of traffic (a protocol, a port range, and an address range) is allowed or denied, checked in order from the top. The term comes from older routers and firewalls, and the "network" in front distinguishes AWS's subnet-level version from other ACLs in AWS, like the ones on S3 buckets.

- They're **stateless**. Every packet is checked on its own, so replies need their own rules [@aws-vpc-nacls].
- Rules are numbered and checked from the lowest number up. The first match decides, and a final `*` rule denies anything nothing else matched [@aws-vpc-custom-nacl].
- Rules can deny as well as allow, which makes NACLs useful for blocking a specific range.
- The VPC's default NACL allows everything in both directions, which is why many VPCs effectively run on security groups alone. A NACL you create yourself denies everything until you add rules [@aws-vpc-default-nacl, @aws-vpc-create-nacl].
- They only check traffic entering or leaving the subnet, not traffic between two resources inside it.

Because NACLs are stateless, the reply side catches people out. A reply goes back to whatever port the client picked for its end of the connection, called an ephemeral port, and different clients pick from different ranges. Linux usually uses 32768–61000, newer Windows uses 49152–65535, and NAT gateways, load balancers, and Lambda use 1024–65535. So a web server's subnet needs an inbound NACL rule for port 443 and an outbound rule for 1024–65535 (AWS's suggested catch-all) to let the replies out [@aws-vpc-custom-nacl].

Here's one HTTPS request from a laptop at `198.51.100.7` to a web server at `10.0.0.25`, as the web server's NACL sees it once the internet gateway has translated the server's public address to its private one:

| Packet | From | To | NACL rule it needs |
|---|---|---|---|
| Request | `198.51.100.7:51544` | `10.0.0.25:443` | Inbound: TCP 443 from `0.0.0.0/0` |
| Reply | `10.0.0.25:443` | `198.51.100.7:51544` | Outbound: TCP 1024–65535 to `0.0.0.0/0` |

Without the outbound rule, the request arrives, the server answers, and the NACL drops the answer on its way out of the subnet, so the laptop waits and eventually times out. The server's security group needs nothing extra for the reply, because it's stateful.

| | Security group | Network ACL |
|---|---|---|
| Attached to | A resource's network interface | A subnet |
| State | Stateful: replies allowed automatically | Stateless: replies need their own rules |
| Rules | Allow only | Allow and deny, checked in number order |
| Default | New groups: nothing in, everything out | Default NACL: everything allowed. New NACLs: everything denied. |
| Typical use | The main firewall for each resource | A coarse fence around a whole subnet |

Traffic coming into a subnet passes the NACL first and then the resource's security group, and it has to get through both [@aws-vpc-infrastructure-security]. Neither one filters traffic to the VPC's own DNS server (the base address plus two) or the **instance metadata service**, a service each EC2 instance can query for information about itself, like its hostname and its security groups [@aws-ec2-imds]. So you can't block those with either [@aws-vpc-nacls, @aws-vpc-security-groups].

### Which one to use

Security groups, nearly always. AWS says so directly: "in most cases, security groups can meet your needs," and NACLs are there "if you want an additional layer of security" [@aws-vpc-subnets]. AWS's comparison of the two says the same: you can secure instances with security groups alone and add NACLs as an extra layer [@aws-vpc-infrastructure-security]. Plenty of VPCs leave the default NACL, which allows everything, alone for good. In practice, NACLs get used for a few specific jobs a security group can't do:

1. **Denying something.** Security groups can only allow. If one address range is causing trouble and everything else should still get in, that takes a NACL deny rule. (For web traffic, a [WAF](/primers/networking/load-balancers-and-tls/#wafs-only-work-on-http) is usually a better place to block, since it can see the requests.)
2. **A rule for a whole subnet that no security group can override.** "The database subnets only accept traffic from the app subnets' range" is a good NACL. Even if someone attaches a wide-open security group to a database by mistake, the NACL still blocks everything else. It's a backstop, and it's often owned by a different team than the security groups are.
3. **A requirement to separate subnets at the network level,** which some compliance frameworks ask for.

NACLs make a poor main firewall. They're stateless, so you manage reply ports yourself. They only understand address ranges, so you can't say "from the app servers' security group." They allow only 20 inbound and 20 outbound rules by default, and 40 each at most, compared with 60 each per security group [@aws-vpc-quotas]. And they apply to everything in the subnet at once, so one mistake breaks every resource in it.

An apartment building is a decent comparison. The security group is the lock on each apartment's door, set up for whoever lives there. The NACL is the guard at the building's front gate with one list for everybody, which is useful for keeping certain people out of the whole building and no good for deciding who gets into apartment 4B.

| Situation | Use |
|---|---|
| App servers need to reach the database on port 5432 | Security group on the database, allowing the app servers' security group |
| People on the VPN need SSH to some instances | Security group, allowing the VPN's range on port 22 |
| One address range keeps hammering a public service | NACL deny rule on that subnet (or a WAF rule, for web traffic) |
| Database subnets should only ever hear from the app subnets | NACL on the database subnets, as a backstop under the security groups |
| Database subnets should never reach the internet | The route table: no route to an internet gateway or NAT gateway. If there's no way out, no firewall rule is needed. |

### When traffic doesn't get through

Most "can't connect" problems in a VPC come down to one of these, and the return path is the one that gets missed:

1. **A route there.** The source's subnet has a route that covers the destination.
2. **A route back.** The destination's subnet has a route back to the source. For anything coming from outside the VPC (a VPN, a peered VPC), this is a separate route you have to add, and without it the request arrives but the reply has nowhere to go.
3. **The NACLs, both ways.** On both subnets, including the rules for ephemeral ports on the reply.
4. **The security groups.** The destination's allows the source's range (or security group) on the right port. The source's allows the traffic out, which a new security group already does.
5. **Something is actually listening.** The service is running and listening on that address and port, not only on `localhost`.

Here's an app at `10.0.16.20` in zone a's private subnet opening a connection to a database at `10.0.32.15:5432` in zone b's, with each check numbered to match the list:

<div class="vpc-steps" role="img" aria-label="The request: the app at 10.0.16.20, port 51544, sends to 10.0.32.15 port 5432. It passes the app's security group outbound (check 4), the private-a network ACL outbound (check 3), the private-a route table's local route (check 1), the private-b network ACL inbound on port 5432 (check 3), the database's security group inbound on port 5432 from the app's security group (check 4), and reaches the database listening on 5432 (check 5). The reply: the database at port 5432 answers to 10.0.16.20 port 51544. Its security group lets the reply out automatically because it's stateful. It passes the private-b network ACL outbound on ports 1024 to 65535 (check 3), the private-b route table's local route (check 2), the private-a network ACL inbound on ports 1024 to 65535 (check 3), and the app's security group lets it in automatically.">
<div class="vpc-flow" aria-hidden="true"><span class="vpc-flow-name">Request · <code>10.0.16.20:51544</code> → <code>10.0.32.15:5432</code></span>
<div class="vpc-flow-steps"><span class="vpc-step"><b class="vpc-num">4</b>app's SG, out</span><span class="vpc-step"><b class="vpc-num">3</b>NACL private-a, out</span><span class="vpc-step"><b class="vpc-num">1</b>route table private-a: <code>local</code></span><span class="vpc-step"><b class="vpc-num">3</b>NACL private-b, in 5432</span><span class="vpc-step"><b class="vpc-num">4</b>database SG, in 5432 from app SG</span><span class="vpc-step"><b class="vpc-num">5</b>listening on 5432</span></div></div>
<div class="vpc-flow" aria-hidden="true"><span class="vpc-flow-name">Reply · <code>10.0.32.15:5432</code> → <code>10.0.16.20:51544</code></span>
<div class="vpc-flow-steps"><span class="vpc-step vpc-auto">database SG: stateful, allowed</span><span class="vpc-step"><b class="vpc-num">3</b>NACL private-b, out 1024–65535</span><span class="vpc-step"><b class="vpc-num">2</b>route table private-b: <code>local</code></span><span class="vpc-step"><b class="vpc-num">3</b>NACL private-a, in 1024–65535</span><span class="vpc-step vpc-auto">app's SG: stateful, allowed</span></div></div>
</div>

<p class="bitgrid-caption">The security groups only get checked once, for the request. The NACLs get checked four times, because they're stateless and the app and the database sit in different subnets. Both route lookups land on <code>local</code>, which is why traffic inside one VPC rarely has a routing problem.</p>

Checks 1 through 4 usually end in **connection timed out**, because a missing route, a NACL, or a security group drops the packet without answering, so nothing comes back at all. Check 5 usually ends in **connection refused**, because the machine got the packet and answered that nothing is listening on that port. The [OSI primer's troubleshooting section](/primers/networking/osi-model/#using-the-layers-to-troubleshoot) has more on telling the two apart.

AWS has two tools for the cases where reading the rules doesn't settle it. **Reachability Analyzer** checks the configuration between a source and a destination without sending any packets, and when the path is blocked it names the security group, NACL, route table, or load balancer that blocks it [@aws-vpc-reachability-analyzer, @aws-vpc-reachability-how]. **VPC Flow Logs** records the traffic that actually goes to and from network interfaces, with each record marked `ACCEPT` or `REJECT`, which helps when a security group turns out to be stricter than it looks [@aws-vpc-flow-logs, @aws-vpc-flow-log-records].

## Planning a layout

A common pattern is a `/16` VPC with a public subnet and a private subnet in each of three availability zones. Public subnets hold the few things that face the internet, mostly load balancers and zonal NAT gateways, so they can stay small. Private subnets hold everything else and should be much bigger:

| Subnet | CIDR | Usable |
|---|---|---|
| public, zone a | `10.0.0.0/24` | 251 |
| public, zone b | `10.0.1.0/24` | 251 |
| public, zone c | `10.0.2.0/24` | 251 |
| private, zone a | `10.0.16.0/20` | 4,091 |
| private, zone b | `10.0.32.0/20` | 4,091 |
| private, zone c | `10.0.48.0/20` | 4,091 |

Each `/20` starts on a multiple of 16 in the third octet, which is the [boundary rule](/primers/networking/ip-addresses-and-cidr/#where-blocks-can-start) from the CIDR primer. `10.0.3.0` through `10.0.15.255` and everything from `10.0.64.0` up are left empty on purpose, so new subnets have room later without any renumbering.

The route tables for this layout come to four: one public table shared by all three public subnets, with `0.0.0.0/0 → igw-…`, and one private table per zone, each sending `0.0.0.0/0` to that zone's NAT gateway. The private tables can't be shared, because each one points at a different NAT gateway.

Private subnets need room because more things use VPC addresses than you'd expect. Every EC2 instance, load balancer node, database, and Lambda network interface takes at least one. On EKS with the default networking setup, every Kubernetes pod takes its own VPC address too [@aws-eks-vpc-cni], so a cluster can run through a `/24` surprisingly quickly.

## Don't overlap with networks you'll connect to

If a VPC will ever be connected to another VPC (peering, a Transit Gateway) or to an office network over a VPN, their ranges can't overlap. A route table has no way to tell which `10.0.1.0/24` you mean, and VPC peering refuses overlapping ranges outright [@aws-vpc-peering]. Giving every VPC `10.0.0.0/16` works fine until the day two of them need to talk, so give each VPC its own range from the start, like `10.0.0.0/16`, `10.1.0.0/16`, `10.2.0.0/16`, and so on.

(The default VPC AWS creates in every region uses `172.31.0.0/16`, with a `/20` subnet in each availability zone [@aws-vpc-faq]. It's handy for experiments. Leave `172.31.0.0/16` out of the VPCs you plan yourself, so they never overlap with a default VPC you might want to connect to later.)
