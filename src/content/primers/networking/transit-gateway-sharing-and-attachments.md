---
title: Transit gateway sharing and attachments
description: Three separate gates decide whether another AWS account's VPC joins your transit gateway and what it can reach, and why a VPN attachment skips two of them.
order: 13
only: AWS
updated: 2026-10-23
---

A team has one account that holds the company's network, called the **network account**. It owns a transit gateway, a hub that routes traffic between networks. A second account, the **spoke account**, has a VPC with the range `10.1.0.0/16`, and its owner wants that VPC on the hub, which uses `10.0.0.0/16`. Getting there takes three separate yes answers, and each one is controlled by a different setting. Mixing them up leads to two opposite mistakes: an attachment nobody can create, and an attachment anybody can create.

This builds on [AWS Resource Access Manager (RAM)](/primers/networking/aws-ram/), which covers how a share works. Here the share is only the first gate.

## A few terms

- **Transit gateway**: a hub that routes traffic between the VPCs and VPN connections attached to it [@aws-tgw-transit-gateways].
- **Attachment**: the link between one VPC (or one VPN connection) and the transit gateway.
- **Transit gateway route table**: a routing table inside the gateway. It decides where traffic arriving from an attachment goes next [@aws-tgw-transit-gateways].
- **Association and propagation**: association picks which route table an attachment's traffic is looked up in. Propagation puts the attachment's own address range into a route table, so other attachments can reach it.

## Gate 1: the share decides who may ask

The network account lends the gateway to the spoke account through a RAM resource share. After the share exists, the owner of the spoke account can attach their VPCs to the gateway [@aws-tgw-transit-gateways]. Without the share, the spoke account has no way to ask.

The share answers one question: which accounts are allowed to request an attachment. It says nothing about whether the request succeeds.

## Gate 2: auto-accept decides whether the owner must say yes

When the spoke account's owner attaches the VPC, the request lands on the network account's gateway. One setting on the gateway decides the outcome, **Auto accept shared attachments** [@aws-tgw-create].

- **Off:** the attachment waits in a pending acceptance state until the gateway owner accepts or rejects it [@aws-tgw-create, @aws-tgw-accept-shared].
- **On:** the gateway accepts cross-account attachments automatically [@aws-tgw-create].

The setting covers cross-account attachments only. It sits on the gateway, not on the share and not on any one account, so it applies to every account the share reaches. The gateway has no way to say "auto-accept account X but hold account Y".

### Why to leave it off

If the share names a whole organization or many accounts, an on switch means any of them can attach a VPC with no check by the network account. AWS Security Hub has a control for this, EC2.23, rated High severity, that fails a transit gateway with auto-accept turned on. Its reasoning: the setting accepts any cross-account request "without verifying the request or the account the attachment is originating from", and AWS recommends turning it off so only authorized requests are accepted [@aws-securityhub-ec2-controls].

The cost of leaving it off is a manual step. Someone in the network account has to accept each attachment, in the console or with the CLI [@aws-tgw-accept-shared]. For a hub that few accounts join, that step is cheap, and it is the moment to check that the requesting account and its VPC range are the ones you expect.

## Gate 3: route tables decide what it can reach

An accepted attachment reaches nothing until it is tied to a route table. Each attachment is associated with exactly one route table, and that table decides the next hop for the attachment's traffic [@aws-tgw-transit-gateways].

Two more settings on the gateway control what happens by default [@aws-tgw-create]:

- **Default route table association:** automatically associates new attachments with the gateway's default route table.
- **Default route table propagation:** automatically propagates new attachments into the default route table.

A new gateway gets a default route table that serves as both the default association table and the default propagation table, unless you choose not to create it [@aws-tgw-create]. When both defaults are on, accepting the spoke's attachment also lets it exchange routes with everything else in that table. Turning them off, and associating each attachment by hand, lets you keep groups apart. The AWS guide gives development VPCs and production VPCs on separate route tables as the example [@aws-tgw-transit-gateways].

## The three gates together

