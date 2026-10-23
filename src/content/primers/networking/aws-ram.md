---
title: AWS Resource Access Manager (RAM)
description: How one AWS account lends a resource such as a subnet or a transit gateway to other accounts without copying it, who can use it, and the limits on what they can do.
order: 12
only: AWS
updated: 2026-10-20
---

A company with ten AWS accounts often needs the same thing in all of them: one network hub, one set of DNS rules, one certificate authority. Building ten copies means ten things to configure, patch, and keep identical. AWS Resource Access Manager (RAM) removes the copies. You create the resource once in one account and lend it to the others, and you stay the owner [@aws-ram-what-is].

This builds on [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/). Most of the examples here are networking resources, though RAM isn't limited to networking.

## A few terms

- **Account**: a container for AWS resources and bills. Companies split work across many accounts (one per team or environment) so a mistake in one can't reach the others.
- **Organization**: a group of accounts managed together through AWS Organizations. One account in it, the **management account**, controls the group. An **OU** (organizational unit) is a folder of accounts inside it.
- **Principal**: whoever is allowed to use something. In RAM that means an account, an organization, an OU, or (for some resource types) a single IAM role or user.

## The problem, with an example

Account A (the owner) has a transit gateway, a hub that routes traffic between networks. Accounts B and C each have a VPC and need to connect to it. Without RAM, they can't see A's gateway at all. With RAM, A shares the gateway with B and C, and it shows up in their consoles and API results as if it were their own [@aws-ram-what-is].

<div class="relay-path" role="img" aria-label="Two cases of lending a transit gateway. Top, same organization with sharing turned on: the owner account holds the transit gateway and shares it, and the consumer account sees the same gateway immediately, with no invitation. Bottom, an account outside the organization: the owner shares the gateway, and the consumer account can use it only after it accepts an invitation. In both cases the owner account still owns the gateway and the managed permission limits what the consumer can do with it.">
<svg viewBox="0 0 400 250" aria-hidden="true" focusable="false">
<defs><marker id="ram-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rp-head" d="M0,0 L8,4 L0,8 z"/></marker><marker id="ram-head-enc" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rp-head-enc" d="M0,0 L8,4 L0,8 z"/></marker><marker id="ram-head-warn" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rp-head-warn" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="rp-title" x="2" y="12">Same organization, sharing turned on</text>
<rect class="rp-zone rp-vpc" x="2" y="22" width="148" height="92" rx="6"/>
<text class="rp-zone-label" x="8" y="34">owner account (A)</text>
<rect class="rp-zone" x="250" y="22" width="148" height="92" rx="6"/>
<text class="rp-zone-label" x="256" y="34">consumer account (B)</text>
<rect class="rp-node" x="12" y="42" width="128" height="64" rx="5"/>
<text class="rp-name" x="76" y="60">Transit gateway</text>
<text class="rp-sub" x="76" y="74">created once</text>
<text class="rp-sub" x="76" y="86">owned here</text>
<text class="rp-sub" x="76" y="98">in a resource share</text>
<rect class="rp-node" x="260" y="42" width="128" height="64" rx="5"/>
<text class="rp-name" x="324" y="60">Transit gateway</text>
<text class="rp-sub" x="324" y="74">visible and usable</text>
<text class="rp-sub" x="324" y="86">still owned by A</text>
<text class="rp-sub" x="324" y="98">limited by the ceiling</text>
<line class="rp-msg rp-enc" x1="142" y1="76" x2="258" y2="76" marker-end="url(#ram-head-enc)"/>
<text class="rp-hop rp-mid" x="200" y="69">resource share</text>
<text class="rp-hop rp-mid rp-enc-text" x="200" y="92">no invitation</text>
<text class="rp-title" x="2" y="142">Account outside the organization</text>
<rect class="rp-zone rp-vpc" x="2" y="152" width="148" height="92" rx="6"/>
<text class="rp-zone-label" x="8" y="164">owner account (A)</text>
<rect class="rp-zone" x="250" y="152" width="148" height="92" rx="6"/>
<text class="rp-zone-label" x="256" y="164">consumer account (B)</text>
<rect class="rp-node" x="12" y="172" width="128" height="64" rx="5"/>
<text class="rp-name" x="76" y="190">Transit gateway</text>
<text class="rp-sub" x="76" y="204">created once</text>
<text class="rp-sub" x="76" y="216">owned here</text>
<text class="rp-sub" x="76" y="228">in a resource share</text>
<rect class="rp-node" x="260" y="172" width="128" height="64" rx="5"/>
<text class="rp-name" x="324" y="190">Transit gateway</text>
<text class="rp-sub" x="324" y="204">usable only after</text>
<text class="rp-sub" x="324" y="216">the invitation is</text>
<text class="rp-sub" x="324" y="228">accepted</text>
<line class="rp-msg rp-enc" x1="142" y1="196" x2="258" y2="196" marker-end="url(#ram-head-enc)"/>
<text class="rp-hop rp-mid" x="200" y="189">resource share</text>
<line class="rp-msg rp-invite" x1="258" y1="224" x2="142" y2="224" marker-end="url(#ram-head-warn)"/>
<text class="rp-hop rp-mid rp-warn-text" x="200" y="217">accept invitation</text>
</svg>
</div>

