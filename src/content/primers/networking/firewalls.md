---
title: Firewalls on AWS, and sharing them across accounts
description: What packet filters, stateful firewalls, and web application firewalls each look at, how security groups, network ACLs, AWS Network Firewall, and AWS WAF compare, and the ways to put one set of firewall rules in front of several AWS accounts.
order: 10
updated: 2026-10-07
---

A firewall looks at traffic and decides, rule by rule, whether to let it through. Firewalls differ mostly in how much of the traffic they read before deciding. Some only read the addresses and ports on the outside of each packet, and some read the whole web request. AWS has four of its own, reading at different depths and attached to different things, and that second part starts to matter as soon as there's more than one AWS account, because a firewall's rules live in one account.

This builds on [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/) and [Load balancers and TLS termination](/primers/networking/load-balancers-and-tls/). The cross-account patterns near the end use VPC peering and transit gateways, which [Reaching private resources](/primers/networking/reaching-private-resources/) covers.

## What a firewall decides

Every firewall has a **ruleset**: a list of rules, each one a condition and an action, usually allow or deny. Traffic arrives, the firewall compares it with the rules, and the rule that matches decides what happens to it. NIST's guide to firewalls sorts them by how much of the traffic they read [@nist-sp-800-41]:

- **Packet filters** read the outside of each packet: the source and destination IP addresses, the protocol (TCP, UDP, ICMP), and the ports. They don't look at the contents at all. Each packet is judged on its own, with no memory of the ones before it, which is why they're also called **stateless**. A router with access control lists is the classic example.
- **Stateful firewalls** read the same fields, and also keep a **state table**, a list of the connections currently open through them. A reply that belongs to a connection already in the table is let back through, and a packet claiming to be part of a connection the firewall never saw start gets dropped. In practice this means you only write rules for whoever starts a connection, and the replies take care of themselves.
- **Application firewalls** read the application protocol inside the connection, and can block based on what the program is actually doing, like an argument that's suspiciously long. A **web application firewall (WAF)** is the kind that reads HTTP, and it sits in front of web servers to stop attacks against them.

"State" here means memory of connections, nothing more. A stateless firewall isn't simpler to configure. It's usually harder, because the replies need rules of their own.

Take a browser at `203.0.113.25` asking for `https://app.example.com/login?user=admin'--`, where `app.example.com` resolves to `198.51.100.10`:

| Kind | What it sees | Can it stop this request? |
|---|---|---|
| Packet filter | TCP from `203.0.113.25` to `198.51.100.10`, port 443 | No. Someone is connecting to a web server on the usual port, which looks like any other visitor. |
| Stateful firewall | The same, plus that this is a new connection, and later that the replies belong to it | No, for the same reason. |
| WAF, after TLS is terminated | `GET /login?user=admin'--`, `Host: app.example.com`, the other headers, cookies, and any body | Yes. `'--` in a parameter is a classic sign of SQL injection. |

In SQL, `'` ends a piece of text and `--` starts a comment. If the login page pastes that username straight into a database query, the `'` closes the username early and the `--` turns the rest of the query, including the password check, into a comment. That's **SQL injection**: input written to change the database query it gets pasted into, to read or modify data the attacker shouldn't reach [@aws-waf-sqli]. The addresses and ports give no hint of it. Only something that reads the request can catch it.

### Which layer each one reads