<div class="relay-path" role="img" aria-label="A request from the spoke account passes three gates on its way to the transit gateway in the network account. Gate 1, the RAM share, decides who may ask. Gate 2, auto-accept, decides whether the owner must say yes. Gate 3, the route tables, decides what the attachment can reach.">
<svg viewBox="0 0 400 200" aria-hidden="true" focusable="false">
<defs><marker id="tgw-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rp-head" d="M0,0 L8,4 L0,8 z"/></marker><marker id="tgw-head-enc" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rp-head-enc" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="rp-title" x="2" y="12">One attachment request, three gates</text>
<rect class="rp-node" x="4" y="28" width="86" height="42" rx="5"/>
<text class="rp-name" x="47" y="44">Spoke account</text>
<text class="rp-sub" x="47" y="56">VPC 10.1.0.0/16</text>
<text class="rp-sub" x="47" y="66">asks to attach</text>
<rect class="rp-node" x="310" y="128" width="86" height="42" rx="5"/>
<text class="rp-name" x="353" y="144">Network account</text>
<text class="rp-sub" x="353" y="156">transit gateway</text>
<text class="rp-sub" x="353" y="166">hub 10.0.0.0/16</text>
<rect class="rp-node" x="106" y="28" width="188" height="36" rx="5"/>
<text class="rp-name" x="200" y="43">1. RAM share</text>
<text class="rp-sub" x="200" y="56">who may ask</text>
<rect class="rp-node" x="106" y="78" width="188" height="36" rx="5"/>
<text class="rp-name" x="200" y="93">2. Auto accept shared attachments</text>
<text class="rp-sub" x="200" y="106">must the owner say yes</text>
<rect class="rp-node" x="106" y="128" width="188" height="36" rx="5"/>
<text class="rp-name" x="200" y="143">3. Route tables</text>
<text class="rp-sub" x="200" y="156">what it can reach</text>
<line class="rp-msg rp-enc" x1="90" y1="46" x2="104" y2="46" marker-end="url(#tgw-head-enc)"/>
<line class="rp-msg rp-enc" x1="200" y1="64" x2="200" y2="76" marker-end="url(#tgw-head-enc)"/>
<line class="rp-msg rp-enc" x1="200" y1="114" x2="200" y2="126" marker-end="url(#tgw-head-enc)"/>
<line class="rp-msg rp-enc" x1="294" y1="146" x2="308" y2="146" marker-end="url(#tgw-head-enc)"/>
<text class="rp-sub rp-mid" x="200" y="190">each gate is a separate setting; passing one says nothing about the next</text>
</svg>
<p class="bitgrid-caption">Legend: boxes are accounts or settings, arrows show the request moving left to right, then down through the gates. The share and the route tables are things you build. Auto-accept is a single switch on the gateway.</p>
</div>

## Who needs the share?

Everything above assumes another AWS account attaches its own VPC. A Site-to-Site VPN attachment, which links the gateway to a network outside AWS such as an office or a data centre, works differently. In the console flow, the gateway owner creates the VPN attachment and picks a transit gateway they own [@aws-tgw-create-vpn-attachment]. The attachment is made inside the owning account. The far-end device is described to AWS as a customer gateway, with its address and routing options, and needs no share [@aws-tgw-create-vpn-attachment, @aws-tgw-vpn-attachments].

The accept page covers cross-account (shared) attachments only [@aws-tgw-accept-shared]. A VPN attachment the owner made in its own account is not one, so no outside party has anything to accept. This is the reading of the pages above, not a sentence AWS states in those words.

| | Spoke account's VPC | Site-to-Site VPN to an outside network |
|---|---|---|
| Who creates the attachment | The spoke account's owner | The gateway owner, in the network account [@aws-tgw-create-vpn-attachment] |
| RAM share needed | Yes | No |
| Affected by auto-accept | Yes: waits for acceptance when off | No: not a cross-account attachment |
| Route table association and propagation | Yes | Yes: a new VPN attachment goes to the default route table too [@aws-tgw-transit-gateways] |
| What the far end sets up | Not covered by the pages cited here | A customer gateway device with a compatible configuration [@aws-tgw-vpn-attachments] |

The last gate still applies to a VPN. A static VPN also needs its static routes added to the gateway's route table first [@aws-tgw-vpn-attachments].

## The formula

**Share = who may ask. Auto-accept = whether the owner must say yes. Route tables = what it can reach.**

## Quick reference

| Gate | Where it is set | Default or typical value | Leave it as |
|---|---|---|---|
| RAM share | A resource share, in the network account | Not covered by the pages cited here | Name only the accounts that should be able to ask |
| Auto accept shared attachments | The transit gateway | An option when creating the gateway [@aws-tgw-create] | Off, so each attachment waits for the owner [@aws-securityhub-ec2-controls] |
| Default route table association | The transit gateway | An option when creating the gateway [@aws-tgw-create] | Your call: on for one flat network, off to place each attachment by hand |
| Default route table propagation | The transit gateway | An option when creating the gateway [@aws-tgw-create] | Your call: same trade-off as association |
| Which route table an attachment uses | The attachment (one table each) [@aws-tgw-transit-gateways] | The default route table | A separate table per group you want kept apart |

## What this costs

- **Leaving auto-accept off adds a manual step** for every cross-account attachment. A forgotten pending request leaves the spoke account waiting.
- **Segmented route tables add bookkeeping.** Each new attachment needs an association and any propagation you want, instead of the defaults handling it.
- **Either account can delete an attachment at any time** [@aws-tgw-transit-gateways]. Accepting one doesn't lock the spoke account in, and it doesn't lock the owner out of removing it.
- **Not verified:** the exact name of the pending state in the API, and whether the setting can be changed on an existing gateway beyond the Security Hub remediation pointing to "modify a transit gateway". Check the Modify page before relying on either.
