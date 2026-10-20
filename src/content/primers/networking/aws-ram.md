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

<div class="ram-share" role="img" aria-label="An owner account on the left holds a transit gateway and a resource share. The resource share lists the transit gateway, a managed permission that acts as the ceiling on what borrowers can do, and the principals it is shared with. An arrow leads to a consumer account on the right, where the same transit gateway appears with a dashed outline, meaning it is borrowed and still owned by the owner account.">
<svg viewBox="0 0 400 190" aria-hidden="true" focusable="false">
<defs><marker id="ram-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="ram-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="ram-account" x="10" y="10" width="180" height="170" rx="6"/>
<text class="ram-label" x="20" y="26">Owner account</text>
<rect class="ram-box ram-own" x="25" y="38" width="150" height="34" rx="4"/>
<text class="ram-name" x="100" y="53">Transit gateway</text>
<text class="ram-small" x="100" y="65">created once</text>
<rect class="ram-box" x="25" y="92" width="150" height="76" rx="4"/>
<text class="ram-name" x="100" y="108">Resource share</text>
<text class="ram-small" x="100" y="122">resource: the gateway</text>
<text class="ram-small" x="100" y="135">permission: ceiling</text>
<text class="ram-small" x="100" y="148">principal: account B</text>
<line class="ram-arrow" x1="100" y1="72" x2="100" y2="90" marker-end="url(#ram-head)"/>
<line class="ram-arrow" x1="175" y1="130" x2="225" y2="130" marker-end="url(#ram-head)"/>
<text class="ram-small" x="200" y="122">lends</text>
<rect class="ram-account" x="210" y="10" width="180" height="170" rx="6"/>
<text class="ram-label" x="220" y="26">Consumer account B</text>
<rect class="ram-box ram-borrowed" x="225" y="92" width="150" height="76" rx="4"/>
<text class="ram-name" x="300" y="115">Transit gateway</text>
<text class="ram-small" x="300" y="129">visible and usable here</text>
<text class="ram-small" x="300" y="142">still owned by the owner</text>
<text class="ram-small" x="300" y="155">limited by the ceiling</text>
</svg>
<p class="bitgrid-caption">The owner creates the resource and the share. The consumer sees the resource without owning it, and can't do more with it than the permission allows.</p>
</div>

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