In terms of the [OSI layers](/primers/networking/osi-model/#the-seven-layers), packet filters and stateful firewalls work at layers 3 and 4 (IP addresses, then TCP and UDP ports), and application firewalls work at layer 7. The OSI primer's [table of where things sit](/primers/networking/osi-model/#where-the-things-in-the-other-primers-sit) puts security groups and network ACLs at 3 to 4 and WAFs at 7.

Reading higher up the stack takes more than understanding the protocol. HTTPS is encrypted, so a WAF can only read a request somewhere TLS has already been [terminated](/primers/networking/load-balancers-and-tls/#terminating-tls), on a load balancer or CDN that holds the certificate. That's also why a WAF can't do anything for traffic that isn't HTTP ([more on that](/primers/networking/load-balancers-and-tls/#wafs-only-work-on-http)).

## The four AWS firewalls

### Security groups and network ACLs

These two come with every VPC, and [the VPC primer covers them](/primers/networking/aws-vpc-subnets/#security-groups-and-network-acls) in detail. In the terms above:

- A **security group** is a stateful firewall attached to a resource's network interface, with allow rules only [@aws-vpc-security-groups].
- A **network ACL** is a stateless packet filter attached to a subnet, with numbered allow and deny rules checked in order [@aws-vpc-nacls].

Neither reads anything above layer 4.

### AWS Network Firewall

**AWS Network Firewall** is a managed stateful firewall and intrusion prevention service that runs inside a VPC [@aws-nfw-what]. It doesn't attach to a resource or a subnet the way the first two do. Instead it creates **firewall endpoints** in subnets you set aside for it, and you change route tables so traffic passes through those endpoints on its way between your subnets and the outside: an internet gateway, a NAT gateway, a VPN, or another VPC [@aws-nfw-what, @aws-nfw-how]. Traffic that no route sends through an endpoint never gets inspected. The firewall's subnets shouldn't hold anything else, because an endpoint can't filter traffic going into or out of its own subnet [@aws-nfw-what].

It has two engines, and traffic goes through them in order [@aws-nfw-engines]:

1. **The stateless engine** checks each packet on its own against rules in priority order, and the first match wins. AWS compares it to network ACLs. It can drop the packet, pass it, or hand it to the stateful engine.
2. **The stateful engine** checks packets in the context of their connection, and AWS compares it to security groups, with one difference: by default it lets traffic through, where a security group blocks it. Its rules use the format of **Suricata**, an open source intrusion prevention system, so they can match on much more than addresses and ports [@aws-nfw-what].

It also understands domain names. A **domain list** rule group allows or denies traffic by hostname, like `updates.example.com`, or `.example.com` for a domain and everything under it. For HTTPS it reads the hostname from [SNI](/primers/networking/load-balancers-and-tls/#sni-many-certificates-on-one-address), which the client sends at the start of the TLS handshake before anything is encrypted, and for plain HTTP it reads the `Host` header [@aws-nfw-domain-lists]. A common use is limiting which domains the servers in a private subnet can reach [@aws-nfw-what].

So Network Firewall mostly works at layers 3 and 4 like the VPC firewalls, reaching up into layer 7 for hostnames and protocol detection. It handles any protocol (TCP, UDP, ICMP) [@aws-nfw-what], not only web traffic.

### AWS WAF

**AWS WAF** is the application firewall. Its rules live in a **web ACL** (AWS's newer console calls it a **protection pack**), and each rule inspects a part of every HTTP request: the method, a header, the cookies, the path, the query string, or the body [@aws-waf-request-components]. Rules can match the client's address or country, specific strings or patterns, the length of a request, SQL injection, cross-site scripting, and too many requests from one address in a few minutes, and you can add managed rule groups written by AWS or sold by others [@aws-waf-what]. A matching rule can allow, block, or count the request, or show a CAPTCHA [@aws-waf-what], and a blocked request gets a `403 Forbidden` by default [@aws-waf-rule-actions].

A web ACL doesn't sit in the network anywhere. You associate it with a resource that already terminates HTTPS [@aws-waf-resources]:

- **Globally:** CloudFront distributions.
- **Regionally:** Application Load Balancers, API Gateway REST APIs, AppSync GraphQL APIs, Cognito user pools, App Runner services, Verified Access instances, and a few newer services.

Network Load Balancers aren't on the list. A regional web ACL has to be in the same region as the resource it protects, and a web ACL for CloudFront is always created in US East (N. Virginia), `us-east-1`. Each resource can have only one web ACL, while one web ACL can protect many resources, though one used by a CloudFront distribution can't also be used by other kinds of resource [@aws-waf-resources].

### Side by side

| | Security group | Network ACL | AWS Network Firewall | AWS WAF |
|---|---|---|---|---|
| Looks at | Addresses, protocols, ports | Addresses, protocols, ports | Packets and connections, hostnames, Suricata rules | Whole HTTP requests: path, headers, query string, body |
| Layer | 3 to 4 | 3 to 4 | 3 to 4, some 7 | 7 |
| Where it sits | On each resource | At the edge of a subnet | In its own subnet, with traffic routed through it | On whatever terminates HTTPS |
| Attached to | Network interfaces | Subnets | Nothing; route tables send traffic to it | CloudFront, ALBs, API Gateway, and others |
| Stateful | Yes | No | Both engines, stateless first | Judges each request, with counting for rate rules |
| Typical use | The main firewall for every resource | A coarse deny or backstop for a subnet | Filtering outbound traffic by domain, inspecting traffic between VPCs and the internet | Blocking web attacks, bots, and floods of requests |

### One request through all four

Picture a web app with an ALB in public subnets, app servers in private subnets, Network Firewall endpoints between the internet gateway and the ALB's subnets, and a web ACL on the ALB. The same request from `203.0.113.25` arrives for `https://app.example.com/login?user=admin'--`:

1. **Network Firewall.** The internet gateway's route sends the traffic to a firewall endpoint first. The stateless rules pass it on to the stateful engine, which finds `app.example.com` in the SNI and on its domain allow list. Allowed. The `'--` is inside the encrypted part, so the firewall has no idea it's there.
2. **Network ACL** on the ALB's subnet. Inbound TCP 443 from anywhere is allowed. Allowed.
3. **Security group** on the ALB. Inbound 443 from anywhere is allowed, and the replies will be let out automatically. Allowed.
4. **The ALB terminates TLS** and hands the decrypted request to **AWS WAF**. A SQL injection rule inspecting the query string matches. Blocked, and the client gets a `403`.

The request never reaches an app server. Had it been an ordinary login, the ALB would have forwarded it to an app server, whose own security group allows the app's port only from the ALB's security group. Each layer stopped what it could see, and only the last one could see the attack.

## Sharing firewalls across accounts

Organizations often split AWS into several accounts, like a company that keeps production and non-production in separate accounts, or gives each team its own. Every firewall above belongs to one account. A security group belongs to a VPC, a network ACL to a subnet, a Network Firewall to a VPC, and a web ACL is associated with resources in its own account and region. Nothing in account A protects anything in account B on its own.

So "one firewall for several accounts" ends up meaning one of two different things:

1. **The same rules everywhere, managed centrally.** Every account keeps its own firewalls on its own entry points, and something central writes the rules and keeps every account in line with them.
2. **All the traffic through one account.** One account owns the firewall, and traffic for the workloads in the other accounts passes through it on the way in.

<div class="fw-diagram" role="img" aria-label="Two ways to share firewall rules across accounts. Top, same rules managed centrally: a Firewall Manager administrator account sends the same policy to account A and account B. Each account has its own load balancer with its own web ACL, and there is no network link between the accounts. Bottom, traffic through one account: traffic from the internet enters a central account, where CloudFront or a load balancer with a web ACL filters it, then goes on to app servers in account A and account B over CloudFront origins, peering, or a transit gateway.">
<svg viewBox="0 0 400 372" aria-hidden="true" focusable="false">
<defs><marker id="fw1-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="fw-head" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="fw-title" x="2" y="12">Same rules, managed centrally</text>
<rect class="fw-box" x="120" y="22" width="160" height="40" rx="6"/>
<text class="fw-kind" x="200" y="37">Firewall Manager</text>
<text class="fw-name" x="200" y="53">Administrator account</text>
<line class="fw-policy" x1="170" y1="62" x2="110" y2="102" marker-end="url(#fw1-head)"/>
<line class="fw-policy" x1="230" y1="62" x2="290" y2="102" marker-end="url(#fw1-head)"/>
<text class="fw-kind" x="200" y="88">same policy</text>
<rect class="fw-box" x="10" y="104" width="180" height="64" rx="6"/>
<text class="fw-name" x="100" y="120">Account A</text>
<rect class="fw-fw" x="30" y="128" width="140" height="30" rx="4"/>
<text class="fw-chip" x="100" y="146">ALB + its own web ACL</text>
<rect class="fw-box" x="210" y="104" width="180" height="64" rx="6"/>
<text class="fw-name" x="300" y="120">Account B</text>
<rect class="fw-fw" x="230" y="128" width="140" height="30" rx="4"/>
<text class="fw-chip" x="300" y="146">ALB + its own web ACL</text>
<text class="fw-kind" x="200" y="186">Each account keeps its own entry point. No network link.</text>
<line class="fw-rule" x1="0" y1="202" x2="400" y2="202"/>
<text class="fw-title" x="2" y="224">Traffic through one account</text>
<text class="fw-name" x="30" y="299">Internet</text>
<line class="fw-flow" x1="58" y1="295" x2="92" y2="295" marker-end="url(#fw1-head)"/>
<rect class="fw-box" x="94" y="240" width="130" height="104" rx="6"/>
<text class="fw-name" x="159" y="256">Central account</text>
<rect class="fw-fw" x="106" y="266" width="106" height="40" rx="4"/>
<text class="fw-chip" x="159" y="282">CloudFront or ALB</text>
<text class="fw-chip" x="159" y="297">+ web ACL</text>
<text class="fw-kind" x="159" y="328">the only way in</text>
<line class="fw-flow" x1="224" y1="280" x2="262" y2="263" marker-end="url(#fw1-head)"/>
<line class="fw-flow" x1="224" y1="310" x2="262" y2="331" marker-end="url(#fw1-head)"/>
<rect class="fw-box" x="264" y="240" width="128" height="44" rx="6"/>
<text class="fw-name" x="328" y="258">Account A</text>
<text class="fw-kind" x="328" y="274">app servers</text>
<rect class="fw-box" x="264" y="310" width="128" height="44" rx="6"/>
<text class="fw-name" x="328" y="328">Account B</text>
<text class="fw-kind" x="328" y="344">app servers</text>
<text class="fw-kind" x="200" y="368">over CloudFront origins, peering, or a transit gateway</text>
</svg>
</div>

<p class="bitgrid-caption">Top: every account has its own firewall, and only the rules are shared. Bottom: one firewall, and the other accounts' traffic has to reach it.</p>

### Same rules everywhere: AWS Firewall Manager

**AWS Firewall Manager** is the AWS service for the first approach. You set up protections once in an administrator account, and it applies them across the accounts in your organization, including accounts and resources added later [@aws-fms-intro]. It manages AWS WAF, Shield Advanced, security groups, network ACLs, Network Firewall, and Route 53 Resolver DNS Firewall, plus a few third-party firewalls from AWS Marketplace [@aws-fms-intro, @aws-fms-policies].

You write a **policy** for one type of protection and give it a scope, like every account in the organization, certain organizational units, or resources with a certain tag [@aws-fms-policies]. For AWS WAF, the policy names rule groups that run first and last in the web ACL, and each account can add its own rules to run in between, so the central team sets a floor and every application team can still add rules for its own app [@aws-fms-policies, @aws-fms-waf-policies]. Firewall Manager can create new web ACLs for the resources in scope or take over the ones already there [@aws-fms-waf-policies]. For each policy you choose whether resources that don't comply only get reported, or get fixed automatically [@aws-fms-policies].

It needs a few things in place first: the accounts have to be in one organization in **AWS Organizations**, one account has to be made the Firewall Manager administrator, **AWS Config** has to be turned on in the accounts, and Network Firewall and DNS Firewall policies also need resource sharing through AWS RAM [@aws-fms-prereq]. A large organization can have several administrators, each limited to certain accounts or policy types [@aws-fms-admins]. Firewall Manager's own charges are for the services it uses underneath, like AWS WAF and AWS Config [@aws-fms-intro].

Each account still has its own web ACLs, security groups, and firewalls, sitting on its own resources. Firewall Manager only keeps their rules in line. That means no network connection between the accounts is needed, and it doesn't matter if their VPCs use overlapping address ranges, because no traffic ever moves between them.

### All traffic through one account: CloudFront with a web ACL

Put a CloudFront distribution in a central account with a web ACL on it (created in `us-east-1`, as above [@aws-waf-resources]), and point it at origins in the other accounts. Every request goes through the WAF at CloudFront before it reaches any of them. [CDNs and CloudFront](/primers/networking/cdns-and-cloudfront/) covers how CloudFront itself works.

The origins can be reached two ways:

- **A public ALB in the other account.** CloudFront connects to it by its public DNS name. The catch is that the ALB is still on the internet, so anyone who finds its name can go around CloudFront and the WAF. AWS's suggested fixes are having CloudFront add a secret custom header that the ALB requires before forwarding anything, and allowing only CloudFront's AWS-managed prefix list in the ALB's security group [@aws-cloudfront-alb-restrict].
- **A VPC origin.** CloudFront can deliver from an internal ALB, an NLB, or an EC2 instance in a private subnet, with nothing exposed to the internet at all [@aws-cloudfront-vpc-origins]. VPC origins can be shared across AWS accounts, whether or not they're in the same organization, from the CloudFront console or through AWS RAM [@aws-cloudfront-vpc-origins].

Either way, CloudFront reaches each origin on its own. There's no peering or transit gateway between the accounts, so their address ranges can overlap. The limit is the same as for any WAF: this only covers HTTP and HTTPS.

### All traffic through one account: a central load balancer

Put an ALB with a web ACL in a central account, and connect that account's VPC to the others with VPC peering or a transit gateway (peering works between VPCs in different accounts [@aws-vpc-peering]). The ALB's target group uses the **IP** target type, and its targets are the private addresses of the app servers in the other accounts. ALB IP targets can be instances in a peered VPC, in the same region or another, or anything reachable by IP from private ranges, including on-premises servers over a VPN or Direct Connect. Instances in a peered VPC can only be registered by IP address, not by instance ID [@aws-alb-target-groups].

This needs a network link, which brings two requirements:

- **The VPCs' ranges can't overlap.** AWS won't create a peering connection between VPCs with overlapping ranges [@aws-vpc-peering], and a transit gateway won't route between attached VPCs whose ranges overlap [@aws-tgw-vpc-attachments].
- **Someone has to keep the target list current.** The ALB only knows the addresses registered with it. When servers in the other account are replaced or scaled, nothing tells the central account, so registering and removing addresses becomes a job someone owns, usually with automation.

Putting production and non-production behind one load balancer, with one WAF and one set of listener rules, means a bad rule change or an overload hits both at once, and many teams would rather keep production's front door to itself.

### All traffic through one account: an inspection VPC

The CloudFront and load balancer patterns only cover web traffic coming in. To inspect everything, traffic between VPCs and traffic out to the internet included, the usual design routes it through a central **inspection VPC** running AWS Network Firewall:

1. **Every VPC attaches to one transit gateway.** A transit gateway can be shared with other accounts through AWS RAM, so VPCs in different accounts can attach to the same one [@aws-nfw-tgw-attached].
2. **The transit gateway's route tables send traffic to the inspection VPC.** The VPCs being protected (often called **spoke** VPCs, with the transit gateway as the hub) use a route table whose routes point at the inspection VPC's attachment. The firewall inspects the traffic and sends it back to the transit gateway, which looks up the destination in the route table associated with the inspection VPC's attachment and sends it on to the right VPC [@aws-tgw-appliance-steering].
3. **Appliance mode is turned on** for the inspection VPC's attachment. Normally a transit gateway may send the two directions of a connection through different availability zones, and a stateful firewall in one zone would then see only half of it. Appliance mode keeps a whole flow in the same zone for as long as it lasts [@aws-tgw-vpc-attachments], and Network Firewall requires it in this design [@aws-nfw-tgw-config].

<div class="fw-diagram" role="img" aria-label="An inspection VPC behind a transit gateway. Step 1: VPC A, 10.1.0.0/16 in account 111111111111, sends traffic to the transit gateway. Step 2: the transit gateway's spoke route table sends everything to the inspection VPC, where a Network Firewall endpoint inspects it. Step 3: the firewall sends it back to the transit gateway. Step 4: the inspection route table sends it on to VPC B, 10.2.0.0/16 in account 222222222222. The transit gateway and the inspection VPC are in a network account, and appliance mode is on for the inspection VPC's attachment.">
<svg viewBox="0 0 400 252" aria-hidden="true" focusable="false">
<defs><marker id="fw2-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="fw-head" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="fw-box" x="8" y="8" width="128" height="56" rx="6"/>
<text class="fw-name" x="72" y="25">VPC A</text>
<text class="fw-kind" x="72" y="40">10.1.0.0/16</text>
<text class="fw-kind" x="72" y="53">account 111111111111</text>
<rect class="fw-box" x="8" y="152" width="128" height="56" rx="6"/>
<text class="fw-name" x="72" y="169">VPC B</text>
<text class="fw-kind" x="72" y="184">10.2.0.0/16</text>
<text class="fw-kind" x="72" y="197">account 222222222222</text>
<rect class="fw-box" x="160" y="86" width="92" height="48" rx="6"/>
<text class="fw-name" x="206" y="106">Transit gateway</text>
<text class="fw-kind" x="206" y="121">network account</text>
<rect class="fw-box" x="272" y="54" width="120" height="110" rx="6"/>
<text class="fw-name" x="332" y="71">Inspection VPC</text>
<text class="fw-kind" x="332" y="84">network account</text>
<rect class="fw-fw" x="284" y="92" width="96" height="40" rx="4"/>
<text class="fw-chip" x="332" y="109">Network Firewall</text>
<text class="fw-chip" x="332" y="122">endpoint</text>
<text class="fw-kind" x="332" y="152">appliance mode on</text>
<line class="fw-flow" x1="136" y1="44" x2="186" y2="84" marker-end="url(#fw2-head)"/>
<line class="fw-flow" x1="252" y1="100" x2="282" y2="100" marker-end="url(#fw2-head)"/>
<line class="fw-flow" x1="284" y1="124" x2="254" y2="124" marker-end="url(#fw2-head)"/>
<line class="fw-flow" x1="186" y1="136" x2="138" y2="172" marker-end="url(#fw2-head)"/>
<g class="fw-step"><circle cx="170" cy="56" r="7"/><text x="170" y="59">1</text></g>
<g class="fw-step"><circle cx="267" cy="88" r="7"/><text x="267" y="91">2</text></g>
<g class="fw-step"><circle cx="269" cy="140" r="7"/><text x="269" y="143">3</text></g>
<g class="fw-step"><circle cx="170" cy="164" r="7"/><text x="170" y="167">4</text></g>
<text class="fw-kind fw-left" x="8" y="232">spoke route table (VPC A, VPC B): 0.0.0.0/0 → inspection VPC</text>
<text class="fw-kind fw-left" x="8" y="246">inspection route table: 10.1.0.0/16 → VPC A, 10.2.0.0/16 → VPC B</text>
</svg>
</div>

<p class="bitgrid-caption">VPC A to VPC B by way of the firewall. Neither VPC can reach the other without passing the endpoint, because the only route the transit gateway gives them leads there.</p>

Newer setups can skip building the inspection VPC. Network Firewall can attach directly to a transit gateway as a **network function attachment**, and AWS creates and runs the pieces behind it [@aws-tgw-network-function, @aws-nfw-tgw-attached]. The routing idea is the same, with a firewall attachment where the inspection VPC's attachment was.

Of the patterns that send traffic through one account, this is the only one that covers traffic other than HTTP, and traffic going out as well as coming in. It also has the most moving parts, and like the central load balancer it needs a transit gateway, so overlapping ranges are a problem here too. VPC peering doesn't work as a way around that: AWS lists peering as an architecture Network Firewall doesn't support [@aws-nfw-architectures].

### When address ranges overlap

Only the first two patterns ignore overlapping ranges, because neither one routes traffic between the accounts' VPCs. The other two need every connected VPC to have its own range, which is much easier to plan from the start ([don't overlap with networks you'll connect to](/primers/networking/aws-vpc-subnets/#dont-overlap-with-networks-youll-connect-to)) than to fix later.

When it's too late for that, AWS documents a workaround with a **private NAT gateway**. Each VPC gets a second, non-overlapping range alongside its original one. A private NAT gateway in VPC A's new range, and an ALB in VPC B's new range, let VPC A's servers reach VPC B's servers through a transit gateway, with the traffic appearing to come from the NAT gateway's address [@aws-nat-gateway-scenarios]. It works, but it adds a range, a NAT gateway, and a load balancer per VPC, and some careful routing, all to get around a numbering decision.

## Choosing

| Pattern | Network link between accounts | Overlapping ranges OK | What you maintain | Good for |
|---|---|---|---|---|
| Firewall Manager | No | Yes | Policies in the administrator account, plus Organizations and AWS Config. Each account keeps its own entry points. | Many accounts with their own load balancers that should all meet the same baseline |
| CloudFront with a web ACL | No | Yes | One distribution, its origins, and keeping public origins locked to CloudFront | Public websites and APIs that can share one front door |
| Central ALB with a web ACL | Peering or transit gateway | No | IP targets in the other accounts, kept current | A few stable backends, usually within one environment |
| Inspection VPC with Network Firewall | Transit gateway | No | Transit gateway route tables, appliance mode, the firewall's rules | Inspecting all traffic between VPCs and to the internet, not only HTTP |

The patterns combine. A common arrangement uses Firewall Manager to keep the same WAF rules on every account's load balancers and on a shared CloudFront distribution, with an inspection VPC handling traffic between VPCs and out to the internet.
