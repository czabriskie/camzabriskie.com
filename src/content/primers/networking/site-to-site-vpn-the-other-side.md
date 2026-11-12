---
title: "Site-to-site VPN: what you need from the other side"
description: The details to get from the far end's network team before building an AWS site-to-site VPN, what each one is for, and how to tell whose device and whose addresses you're being given.
order: 15
only: AWS
updated: 2026-10-27
---

A company runs its app in AWS, in two VPCs on `10.0.0.0/16` and `10.1.0.0/16`, both attached to one Transit Gateway. A partner's office needs to reach it over a site-to-site VPN, and before anyone can build it, someone on the AWS side emails the partner's network team and asks for "the details." They send back three lines:

```
Peer IP:   198.51.100.25
ASN:       65010
Subnet:    192.168.50.0/27
```

Each line goes into a different place in AWS, and each one can mean more than it looks like. This primer goes through what you need from the far end, where each answer goes, and which follow-up questions keep the build from stalling a week later.

It builds on a few other primers and doesn't repeat them: [Reaching private resources](/primers/networking/reaching-private-resources/#site-to-site-vpn) for what a site-to-site VPN and a [Transit Gateway](/primers/networking/reaching-private-resources/#transit-gateway) are, [IP addresses and CIDR](/primers/networking/ip-addresses-and-cidr/) for reading `/27`, [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/) for route tables, and [Site-to-site VPN pre-shared keys](/primers/networking/site-to-site-vpn-pre-shared-keys/) for the keys the two ends authenticate with and how to rotate them.

## A few terms

