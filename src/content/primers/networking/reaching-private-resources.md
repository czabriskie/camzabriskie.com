---
title: Reaching private resources
description: The ways into a private network, from connecting whole networks with VPNs and Transit Gateway to forwarding one port for an afternoon, and what to check when you're connected but still can't reach anything.
order: 6
updated: 2026-10-07
---

Databases, internal tools, and Kubernetes nodes live in private subnets on purpose, so nothing on the internet can reach them. People still need to, though, and so do other networks. The options run from permanent links between whole networks down to a tunnel to one port that lasts as long as a terminal window.

This leans on [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/), especially route tables and the [checklist for when traffic doesn't get through](/primers/networking/aws-vpc-subnets/#when-traffic-doesnt-get-through).

## The options at a glance

| Option | Connects | Good for | Setup effort (roughly) | Lasts |
|---|---|---|---|---|
| VPC peering | network ↔ network | Two or three VPCs | Low: one connection and a route on each side | Permanent |
| Transit Gateway | network ↔ network | Many VPCs, plus VPNs and Direct Connect | Medium: an attachment per network and its own route tables | Permanent |
| Site-to-site VPN | network ↔ network | An office or data center, over the internet | Medium: a VPN device at the far end and two tunnels | Permanent |
| Direct Connect | network ↔ network | An office or data center that needs steady bandwidth | High: a physical cable and a provider | Permanent |
| Client VPN | person ↔ network | People who need regular access | Medium: an endpoint, client software, and sign-in | While connected |
| Port forwarding | person ↔ one port | One person, one port, right now | Low: one command, if you already have a way in | While the terminal is open |

Each one gets a section below, in that order, and [the last section](#connected-but-cant-reach-it) covers what to check when you're connected and the database still doesn't answer.

## Connecting whole networks

These connect one network to another, so everything on one side can reach (whatever the firewalls allow on) the other side.

### VPC peering

A **peering connection** links two VPCs directly. It doesn't route anything by itself: each side adds a route for the other's range with the peering connection as the target [@aws-vpc-peering-routing]. With VPC A on `10.0.0.0/16` and VPC B on `10.1.0.0/16`, peered through a connection AWS names something like `pcx-…`:

| Route table | Destination | Target |
|---|---|---|
| VPC A's subnets | `10.0.0.0/16` | `local` |
| | `10.1.0.0/16` | `pcx-…` |
| VPC B's subnets | `10.1.0.0/16` | `local` |
| | `10.0.0.0/16` | `pcx-…` |

An instance at `10.0.1.25` in A sends a packet to `10.1.20.10` in B. A's table matches `10.1.0.0/16` and hands it to the peering connection, and in B the `local` route delivers it. The reply goes from `10.1.20.10` back to `10.0.1.25`, so B's table needs the `10.0.0.0/16` row. Without that row the request still arrives and the reply has no way back, which looks exactly like the database being down. (If [destination and target](/primers/networking/aws-vpc-subnets/#destination-and-target) are fuzzy, the VPC primer walks through them.)

Peering is simple, with two limits that shape bigger designs:

- **No overlapping ranges.** Two VPCs whose CIDR blocks overlap can't be peered at all [@aws-vpc-peering], which is why [giving every VPC its own range](/primers/networking/aws-vpc-subnets/#dont-overlap-with-networks-youll-connect-to) matters.
- **Not transitive.** If A is peered with B and B with C, A still can't reach C through B [@aws-vpc-peering]. Connecting a lot of VPCs means a peering connection for every pair, and the count grows fast: 5 VPCs need 10, and 10 VPCs need 45.

<div class="peer-mesh" role="img" aria-label="Three small diagrams. First: VPC A is peered with B, and B is peered with C, but the path from A to C through B is crossed out, because peering isn't transitive. Second: five VPCs, A through E, connected to each other directly, which takes 10 peering connections. Third: the same five VPCs each attached once to a Transit Gateway in the middle, which takes 5 attachments.">
<svg viewBox="0 0 400 190" aria-hidden="true" focusable="false">
<text class="pe-title" x="60" y="18">Not transitive</text>
<text class="pe-title" x="200" y="18">Peered in pairs</text>
<text class="pe-title" x="340" y="18">Transit Gateway</text>
<line class="pe-link" x1="60" y1="58" x2="22" y2="128"/>
<line class="pe-link" x1="60" y1="58" x2="98" y2="128"/>
<line class="pe-no" x1="22" y1="128" x2="98" y2="128"/>
<path class="pe-x" d="M54,122 L66,134 M66,122 L54,134"/>
<circle class="pe-vpc" cx="60" cy="58" r="11"/><text class="pe-name" x="60" y="61.5">B</text>
<circle class="pe-vpc" cx="22" cy="128" r="11"/><text class="pe-name" x="22" y="131.5">A</text>
<circle class="pe-vpc" cx="98" cy="128" r="11"/><text class="pe-name" x="98" y="131.5">C</text>
<text class="pe-note" x="60" y="164">A can't reach C</text>
<text class="pe-note" x="60" y="176">through B</text>
<line class="pe-link" x1="200.0" y1="53.0" x2="242.8" y2="84.1"/><line class="pe-link" x1="200.0" y1="53.0" x2="226.5" y2="134.4"/><line class="pe-link" x1="200.0" y1="53.0" x2="173.5" y2="134.4"/><line class="pe-link" x1="200.0" y1="53.0" x2="157.2" y2="84.1"/><line class="pe-link" x1="242.8" y1="84.1" x2="226.5" y2="134.4"/><line class="pe-link" x1="242.8" y1="84.1" x2="173.5" y2="134.4"/><line class="pe-link" x1="242.8" y1="84.1" x2="157.2" y2="84.1"/><line class="pe-link" x1="226.5" y1="134.4" x2="173.5" y2="134.4"/><line class="pe-link" x1="226.5" y1="134.4" x2="157.2" y2="84.1"/><line class="pe-link" x1="173.5" y1="134.4" x2="157.2" y2="84.1"/>
<circle class="pe-vpc" cx="200.0" cy="53.0" r="10"/><text class="pe-name" x="200.0" y="56.5">A</text><circle class="pe-vpc" cx="242.8" cy="84.1" r="10"/><text class="pe-name" x="242.8" y="87.6">B</text><circle class="pe-vpc" cx="226.5" cy="134.4" r="10"/><text class="pe-name" x="226.5" y="137.9">C</text><circle class="pe-vpc" cx="173.5" cy="134.4" r="10"/><text class="pe-name" x="173.5" y="137.9">D</text><circle class="pe-vpc" cx="157.2" cy="84.1" r="10"/><text class="pe-name" x="157.2" y="87.6">E</text>
<text class="pe-count" x="200" y="168">10 peering connections</text>
<line class="pe-spoke" x1="340" y1="98" x2="340.0" y2="53.0"/><line class="pe-spoke" x1="340" y1="98" x2="382.8" y2="84.1"/><line class="pe-spoke" x1="340" y1="98" x2="366.5" y2="134.4"/><line class="pe-spoke" x1="340" y1="98" x2="313.5" y2="134.4"/><line class="pe-spoke" x1="340" y1="98" x2="297.2" y2="84.1"/>
<rect class="pe-hub" x="325" y="89" width="30" height="18" rx="3"/><text class="pe-hub-name" x="340" y="101">TGW</text>
<circle class="pe-vpc" cx="340.0" cy="53.0" r="10"/><text class="pe-name" x="340.0" y="56.5">A</text><circle class="pe-vpc" cx="382.8" cy="84.1" r="10"/><text class="pe-name" x="382.8" y="87.6">B</text><circle class="pe-vpc" cx="366.5" cy="134.4" r="10"/><text class="pe-name" x="366.5" y="137.9">C</text><circle class="pe-vpc" cx="313.5" cy="134.4" r="10"/><text class="pe-name" x="313.5" y="137.9">D</text><circle class="pe-vpc" cx="297.2" cy="84.1" r="10"/><text class="pe-name" x="297.2" y="87.6">E</text>
<text class="pe-count pe-count-hub" x="340" y="168">5 attachments</text>
</svg>
</div>

<p class="bitgrid-caption">Peering only connects the two VPCs at its ends, so a full mesh needs a connection for every pair. A Transit Gateway needs one attachment per VPC.</p>

### Transit Gateway

A **Transit Gateway** is a hub that VPCs, VPNs, and Direct Connect links all attach to, so instead of wiring every pair together, each network connects once to the hub. AWS describes it as a virtual router for the region, and it has its own route tables deciding which attachments can reach which [@aws-tgw-how-it-works].

An **attachment** is one network's connection to the Transit Gateway: a VPC, a VPN connection, or a Direct Connect gateway. Packets come into the Transit Gateway from an attachment and leave through another one. For a VPC, the attachment puts a **network interface** (a virtual network card with its own private address [@aws-ec2-eni]) into one subnet in each availability zone you choose, and the Transit Gateway uses those interfaces to send traffic into and out of the VPC [@aws-tgw-how-it-works]. An **availability zone** is, roughly, one data center in the region, and [every subnet lives in exactly one](/primers/networking/aws-vpc-subnets/#the-vpc-and-its-subnets).

#### Following a packet through it

Take the same two VPCs, A on `10.0.0.0/16` and B on `10.1.0.0/16`, but attached to a Transit Gateway (`tgw-…`) instead of peered. Three route tables are involved, two in the VPCs and one in the Transit Gateway:

| Route table | Destination | Target |
|---|---|---|
| VPC A's subnets | `10.0.0.0/16` | `local` |
| | `10.1.0.0/16` | `tgw-…` |
| The Transit Gateway's | `10.0.0.0/16` | the attachment for VPC A |
| | `10.1.0.0/16` | the attachment for VPC B |
| VPC B's subnets | `10.1.0.0/16` | `local` |
| | `10.0.0.0/16` | `tgw-…` (the return route) |

The Transit Gateway's two rows usually aren't typed in by hand. Each VPC attachment **propagates** its VPC's CIDR blocks into the Transit Gateway route table, which is AWS's word for adding them automatically. The VPC route tables are different: you add the `tgw-…` routes yourself [@aws-tgw-how-it-works].

Now `10.0.1.25` in A connects to a database at `10.1.20.10` in B:

1. **In VPC A,** the subnet's route table matches `10.1.0.0/16` and hands the packet to the Transit Gateway.
2. **In the Transit Gateway,** the packet arrives from the attachment for A. The Transit Gateway looks up `10.1.20.10` in its own route table, matches `10.1.0.0/16`, and sends the packet out through the attachment for B.
3. **In VPC B,** the packet comes out of the attachment's network interface, and the `local` route delivers it to `10.1.20.10`.
4. **The reply** goes from `10.1.20.10` to `10.0.1.25`. B's subnet matches `10.0.0.0/16` and hands it to the Transit Gateway, the Transit Gateway matches `10.0.0.0/16` and sends it out through the attachment for A, and A's `local` route delivers it.

Every hop only looks at the destination address, and neither address changes along the way. Adding a third VPC means one more attachment and one more row in each VPC that should reach it, not a new connection to every other VPC.

Two details catch people out:

- **A VPC attachment needs a subnet in each availability zone.** Resources in a zone with no attachment subnet can't reach the Transit Gateway at all, even with a route to it [@aws-tgw-how-it-works, @aws-tgw-vpc-attachments].
- **Return routes live in the VPC.** Each subnet with resources that should be reachable needs a route back to the far side's range pointing at the Transit Gateway, like the last row in the table above. Without it, requests arrive and replies go nowhere [@aws-tgw-vpc-attachments].

### Site-to-site VPN

A **site-to-site VPN** is an encrypted tunnel between two whole networks, usually an office or data center and AWS. A **tunnel** is a packet wrapped inside another packet. The original packet, still addressed from one private address to another, becomes the payload of a new packet addressed between the two VPN devices, and the far device unwraps it and sends the original on. It's the same [encapsulation](/primers/networking/osi-model/#down-the-stack-encapsulation) every layer of the network already does, with a second IP header on the outside [@rfc4301].

AWS's site-to-site VPN uses **IPsec** for the tunnel [@aws-s2s-vpn-what-is]. IPsec works at the IP layer, so it encrypts every packet between the two networks whatever program sent it [@rfc4301], and any protocol can ride inside: HTTP, database connections, anything. TLS, the encryption behind HTTPS (see [the TLS handshake](/primers/networking/tls-handshake/)), works differently: it protects one application's connection, set up by that application [@rfc9846]. A site-to-site VPN protects all the traffic between two places, and TLS protects one conversation wherever it goes.

In AWS, the far end is described by a **customer gateway** (the office's VPN device), and the AWS end is a **virtual private gateway** on one VPC or a Transit Gateway. Each VPN connection comes with two tunnels that end in different availability zones, and the office device should have both up, because AWS takes one down from time to time for maintenance [@aws-s2s-vpn-what-is, @aws-s2s-vpn-resilience]. The routes for the office's ranges are either typed in as static routes or learned over BGP (Border Gateway Protocol, which lets the office device announce its ranges itself), and AWS recommends BGP when the device supports it because its checks help traffic fail over to the second tunnel [@aws-s2s-vpn-static-dynamic].

### Direct Connect

**Direct Connect** is a dedicated physical connection into AWS instead of a tunnel over the internet: a fiber-optic Ethernet cable with your router on one end and an AWS Direct Connect router on the other, at a Direct Connect location. To use one, your equipment is either in that facility already (colocated) or you reach it through a Direct Connect partner or another network provider [@aws-dx-what-is].

It costs more and takes longer to set up, and in return you get more bandwidth and much steadier latency. It isn't encrypted by default. The traffic is private, but if it needs to be encrypted you add MACsec (on supported connections) or run a site-to-site VPN over the Direct Connect link [@aws-dx-encryption-in-transit]. **MACsec** is an IEEE standard that encrypts at layer 2, one Ethernet link at a time: here, between your router and AWS's device at the Direct Connect location. It protects that cable, not the whole path end to end [@aws-dx-macsec]. Large setups often use Direct Connect as the main path with a VPN as the backup.

## Connecting people: client VPN

A **client VPN** connects one person's laptop to a network instead of connecting two networks. AWS has its own (AWS Client VPN), and plenty of teams run their own VPN server (OpenVPN, WireGuard, and so on) in a VPC instead.

Either way, the laptop gets an address from the VPN's own **client range**, a block set aside for VPN users, like `10.250.0.0/22`. It can't overlap with the networks it connects to, and AWS Client VPN requires it to be between a `/22` and a `/12` [@aws-client-vpn-rules]. In AWS Client VPN, the **endpoint** is the resource you create that every VPN session ends at [@aws-client-vpn-what-is]. Associating it with a subnet puts network interfaces for it in that subnet, with addresses from the subnet's range [@aws-client-vpn-access].

### Which source address the destination sees

A reply goes to whatever source address the packet carried when it arrived, and VPNs differ on what that address is:

<div class="vpn-path" role="img" aria-label="Two paths from a laptop to a database. Top, AWS Client VPN: the laptop at 10.250.0.7 sends through the tunnel with source 10.250.0.7. At the Client VPN endpoint's network interface, 10.0.1.25, inside VPC 10.0.0.0/16, the source is translated to 10.0.1.25, and the packet reaches the database at 10.0.20.10 port 5432 with source 10.0.1.25. The reply goes to 10.0.1.25, which the VPC's local route covers. Bottom, a self-run VPN without translation: the source stays 10.250.0.7 all the way to the database. The reply to 10.250.0.7 is dropped unless the database's subnet has a route for 10.250.0.0/22 to the VPN instance and its security group allows 10.250.0.0/22.">
<svg viewBox="0 0 400 300" aria-hidden="true" focusable="false">
<defs><marker id="vp-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="vp-head" d="M0,0 L8,4 L0,8 z"/></marker><marker id="vp-head-ok" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="vp-head-ok" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="vp-title" x="2" y="12">AWS Client VPN</text>
<rect class="vp-vpc" x="144" y="20" width="254" height="104" rx="6"/>
<text class="vp-vpc-label" x="392" y="32">VPC 10.0.0.0/16</text>
<rect class="vp-node" x="2" y="40" width="76" height="44" rx="5"/>
<text class="vp-name" x="40" y="58">Laptop</text>
<text class="vp-addr" x="40" y="72">10.250.0.7</text>
<rect class="vp-node" x="150" y="40" width="88" height="44" rx="5"/>
<text class="vp-name" x="194" y="55">VPN endpoint</text>
<text class="vp-sub" x="194" y="66">interface</text>
<text class="vp-addr" x="194" y="78">10.0.1.25</text>
<rect class="vp-node" x="306" y="40" width="88" height="44" rx="5"/>
<text class="vp-name" x="350" y="58">Database</text>
<text class="vp-addr" x="350" y="72">10.0.20.10:5432</text>
<text class="vp-sub" x="111" y="48">source</text>
<text class="vp-src" x="111" y="58">10.250.0.7</text>
<line class="vp-msg" x1="80" y1="65" x2="148" y2="65" marker-end="url(#vp-head)"/>
<text class="vp-sub" x="111" y="77">in the tunnel</text>
<text class="vp-sub" x="272" y="48">source</text>
<text class="vp-src vp-new" x="272" y="58">10.0.1.25</text>
<line class="vp-msg" x1="240" y1="65" x2="304" y2="65" marker-end="url(#vp-head)"/>
<text class="vp-sub" x="272" y="77">after NAT</text>
<path class="vp-reply vp-ok" d="M350,86 V98 H194 V88" marker-end="url(#vp-head-ok)"/>
<text class="vp-note vp-new" x="270" y="114">reply to 10.0.1.25: the local route covers it</text>
<text class="vp-title" x="2" y="162">Self-run VPN, no translation</text>
<rect class="vp-vpc" x="144" y="170" width="254" height="124" rx="6"/>
<text class="vp-vpc-label" x="392" y="182">VPC 10.0.0.0/16</text>
<rect class="vp-node" x="2" y="190" width="76" height="44" rx="5"/>
<text class="vp-name" x="40" y="208">Laptop</text>
<text class="vp-addr" x="40" y="222">10.250.0.7</text>
<rect class="vp-node" x="150" y="190" width="88" height="44" rx="5"/>
<text class="vp-name" x="194" y="208">VPN instance</text>
<text class="vp-addr" x="194" y="222">10.0.1.30</text>
<rect class="vp-node" x="306" y="190" width="88" height="44" rx="5"/>
<text class="vp-name" x="350" y="208">Database</text>
<text class="vp-addr" x="350" y="222">10.0.20.10:5432</text>
<text class="vp-sub" x="111" y="198">source</text>
<text class="vp-src" x="111" y="208">10.250.0.7</text>
<line class="vp-msg" x1="80" y1="215" x2="148" y2="215" marker-end="url(#vp-head)"/>
<text class="vp-sub" x="111" y="227">in the tunnel</text>
<text class="vp-sub" x="272" y="198">source</text>
<text class="vp-src" x="272" y="208">10.250.0.7</text>
<line class="vp-msg" x1="240" y1="215" x2="304" y2="215" marker-end="url(#vp-head)"/>
<text class="vp-sub" x="272" y="227">unchanged</text>
<path class="vp-reply vp-miss" d="M350,236 V248 H194 V238" marker-end="url(#vp-head)"/>
<text class="vp-note" x="270" y="263">reply to 10.250.0.7 is dropped unless</text>
<text class="vp-note vp-need" x="270" y="275">route 10.250.0.0/22 → VPN instance</text>
<text class="vp-note vp-need" x="270" y="287">and the SG allows 10.250.0.0/22</text>
</svg>
</div>

<p class="bitgrid-caption">The database answers whatever source address it sees. With AWS Client VPN that's an address inside the VPC, and with a VPN that passes the client address through it's an address from the client range, which the VPC knows nothing about until you add a route for it.</p>

- **AWS Client VPN translates the address.** It applies source NAT (network address translation, rewriting the packet's source address) as traffic leaves the endpoint's network interface, so the database sees `10.0.1.25`, not the laptop's `10.250.0.7` [@aws-client-vpn-access]. Inside that VPC no extra return route is needed, because the VPC's [`local` route](/primers/networking/aws-vpc-subnets/#destination-and-target) covers the interface's address. The database's security group allows the endpoint's subnet (or the endpoint's security group), not the client range. AWS Client VPN also has its own **authorization rules** (which client groups may reach which ranges) and its own route table, and both have to allow a destination before traffic even leaves the VPN [@aws-client-vpn-auth-rules, @aws-client-vpn-access].
- **Many self-run VPNs pass the client address through.** The database sees `10.250.0.7` itself. Then every subnet the client needs to reach has to have a route for `10.250.0.0/22` pointing at the VPN instance, and every security group has to allow `10.250.0.0/22`. The VPN instance also needs its **source/destination check** turned off. By default AWS checks that an instance is the source or the destination of all the traffic it handles, and a VPN server forwarding the laptop's packets is neither [@aws-ec2-eni].

That difference explains a lot of "I'm connected but can't reach anything." The right return route and security group rule depend on which address the destination actually sees, and the [last section](#connected-but-cant-reach-it) walks through a full example.

## One port, for now: port forwarding

Sometimes you only need to reach one database for an afternoon, and a VPN is more than the job needs. Port forwarding makes a port on your laptop connect through something that's already inside the network.

### Through a Kubernetes cluster

If you can already reach a Kubernetes cluster inside the VPC with `kubectl`, the cluster can act as the way in. `kubectl port-forward` can only forward to a pod, or to a pod picked by a service or deployment, not to an arbitrary host like a database [@kubectl-port-forward]. So the first step runs a tiny relay pod that forwards to the database, and the second forwards a local port to that pod:

```bash tab="macOS / Linux"
# terminal 1: a throwaway pod that relays port 5432 to the database (leave it running)
kubectl run pg-proxy --rm -i --restart=Never --image=alpine/socat -- \
  TCP-LISTEN:5432,fork,reuseaddr \
  TCP:my-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com:5432

# terminal 2, once the pod is running: connect local port 5433 to the pod's port 5432
kubectl port-forward pod/pg-proxy 5433:5432
```

```powershell tab="Windows (PowerShell)"
# window 1: a throwaway pod that relays port 5432 to the database (leave it running)
kubectl run pg-proxy --rm -i --restart=Never --image=alpine/socat -- `
  TCP-LISTEN:5432,fork,reuseaddr `
  TCP:my-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com:5432

# window 2, once the pod is running: connect local port 5433 to the pod's port 5432
kubectl port-forward pod/pg-proxy 5433:5432
```

Then the database client connects to `localhost` on port `5433`. The connection takes four hops, and only the last two happen inside the VPC:

<div class="relay-path" role="img" aria-label="The hops of a kubectl port forward. On your laptop, psql connects to localhost port 5433, where kubectl port-forward is listening. kubectl sends the traffic over its existing encrypted connection to the Kubernetes API server. The API server passes it through the node's kubelet to the pg-proxy pod, where socat listens on port 5432. Inside the VPC, socat opens a plain TCP connection to the RDS database on port 5432.">
<svg viewBox="0 0 400 186" aria-hidden="true" focusable="false">
<defs><marker id="rp-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rp-head" d="M0,0 L8,4 L0,8 z"/></marker><marker id="rp-head-enc" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rp-head-enc" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="rp-zone" x="2" y="22" width="124" height="160" rx="6"/>
<text class="rp-zone-label" x="8" y="15">your laptop</text>
<rect class="rp-zone rp-vpc" x="266" y="22" width="132" height="160" rx="6"/>
<text class="rp-zone-label rp-vpc-label" x="392" y="15">inside the VPC</text>
<rect class="rp-node" x="12" y="32" width="104" height="40" rx="5"/>
<text class="rp-name" x="64" y="49">psql</text>
<text class="rp-sub" x="64" y="63">to localhost:5433</text>
<line class="rp-msg" x1="64" y1="72" x2="64" y2="106" marker-end="url(#rp-head)"/>
<text class="rp-hop" x="70" y="93">5433</text>
<rect class="rp-node" x="12" y="108" width="104" height="50" rx="5"/>
<text class="rp-name" x="64" y="125">kubectl</text>
<text class="rp-sub" x="64" y="138">port-forward</text>
<text class="rp-sub" x="64" y="150">listens on 5433</text>
<line class="rp-msg rp-enc" x1="117" y1="133" x2="154" y2="133" marker-end="url(#rp-head-enc)"/>
<text class="rp-hop rp-enc-text" x="135" y="127">HTTPS</text>
<rect class="rp-node" x="156" y="108" width="86" height="50" rx="5"/>
<text class="rp-name" x="199" y="129">Kubernetes</text>
<text class="rp-name" x="199" y="142">API server</text>
<text class="rp-sub" x="199" y="172">kubectl's own connection</text>
<line class="rp-msg" x1="243" y1="133" x2="276" y2="133" marker-end="url(#rp-head)"/>
<rect class="rp-node" x="278" y="108" width="110" height="50" rx="5"/>
<text class="rp-name" x="333" y="125">pg-proxy pod</text>
<text class="rp-sub" x="333" y="138">socat</text>
<text class="rp-sub" x="333" y="150">listens on 5432</text>
<text class="rp-sub" x="333" y="172">via the node's kubelet</text>
<line class="rp-msg" x1="333" y1="107" x2="333" y2="74" marker-end="url(#rp-head)"/>
<text class="rp-hop" x="339" y="94">TCP 5432</text>
<rect class="rp-node" x="278" y="32" width="110" height="40" rx="5"/>
<text class="rp-name" x="333" y="49">RDS database</text>
<text class="rp-sub" x="333" y="63">my-db…:5432</text>
</svg>
</div>

<p class="bitgrid-caption">The teal hop is the encrypted connection to the API server that kubectl already uses for everything else. The database itself is only ever reached from the pod, inside the VPC.</p>

The pieces of the first command:

- **`kubectl run pg-proxy`** creates a pod named `pg-proxy` from the `alpine/socat` image [@kubectl-run].
- **`--rm`** deletes the pod after it exits. It only works when `kubectl` is attached to the pod, and `-i` attaches it [@kubectl-run].
- **`-i`** (`--stdin`) keeps the pod's input open and attaches `kubectl` to it, so the command keeps running for as long as the pod does [@kubectl-run].
- **`--restart=Never`** sets the pod's restart policy. The default is `Always`, which would start socat again if it stopped. `Never` leaves it stopped, which suits a throwaway pod [@kubectl-run].
- **`--`** ends `kubectl`'s own options. Everything after it goes to the container as arguments to its default command [@kubectl-run], and this image's default command is socat [@alpine-socat-dockerfile].
- **socat** (SOcket CAT) connects two streams of bytes, and takes two addresses [@socat-manual]:
  - `TCP-LISTEN:5432` listens on port 5432 inside the pod.
  - `fork` handles each new connection in its own child process and keeps listening, so more than one connection (and a reconnect) works [@socat-manual].
  - `reuseaddr` lets other sockets bind the same port even while socat is using parts of it. Since socat 1.8.0 it's set automatically for listening TCP addresses, so on a recent image it changes nothing and is harmless to include [@socat-manual].
  - `TCP:my-db…:5432` connects each one to the database on port 5432. The `xxxxxxxxxxxx` and `us-east-1` are placeholders for your own database's endpoint name and region, which the RDS console shows.
- **Two terminals**, because the first command stays attached to the pod and keeps running. Start the second once the pod is up (`kubectl get pod pg-proxy` shows `Running`).

And the second:

- **`kubectl port-forward pod/pg-proxy 5433:5432`** listens on local port 5433 and forwards each connection to port 5432 in the pod. The order is always local first, then the pod's [@kubectl-port-forward]. The traffic travels through the encrypted connection to the Kubernetes API that `kubectl` already has, and the API server passes it to the pod through the node's kubelet, so the database never has to be exposed anywhere [@k8s-port-forward, @k8s-control-plane-comms].
- **Local port 5433** instead of 5432, so it doesn't clash with a Postgres you might have running locally.

It only lasts as long as both commands keep running. Stop the port forward with Ctrl+C, then stop the first command, and `--rm` deletes the pod. If a pod outlives it anyway, `kubectl delete pod pg-proxy` removes it. The database's security group still has to allow traffic from the pod, which usually means allowing the cluster nodes' security group.

### Through Session Manager or SSH

The same idea works with other ways in:

- **AWS Systems Manager Session Manager** can forward a local port through an EC2 instance to another host in the VPC, with no SSH keys and no inbound ports open on the instance [@aws-ssm-session-manager, @aws-ssm-start-session]:

  ```bash tab="macOS / Linux"
  aws ssm start-session --target i-xxxxxxxxxxxxxxxxx \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters '{"host":["my-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5433"]}'
  ```

  ```powershell tab="Windows (PowerShell)"
  aws ssm start-session --target i-xxxxxxxxxxxxxxxxx `
    --document-name AWS-StartPortForwardingSessionToRemoteHost `
    --parameters 'host=my-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com,portNumber=5432,localPortNumber=5433'
  ```

  The pieces:

  - **`--target`** is the instance the session goes through, by its instance ID. `i-xxxxxxxxxxxxxxxxx` is a placeholder for yours [@aws-ssm-cli-start-session].
  - **`--document-name`** picks what kind of session to start. In Systems Manager a **document** isn't a file you pass in. It's a named, predefined set of actions that Systems Manager runs, and the ones starting with `AWS-` are written and maintained by AWS [@aws-ssm-documents]. `AWS-StartPortForwardingSessionToRemoteHost` forwards a port to some other host [@aws-ssm-start-session].
  - **`host`** is the database's name (or IP address), which the instance has to be able to resolve and reach. **`portNumber`** is the port on that host, and **`localPortNumber`** is the port on your laptop, so the database client connects to `localhost:5433` [@aws-ssm-start-session].

  A few things have to be in place first. Your laptop needs the AWS CLI and its **Session Manager plugin** installed [@aws-ssm-start-session]. The instance needs the **SSM Agent** running, recent enough to support port forwarding to a remote host [@aws-ssm-start-session], plus outbound HTTPS to the Systems Manager endpoints and permission to talk to Systems Manager, usually through an **instance profile** (the IAM role attached to the instance) with the `AmazonSSMManagedInstanceCore` policy [@aws-ssm-prerequisites, @aws-ssm-instance-permissions]. The database's security group has to allow the instance, because the instance opens the connection to it.

  The PowerShell version uses the AWS CLI's shorthand instead of JSON, because Windows PowerShell 5.1 doesn't pass double quotes inside an argument through to other programs the way PowerShell 7.3 and later do [@ms-about-parsing], and the JSON breaks without them.

- **An SSH [bastion host](/primers/networking/proxies-and-bastions/#bastion-hosts)** (a small instance whose only job is to be SSH'd into) does the same with `ssh -L 5433:<database host>:5432 user@bastion`, at the cost of keeping an SSH port open and managing keys. The bastion makes the connection to the database, so the database name is looked up and dialed from the bastion, not from your laptop [@openssh-ssh]. A private name that only resolves inside the VPC works fine.

## Connected but can't reach it

Work through the path in order, from the laptop to the resource and back. The steps marked *general* are the same checks as for any traffic in a VPC, covered in [when traffic doesn't get through](/primers/networking/aws-vpc-subnets/#when-traffic-doesnt-get-through).

1. **The VPN allows it.** For AWS Client VPN, an authorization rule covers the destination range, and the endpoint's route table has a route for it. For a self-run VPN, the laptop sends that range into the tunnel at all.
2. **A route toward it** (general). From the VPN's network to the destination, through the peering connection or Transit Gateway if it's in another VPC.
3. **The Transit Gateway path, if there is one.** The destination VPC's attachment has a subnet in the destination's availability zone, and the Transit Gateway's route tables route both directions.
4. **A route back** (general). Every subnet the destination lives in has a route for the source range (the client range or the VPN's own range, depending on the VPN) pointing back the way it came. This one is easy to miss, especially when an environment has more subnets than the ones you checked.
5. **The NACLs, both ways** (general). Including [ephemeral ports](/primers/networking/aws-vpc-subnets/#security-groups-and-network-acls) on the way back: the port the client picked for its end of the connection, which the reply is addressed to.
6. **The security group on the destination** (general). It allows the source the destination actually sees, on the right port.
7. **The name resolves to the private address.** If the hostname only resolves inside the VPC (a [private hosted zone](/primers/networking/dns-resolution/#private-hosted-zones)), the laptop needs to use the VPC's DNS over the VPN, or it'll resolve the name somewhere else or not at all.
8. **Something is listening** (general). On that address and port, not just on `localhost`.

### A worked example

A self-run VPN server runs on an instance at `10.0.1.30` in VPC A (`10.0.0.0/16`) and hands out addresses from `10.250.0.0/22` without translating them. A laptop on the VPN at `10.250.0.7` tries to reach a Postgres database at `10.1.20.10:5432` in VPC B (`10.1.0.0/16`), and both VPCs are attached to one Transit Gateway. The connection hangs. Going down the list:

| Step | What to check here | Result |
|---|---|---|
| 1. The VPN allows it | The laptop's routing table sends `10.1.0.0/16` into the tunnel. | Yes: the VPN pushes that range to clients. |
| 2. A route toward it | The VPN instance's subnet in A has `10.1.0.0/16 → tgw-…`. | Yes. |
| 3. The Transit Gateway path | Its route table has `10.1.0.0/16 →` the attachment for B (propagated), and B's attachment has a subnet in the database's availability zone. For the reply it also needs `10.250.0.0/22 →` the attachment for A. | **No.** `10.250.0.0/22` isn't one of A's CIDR blocks, so it never propagated [@aws-tgw-how-it-works]. Add it as a static route. |
| 4. A route back | The database's subnet in B has `10.250.0.0/22 → tgw-…`. In A, the attachment's subnets have `10.250.0.0/22 →` the VPN instance, and the instance's source/destination check is off [@aws-tgw-vpc-attachments, @aws-ec2-eni]. | **No** for B's subnet: it only had `10.0.0.0/16 → tgw-…`. Add the route. |
| 5. The NACLs | B's database subnet allows `5432` in from `10.250.0.0/22` and ephemeral ports out to it. | Yes: the default NACL allows everything. |
| 6. The security group | The database's security group allows `10.250.0.0/22` on `5432`. | **No:** it allowed `10.0.0.0/16`, which covers the VPN instance but not the laptop, and the database sees the laptop's address. Add the rule. |
| 7. The name | `db.internal.example.com` resolves to `10.1.20.10` on the laptop. | Yes, once the VPN hands out the VPC's DNS server. |
| 8. Something is listening | Postgres listens on `10.1.20.10:5432`. | Yes: other things in the VPC connect fine. |

Three fixes, and all three are on the way back to an address from the client range. With AWS Client VPN in the same spot, the database would see the endpoint's address in VPC A, and the existing `10.0.0.0/16` routes and security group rule would already cover the reply. The endpoint would only need a route and an authorization rule for `10.1.0.0/16`.