<p class="bitgrid-caption">Teal arrows are the share. Inside an organization with sharing on, access starts at once. An outside account must accept an invitation first. Either way, A keeps ownership and the managed permission caps what B can do.</p>

## The four pieces

A **resource share** is the object that does the lending. You create one by choosing four things [@aws-ram-what-is]:

| Piece | What it is | Example |
|---|---|---|
| Name and Region | A label, and the Region the share lives in | `shared-network`, `us-east-2` |
| Resources | What you're lending. You must own them. | one transit gateway, two subnets |
| Principals | Who can use them | account `B`, an OU, or the whole organization |
| Managed permission | What the principals may do with each resource type | the AWS-written permission for transit gateways |

The managed permission is a ceiling, not a grant. For a principal in a different account, it sets the maximum that roles and users there can be given. The consumer account's administrators still have to allow individual roles and users through ordinary IAM policies, and those policies can't go beyond the ceiling [@aws-ram-what-is]. AWS writes default managed permissions for the common cases, and you can write your own customer managed permission to tighten them [@aws-ram-sharing].

Sharing doesn't change the resource inside the owning account: its permissions and quotas stay as they were [@aws-ram-sharing].

## Invitations or no invitations

How a consumer gets access depends on whether the owner and consumer share an organization. Sharing with a single account by ID works with or without Organizations [@aws-ram-sharing].

| Consumer is | What happens |
|---|---|
| In the same organization, and organization sharing is on | Access starts immediately. No invitation is sent. |
| Outside the organization | Always an invitation. Access starts only after the consumer accepts it. |

Turning organization sharing on is a one-time step. It must be done from the management account, through the RAM console or `aws ram enable-sharing-with-aws-organization`, and the organization must have all features enabled [@aws-ram-sharing]:

```bash
aws ram enable-sharing-with-aws-organization
```

Use RAM's own command here. Enabling trusted access from the Organizations side instead doesn't create the service-linked role RAM needs, and organization sharing then won't work [@aws-ram-sharing].

Once it's on, you can share with the whole organization or an OU without listing account IDs. Membership is live: a new account that joins the OU gets the share automatically, and an account that leaves loses it [@aws-ram-sharing]. You can only add your own organization and its OUs as principals, never someone else's, though individual outside accounts are allowed [@aws-ram-sharing].

## What people share

Each service decides which of its resources can be shared. These are the common ones [@aws-ram-shareable]:

| Resource | Service | Why lend it |
|---|---|---|
| Transit gateways | Amazon VPC | One routing hub that many accounts' VPCs attach to |
| Subnets | Amazon VPC | Several accounts launch resources into one central VPC. Subnets can be shared only within an organization. |
| Prefix lists | Amazon VPC | One list of CIDR blocks that many accounts' security groups and route tables refer to |
| Resolver rules | Amazon Route 53 | One set of DNS forwarding rules, so each account doesn't redefine them |
| Network Firewall policies | AWS Network Firewall | One firewall policy applied by many accounts |
| Private certificate authorities | AWS Private CA | One internal CA issues certificates for many accounts |
| Capacity reservations | Amazon EC2 | Reserved compute capacity that any listed account can launch into |
| Image Builder images and recipes | EC2 Image Builder | One approved base image across the organization |
| License configurations | AWS License Manager | One pool of software licenses tracked across accounts |
| Data Catalog databases and tables | AWS Glue | Query the same data from several accounts |

The full list is long and grows over time, so check it before assuming something can't be shared. Some types also have prerequisites, and the share fails if they aren't met [@aws-ram-shareable].

## Gotchas

- **RAM is Regional.** A share lives in one Region, holds only resources from that Region, and consumers use the resource from that Region only. A few global resources are the exception, and those shares are managed from `us-east-1` [@aws-ram-what-is, @aws-ram-sharing].
- **You can share only what you own.** A resource that was shared with you can't be shared onward [@aws-ram-sharing].
- **Remove before you delete.** Before deleting a resource that's in a share, take it out of the share or delete the share first [@aws-ram-sharing].
- **Leaving the organization ends access by default.** Within an organization, a consumer that leaves loses the share, even if you shared with that account directly. Setting `RetainSharingOnAccountLeaveOrganization` to true when you create an account-level share changes that: the account then gets an invitation like an outsider and keeps access after leaving. It can only be set at creation, it doesn't apply to shares with an OU or the whole organization, and it requires `allowExternalPrincipals` to be true [@aws-ram-sharing].
- **Invitations expire.** Most expire after 12 hours. The ones for subnets, transit gateways, prefix lists, Resolver forwarding rules, capacity reservations, and a few others last seven days [@aws-ram-sharing].
- **It's free.** RAM adds no charge. The owner's service bills for the resource as usual [@aws-ram-what-is].

## Why not just attach a resource policy?

Some services let you grant another account access with a resource-based policy instead. RAM adds three things over that: you can name an organization or OU instead of listing every account ID, consumers see shared resources in their own console as if they were local, and the owner can see who has access to each resource [@aws-ram-what-is].

## The formula

**RAM = create once, lend to many.** The owner builds the resource and keeps it. A resource share names the resource, the borrowers, and a permission ceiling, and the borrowers use it as if it were theirs.