- **The other side** (or the far end): whoever runs the network at the other end of the VPN. In the running example, the partner.
- **Customer gateway**: in AWS, a record you create that describes the device at the far end of the VPN [@aws-s2s-vpn-how-it-works]. "Customer" means "not AWS's side," not a paying customer, and "gateway" here is an entry in AWS, not a box. The box itself AWS calls the **customer gateway device**.
- **Public IP address**: an address reachable from the internet, as opposed to the [private ranges](/primers/networking/ip-addresses-and-cidr/#private-ranges) inside a network. The tunnels run over the internet between two public addresses.
- **BGP** (Border Gateway Protocol): a protocol two routers use to tell each other which address ranges they can reach. Each range one router tells the other about is an **advertised route**.
- **ASN** (Autonomous System Number): a number that names one network to BGP. Covered properly [below](#asns-and-why-bgp-needs-one-on-each-side).
- **NAT** (network address translation): a device rewriting the addresses on packets as they pass through, usually so many machines can share a few addresses.
- **IKE** (Internet Key Exchange): the handshake that sets up each tunnel, in two phases. **Phase 1** sets up a protected channel between the two devices, and **phase 2** uses it to agree the keys that encrypt the actual traffic [@aws-s2s-vpn-cgw-requirements].

## The three objects {only: AWS}

AWS models a site-to-site VPN as three objects, plus the device at the far end that only the other side can configure [@aws-s2s-vpn-how-it-works]:

| Object | Which side | What it is | In the running example |
|---|---|---|---|
| Virtual private gateway *or* transit gateway | AWS | Where the VPN ends on the AWS side. A virtual private gateway attaches to one VPC. A transit gateway is a hub, and the VPN becomes one of its attachments. | The Transit Gateway both VPCs already use |
| Customer gateway | Describes the far side, lives in AWS | The far device's public IP address and, for BGP, its ASN | `198.51.100.25`, ASN `65010` |
| VPN connection | Between the two | Ties the gateway on the AWS side to the customer gateway, with two tunnels | One VPN connection, tunnels 1 and 2 |

A virtual private gateway can only be attached to one VPC at a time, and AWS points you at a transit gateway when one VPN has to reach several VPCs [@aws-s2s-vpn-quotas]. That's why the running example uses the Transit Gateway: one VPN connection reaches both VPCs.

Every VPN connection comes with two tunnels, each ending at a different AWS public address in a different Availability Zone, and the far device should bring up both [@aws-s2s-vpn-tunnels]. So the far side doesn't configure one tunnel, they configure two, each with its own AWS address and its own pre-shared key (the [keys primer](/primers/networking/site-to-site-vpn-pre-shared-keys/#one-vpn-two-tunnels-two-keys) has the table). AWS gives you a configuration file for the far device once the VPN connection exists [@aws-s2s-vpn-tunnels], so the order is: get their details, create the customer gateway and the VPN connection, then send them the file.

## Whose address is the customer gateway?

AWS asks for "the IP address of the customer gateway device's external interface," which has to be static [@aws-s2s-vpn-cgw-options]. In plain terms: the public address of whatever box ends the tunnels on their side. Two different setups both produce one public IP in an email, and they mean different things.

<div class="relay-path" role="img" aria-label="Two setups side by side. Top, the partner's own firewall ends the tunnels: the Transit Gateway, ASN 64512, has two tunnels to the partner's firewall at 198.51.100.25 with ASN 65010, which connects to the partner's hosts on 192.168.50.0/27. The customer gateway records the firewall's IP and ASN. Bottom, a cloud security service ends the tunnels: the same two tunnels go to the vendor's node at 203.0.113.40 with the vendor's ASN, and the vendor's network connects on to the partner's hosts. Here the IP and ASN in the customer gateway belong to the vendor, not the partner's office.">
<svg viewBox="0 0 400 200" aria-hidden="true" focusable="false">
<text class="rp-title" x="2" y="12">Their own firewall ends the tunnels</text>
<rect class="rp-node" x="2" y="24" width="88" height="46" rx="5"/>
<text class="rp-name" x="46" y="39">Transit Gateway</text>
<text class="rp-sub" x="46" y="51">AWS side</text>
<text class="rp-sub" x="46" y="62">ASN 64512</text>
<line class="rp-msg rp-enc" x1="90" y1="40" x2="182" y2="40"/>
<line class="rp-msg rp-enc" x1="90" y1="54" x2="182" y2="54"/>
<text class="rp-hop rp-mid rp-enc-text" x="136" y="34">two tunnels</text>
<rect class="rp-node" x="182" y="24" width="92" height="46" rx="5"/>
<text class="rp-name" x="228" y="39">Their firewall</text>
<text class="rp-sub" x="228" y="51">198.51.100.25</text>
<text class="rp-sub" x="228" y="62">ASN 65010</text>
<line class="rp-msg" x1="274" y1="47" x2="312" y2="47"/>
<rect class="rp-node" x="312" y="24" width="86" height="46" rx="5"/>
<text class="rp-name" x="355" y="43">Their hosts</text>
<text class="rp-sub" x="355" y="56">192.168.50.0/27</text>
<text class="rp-hop rp-mid" x="228" y="86">the customer gateway records this IP and ASN</text>
<text class="rp-title" x="2" y="120">A cloud security service ends them</text>
<rect class="rp-node" x="2" y="132" width="88" height="46" rx="5"/>
<text class="rp-name" x="46" y="147">Transit Gateway</text>
<text class="rp-sub" x="46" y="159">AWS side</text>
<text class="rp-sub" x="46" y="170">ASN 64512</text>
<line class="rp-msg rp-enc" x1="90" y1="148" x2="182" y2="148"/>
<line class="rp-msg rp-enc" x1="90" y1="162" x2="182" y2="162"/>
<text class="rp-hop rp-mid rp-enc-text" x="136" y="142">two tunnels</text>
<rect class="rp-node" x="182" y="132" width="92" height="46" rx="5"/>
<text class="rp-name" x="228" y="147">Vendor's node</text>
<text class="rp-sub" x="228" y="159">203.0.113.40</text>
<text class="rp-sub" x="228" y="170">vendor's ASN</text>
<line class="rp-msg" x1="274" y1="155" x2="312" y2="155"/>
<rect class="rp-node" x="312" y="132" width="86" height="46" rx="5"/>
<text class="rp-name" x="355" y="151">Their hosts</text>
<text class="rp-sub" x="355" y="164">192.168.50.0/27</text>
<text class="rp-hop rp-mid" x="228" y="194">here the IP and ASN belong to the vendor</text>
</svg>
</div>

<p class="bitgrid-caption">The AWS side looks the same in both. The difference is whose device sits at the far end of the tunnels, which decides who you're really configuring the VPN with.</p>

**Their own device.** The partner's firewall or router sits at the edge of their network with a public address, and the tunnels end on it. Their network team configures it, and the ASN is one they picked. If the firewall sits behind a NAT device, the address to record is the NAT device's public address, and UDP port 500 (plus 4500, when the NAT is in the way and the devices use NAT traversal) has to pass between the two ends [@aws-s2s-vpn-cgw-options].

**A cloud security service acting as their gateway.** Plenty of companies send their traffic through a cloud security service (a zero-trust or secure web gateway product) instead of their own firewall, and some of those services can end a site-to-site VPN for their customers on a node in the vendor's own network, sometimes called an extranet or partner-connection node. The tunnels then run from AWS to the vendor, and the vendor carries the traffic the rest of the way. The address in the email is the vendor's, and so is the ASN if they use BGP. The partner's network team may not be able to change any tunnel setting themselves. They ask the vendor, or fill in the vendor's portal, and the vendor's supported options decide what's possible.

The address alone usually doesn't tell you which one you have, so ask:

- **"What device ends the tunnels on your side, and who manages it?"** A make and model means their own device. A product name means a service.
- **"Is the IP address one of yours, or your provider's?"** Then ask whether it's dedicated to this VPN or shared with the vendor's other customers.
- **"Will it stay the same?"** The customer gateway records one static address [@aws-s2s-vpn-cgw-options]. A service that can move you to another node gives you a new address, and a new address means a new customer gateway.
- **"Who changes the settings, and how long does a change take?"** With a vendor in the middle, every change below waits on a third party.

## ASNs and why BGP needs one on each side

An **autonomous system** is a network run under one routing policy, like an ISP, a company, or AWS's VPN service. Its ASN is its name in BGP: when one router advertises a route, it says which ASNs the route has passed through, and each router uses that list to spot loops and choose between paths. A BGP session is always between two ASNs, so the far device needs one and the AWS side needs one.

Public ASNs are handed out like public IP addresses, and anyone without one uses a **private ASN**, the BGP equivalent of `10.0.0.0/8`. AWS accepts a public ASN for the customer gateway, or a private one in `64512`–`65534` or `4200000000`–`4294967294` [@aws-s2s-vpn-cgw-options]. The AWS side has its own ASN, chosen from the same private ranges, and it defaults to `64512` on both a virtual private gateway and a transit gateway [@aws-s2s-vpn-how-it-works, @aws-tgw-request-options]. A virtual private gateway's ASN can't be changed after it's created [@aws-s2s-vpn-how-it-works].

The two have to differ. If the partner also picked `64512`, every route they advertise would carry `64512` in its path, and the AWS side would read that as a loop back to itself. AWS's VPN logs have a message for exactly that: a route "DENIED due to: as-path contains our own AS" [@aws-s2s-vpn-logs]. Asking for their ASN early, and telling them yours, avoids it. If their device uses a different ASN from the one recorded in the customer gateway, the BGP session doesn't come up, and the logs say that too ("remote AS is …, expected …") [@aws-s2s-vpn-logs].

**With static routing, nobody needs an ASN.** AWS only asks for the customer gateway's ASN for dynamic routing [@aws-s2s-vpn-cgw-options]. Instead, someone types the far side's address ranges into AWS as a list of routes, and nothing tells AWS when that list stops being true.

## Static routes or BGP {only: AWS}

The AWS side has to know which address ranges are behind the VPN, and there are two ways it can find out [@aws-s2s-vpn-static-dynamic]:

- **BGP (dynamic routing).** The far device advertises its ranges over a BGP session inside each tunnel, and AWS learns them. If the partner adds a range, they advertise it and AWS picks it up.
- **Static routing.** You enter the ranges yourself. For a VPN on a transit gateway, that means static routes in the transit gateway's route table pointing at the VPN attachment, added before the VPN carries traffic [@aws-tgw-s2s-attachments].

For the running example, with static routing, the Transit Gateway's route table gets one hand-written row next to the two the VPCs propagate:

| Destination | Target | How it got there |
|---|---|---|
| `10.0.0.0/16` | the attachment for VPC A | propagated |
| `10.1.0.0/16` | the attachment for VPC B | propagated |
| `192.168.50.0/27` | the VPN attachment | static, typed in |

With BGP, the last row looks the same, but it's marked propagated, and it's there because the partner's firewall advertised it.

AWS recommends BGP when the far device supports it, because BGP's liveness checks help traffic fail over to the second tunnel when the first goes down [@aws-s2s-vpn-static-dynamic]. With BGP, a tunnel only counts as up in CloudWatch once its BGP session is established [@aws-s2s-vpn-cloudwatch].

### BGP for health, a static route for the range

The two can be combined on a transit gateway. The VPN connection uses dynamic routing, so BGP runs in both tunnels, and the transit gateway's route table also gets a static route for `192.168.50.0/27` pointing at the VPN attachment. AWS documents that a static route targeting a VPN attachment isn't filtered by the VPN even when the VPN uses BGP [@aws-tgw-s2s-attachments], and when a static route and a propagated route have the same destination, the static one wins [@aws-tgw-how-it-works]. So the partner's range is whatever the template says, while BGP still runs in the tunnels.

That gets the BGP liveness checks without letting the far side change the AWS route table by advertising something new. Whether their other advertised ranges also reach the route table depends on whether the VPN attachment propagates into it, which is a per-attachment choice [@aws-tgw-how-it-works]. On a virtual private gateway this doesn't work: a VPN connection there is either BGP or static, and choosing BGP means you can't add static routes to it [@aws-s2s-vpn-routing-options].

### The trade-offs

| | BGP learns the routes | Static routes list them |
|---|---|---|
| Who changes the route list | The far side, by advertising | Your side, by changing the template and updating the stack |
| A new range on their side | Shows up when they advertise it | Waits until someone adds the route |
| A range they stop using | Disappears when they withdraw it | Stays until someone removes it |
| Needs from the far side | A BGP-capable device and an ASN | Nothing extra |
| Tunnel health | BGP liveness checks help fail over [@aws-s2s-vpn-static-dynamic] | Up to the device's own health checks [@aws-s2s-vpn-static-dynamic] |
| Spreading traffic over several tunnels (ECMP) | Supported on a transit gateway | Not supported [@aws-s2s-vpn-quotas] |

The route limits differ by gateway, and none of these can be raised [@aws-s2s-vpn-quotas, @aws-tgw-quotas]:

| Limit | Virtual private gateway | Transit gateway |
|---|---|---|
| Routes the far device can advertise over BGP to one VPN connection | 100 | 1,000 |
| Routes one VPN connection advertises to the far device | 1,000 | 5,000 |
| Static routes for one VPN connection | 100 | not listed separately; they count toward the transit gateway's 10,000 routes across all its route tables |
| Static routes for one prefix to one attachment | | 1 |

A partner with one `/27` won't come near any of these. A partner that advertises its whole internal routing table might, and over BGP, going past the limit isn't a slow degradation: AWS logs that the maximum prefix limit was exceeded and ends the BGP session [@aws-s2s-vpn-logs]. That's one more reason to ask how many ranges they plan to send, and to prefer they send only the ones that need to reach you.

## Their address range

The `192.168.50.0/27` line is the range on their side that traffic will come from and go to. Two things need checking before it goes into any route table.

### It can't overlap anything on the AWS side

The same rule as between VPCs ([don't overlap](/primers/networking/aws-vpc-subnets/#dont-overlap-with-networks-youll-connect-to)) applies to the far side. Say the partner had sent `10.1.0.0/16`, the same range as VPC B. The Transit Gateway picks the most specific route, and for two routes with the same range, a static route beats a VPC's propagated one [@aws-tgw-how-it-works]. So a static route for `10.1.0.0/16` to the VPN would quietly send traffic meant for VPC B out to the partner instead. Inside VPC B nothing would change, because a VPC's own `local` route always wins there [@aws-tgw-how-it-works], which makes it confusing to debug: some paths reach VPC B and others go to the partner.

Check their range against every VPC on the transit gateway and every other network it already reaches, not just the VPC the partner cares about. `192.168.50.0/27` doesn't overlap `10.0.0.0/16` or `10.1.0.0/16`, so the running example is fine.

### A small range might be translated

A `/27` is [32 addresses](/primers/networking/ip-addresses-and-cidr/#the-one-formula), `192.168.50.0` to `192.168.50.31`. That might really be the subnet their hosts sit on. It might also be a range their device translates into: their hosts have whatever addresses they have internally, and the device rewrites the source address on the way into the tunnel, so everything arrives looking like it came from those 32 addresses. Companies do this to hide their internal layout, or because their real ranges overlap yours.

Both look identical from the AWS side, and they change a few things:

- **Security groups and NACLs** allow the range you see, `192.168.50.0/27`, either way.
- **Telling users apart.** If many people share a few translated addresses, an address in your logs doesn't point at one person or machine.
- **Connections you start.** If the AWS side needs to open connections *to* their hosts, not just answer them, the translation has to work in that direction too, with a fixed translated address per host.
- **It can grow.** A real subnet stays the size it is. A translated pool can be resized on their side, and then your routes and rules need updating.

So ask: **"Is `192.168.50.0/27` the real address range of the hosts, or a range your device translates to?"** and, if translated, **"Is each host mapped to a fixed address, and does it work for connections we start?"**

## Settings both ends have to agree on

The two devices have to agree on how to set up each tunnel. AWS's requirements put it plainly: "There must be complete agreement among the parameters, including encryption and authentication parameters" [@aws-s2s-vpn-cgw-requirements]. These are the settings, with what AWS allows by default [@aws-s2s-vpn-tunnel-options]:

| Setting | What it decides | AWS accepts by default |
|---|---|---|
| IKE version | Which version of the handshake | IKEv1 and IKEv2 |
| Phase 1 and phase 2 encryption | The cipher that protects the handshake channel, then the traffic | AES128, AES256, AES128-GCM-16, AES256-GCM-16 |
| Phase 1 and phase 2 integrity | The hash that checks nothing was tampered with | SHA1, SHA2-256, SHA2-384, SHA2-512 |
| Phase 1 DH groups | The Diffie-Hellman key exchange used to agree keys (the group number picks its size and kind) | 2, 14–24 |
| Phase 2 DH groups | A fresh key exchange for the traffic keys, which gives **perfect forward secrecy** (PFS): a key stolen later can't decrypt traffic recorded earlier | 2, 5, 14–24 |
| Phase 1 lifetime | How long before the handshake channel is renegotiated | 28,800 seconds (8 hours), settable from 900 |
| Phase 2 lifetime | How long before the traffic keys are renegotiated | 3,600 seconds (1 hour), settable from 900, and below the phase 1 lifetime |

AWS's DH-group requirement is listed as "Use Diffie-Hellman Perfect Forward Secrecy" [@aws-s2s-vpn-cgw-requirements], so plan on PFS being turned on at the far end.

A typical agreed set, picked from those lists, looks like this:

```
IKE version:         IKEv2
Encryption (1 & 2):  AES256-GCM-16
Integrity (1 & 2):   SHA2-384
DH group (1 & 2):    20
Lifetimes:           28800 s / 3600 s
```

The authentication method is part of the handshake too: a pre-shared key per tunnel, or a certificate [@aws-s2s-vpn-cgw-requirements]. The [keys primer](/primers/networking/site-to-site-vpn-pre-shared-keys/) covers that half.

### Left at the defaults

Each default is a list, and the AWS end accepts anything on it. That makes the defaults likely to connect and unlikely to be what anyone chose. AWS evaluates the far side's proposals "starting with the lowest configured value" in its list, whatever order the far device proposes them in [@aws-s2s-vpn-tunnels], so with both lists left wide, a tunnel can come up on the weakest pair both ends accept, like AES128 with SHA1 and DH group 2.

You can narrow the lists per tunnel, when you create the VPN connection or later [@aws-s2s-vpn-tunnel-options, @aws-ec2-modify-vpn-tunnel-options]. Narrowing them to the agreed set means a far device configured differently fails to connect instead of quietly using something weaker. Modifying a live tunnel interrupts it for up to several minutes [@aws-s2s-vpn-modify-tunnel], so it's easier to set them before the first connection than after.

When the two ends don't agree, the tunnel just doesn't come up. AWS's tunnel logs say why, with messages like "No Proposal Match Found by AWS" when the far side proposes something AWS doesn't support, or "No proposal chosen" when the two ends' proposals don't match [@aws-s2s-vpn-logs]. AWS's troubleshooting steps check the same order: phase 1 first, then phase 2, then the tunnel, then BGP [@aws-s2s-vpn-troubleshoot-bgp]. Lifetimes are the subtle one, since a mismatch may let the tunnel come up and then drop when one side rekeys. AWS rekeys on its own configured lifetimes and warns that lifetimes different from the negotiated ones "may interrupt tunnel connectivity" [@aws-s2s-vpn-tunnel-options].

### Who starts the handshake

By default the far device has to start each tunnel by sending traffic and starting IKE. AWS can be set to start it instead, but only when the customer gateway has an IP address [@aws-s2s-vpn-how-it-works, @aws-s2s-vpn-tunnel-options]. Agree which, because two devices that both wait for the other never connect.

### When a vendor service is the gateway

Two more things to settle when the far end is a cloud security service:

- **Identity.** In the handshake, each end also names itself, and the other end checks that name. AWS describes the customer gateway by its IP address, or by a certificate instead of an address [@aws-s2s-vpn-cgw-options]. Some services identify a tunnel by a name (an FQDN, like `node1.example.com`) or by an internal address behind their own NAT. Ask what identity their node sends, and whether it can send its public IP address. A mismatch here fails the handshake even when every crypto setting matches.
- **Inspection.** A security service may filter or inspect the traffic it carries, the same way it does for the partner's web browsing. Ask whether its policies apply to traffic in this tunnel, so a blocked port turns out to be a policy on their side and not a missing security group on yours.

## What to ask for

Put together, the email to the other side asks for:

| Ask for | Why | Running example |
|---|---|---|
| The public IP address that ends the tunnels | Goes into the customer gateway | `198.51.100.25` |
| What device that is, and who manages it | Their firewall, or a vendor service, decides who can change anything | Their own firewall |
| Whether that address is static and dedicated | A changed address means a new customer gateway | Static |
| BGP with their ASN, or static routing | Decides whether the AWS side learns their ranges or lists them | BGP, ASN `65010` |
| Every address range that needs to reach you | Routes, security groups, and the overlap check | `192.168.50.0/27` |
| Whether those ranges are real or translated, and in which directions | Decides what your logs show and whether you can open connections to them | Real |
| The IKE version, encryption, integrity, DH groups, PFS, and both lifetimes | Both ends must agree, and AWS can be narrowed to match | The set above |
| Who starts the tunnels | One side has to | Their firewall |
| Who configures the far side, and when | Someone has to enter the AWS configuration file and the keys | Their network team, after you send the file |
| If it's a vendor service: the IKE identity it sends, and whether it inspects tunnel traffic | Identity mismatches fail the handshake; inspection explains blocked traffic | Doesn't apply |

And tell them yours: the AWS side's ASN (`64512` unless you picked another), your address ranges that they'll route into the tunnel, and that the tunnel addresses and keys come in the configuration file once the VPN exists.

## What's verified and what isn't

Each claim above is checked against the AWS page it cites. A few things those pages don't settle, and nothing here was tried on a real VPN:

| Claim | Status |
|---|---|
| Customer gateway private ASN ranges, and `64512` as the AWS-side default on both gateway types | Verified in the VPN user guide and EC2 API reference |
| Route limits for VPNs on virtual private gateways and transit gateways | Verified in both quota pages, which mark them not adjustable |
| A static route to a VPN attachment isn't filtered when the VPN uses BGP, and beats a propagated route for the same range | Verified in the Transit Gateway guide |
| AWS evaluates proposals from the lowest configured value, whatever order the far side sends them | Verified in the VPN user guide |
| A same-ASN setup fails with "as-path contains our own AS" | **Reasoned, not tested.** The log message is documented; that a matching ASN is what triggers it is how BGP loop detection works, not something AWS states for this case. |
| A BGP VPN with a static route still fails over between tunnels the way a plain BGP VPN does | **Unverified.** The static route points at the attachment, not a tunnel, and AWS doesn't describe this combination. |
| An FQDN identity from a vendor node fails against AWS | **Unverified.** AWS describes the customer gateway by IP address or certificate and doesn't mention name identities. |

The cheapest way to settle the last two rows is a throwaway VPN in a test account, with the far end on a small Linux instance running an IPsec daemon.

## The formula

**Their device, their numbers, their ranges, agreed crypto.** Find out whose box ends the tunnels, get its address and ASN, get every range and whether it's translated, and agree one set of IKE settings, before anything gets built.
