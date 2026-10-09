---
title: Firewalls on AWS, and sharing them across accounts
description: What packet filters, stateful firewalls, and web application firewalls each look at, how security groups, network ACLs, AWS Network Firewall, and AWS WAF compare, and the ways to put one set of firewall rules in front of several AWS accounts.
order: 10
updated: 2026-10-08
---

A firewall looks at traffic and decides, rule by rule, whether to let it through. Firewalls differ mostly in how much of the traffic they read before deciding. Some only read the addresses and ports on the outside of each packet, and some read the whole web request. AWS has four of its own, reading at different depths and attached to different things, and that second part starts to matter as soon as there's more than one AWS account, because a firewall's rules live in one account.

This builds on [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/) and [Load balancers and TLS termination](/primers/networking/load-balancers-and-tls/). The cross-account patterns near the end use VPC peering and transit gateways, which [Reaching private resources](/primers/networking/reaching-private-resources/) covers.

## What a firewall decides

Every firewall has a **ruleset**: a list of rules, each one a condition and an action, usually allow or deny. Traffic arrives, the firewall compares it with the rules, and the rule that matches decides what happens to it. NIST's guide to firewalls sorts them by how much of the traffic they read [@nist-sp-800-41]:

- **Packet filters** read the outside of each packet: the source and destination IP addresses, the protocol (TCP, UDP, ICMP), and the ports. They don't look at the contents at all. Each packet is judged on its own, with no memory of the ones before it, which is why they're also called **stateless**. A router with access control lists is the classic example.
- **Stateful firewalls** read the same fields, and also keep a **state table**, a list of the connections currently open through them. A reply that belongs to a connection already in the table is let back through, and a packet claiming to be part of a connection the firewall never saw start gets dropped. In practice this means you only write rules for whoever starts a connection, and the replies take care of themselves.
- **Application firewalls** read the application protocol inside the connection, and can block based on what the program is actually doing, like an argument that's suspiciously long. A **web application firewall (WAF)** is the kind that reads HTTP, and it sits in front of web servers to stop attacks against them.

In [OSI](/primers/networking/osi-model/#the-seven-layers) terms the first two work at layers 3 and 4 and application firewalls at layer 7, and since HTTPS is encrypted, a WAF can only read a request somewhere TLS has already been [terminated](/primers/networking/load-balancers-and-tls/#terminating-tls), on a load balancer or CDN that holds the certificate, which is also why a WAF can't do anything for traffic that isn't HTTP ([more on that](/primers/networking/load-balancers-and-tls/#wafs-only-work-on-http)).

"State" here means memory of connections, nothing more. A stateless firewall isn't simpler to configure. It's usually harder, because the replies need rules of their own.

Take a browser at `203.0.113.25` asking for `https://app.example.com/login?user=admin'--`, where `app.example.com` resolves to `198.51.100.10`:

| Kind | What it sees | Can it stop this request? |
|---|---|---|
| Packet filter | TCP from `203.0.113.25` to `198.51.100.10`, port 443 | No. Someone is connecting to a web server on the usual port, which looks like any other visitor. |
| Stateful firewall | The same, plus that this is a new connection, and later that the replies belong to it | No, for the same reason. |
| WAF, after TLS is terminated | `GET /login?user=admin'--`, `Host: app.example.com`, the other headers, cookies, and any body | Yes. `'--` in a parameter is a classic sign of SQL injection. |

In SQL, `'` ends a piece of text and `--` starts a comment. If the login page pastes that username straight into a database query, the `'` closes the username early and the `--` turns the rest of the query, including the password check, into a comment. That's **SQL injection**: input written to change the database query it gets pasted into, to read or modify data the attacker shouldn't reach [@aws-waf-sqli]. The addresses and ports give no hint of it. Only something that reads the request can catch it.

## The four AWS firewalls

### Security groups and network ACLs

These two come with every VPC, and [the VPC primer covers them](/primers/networking/aws-vpc-subnets/#security-groups-and-network-acls) in detail. In the terms above:

- A **security group** is a stateful firewall attached to a resource's network interface, with allow rules only [@aws-vpc-security-groups].
- A **network ACL** is a stateless packet filter attached to a subnet, with numbered allow and deny rules checked in order [@aws-vpc-nacls].

Neither reads anything above layer 4.

### AWS Network Firewall

**AWS Network Firewall** is a managed stateful firewall and intrusion prevention service that runs inside a VPC [@aws-nfw-what]. It doesn't attach to a resource or a subnet the way the first two do. Instead it creates a **firewall endpoint** in a subnet you set aside for it in each availability zone. An endpoint is something a route can point at, the same way a route points at an internet gateway, and whatever a route sends to it gets handed to the firewall, which inspects it and sends it on. So you change route tables to make traffic pass through the endpoints on its way between your subnets and the outside: an internet gateway, a NAT gateway, a VPN, or another VPC [@aws-nfw-what, @aws-nfw-how]. Traffic that no route sends through an endpoint never gets inspected. The firewall's subnets shouldn't hold anything else, because an endpoint can't filter traffic going into or out of its own subnet [@aws-nfw-what].

It has two engines, and traffic goes through them in order [@aws-nfw-engines]:

1. **The stateless engine** checks each packet on its own against rules in priority order, and the first match wins. AWS compares it to network ACLs. Each rule's action is **Pass** (let the packet go with no more inspection), **Drop**, or **Forward to stateful rules**, and a packet that matches no rule gets the policy's default action, picked from the same three [@aws-nfw-rule-actions].
2. **The stateful engine** checks packets in the context of their connection, and AWS compares it to security groups, with one difference: in its default rule order, traffic that no rule drops is let through, where a security group blocks it [@aws-nfw-engines]. AWS recommends the other rule order, **strict order**, where rule groups run in the order you set and you can pick a default action, **Drop all** or **Drop established**, that drops whatever your rules didn't pass, the way a security group does [@aws-nfw-rule-order]. The order is chosen when the policy is created and can't be changed afterward [@aws-nfw-policy-settings]. Its rules use the format of **Suricata**, an open source intrusion prevention system, so they can match on much more than addresses and ports [@aws-nfw-what].

It also understands domain names. A **domain list** rule group allows or denies traffic by hostname, like `updates.example.com`, or `.example.com` for a domain and everything under it. For HTTPS it reads the hostname from [SNI](/primers/networking/load-balancers-and-tls/#sni-many-certificates-on-one-address), which the client sends at the start of the TLS handshake before anything is encrypted, and for plain HTTP it reads the `Host` header [@aws-nfw-domain-lists]. A common use is limiting which domains the servers in a private subnet can reach [@aws-nfw-what], and by default a domain list only checks traffic that starts inside the firewall's own VPC [@aws-nfw-domain-lists].

So Network Firewall mostly works at layers 3 and 4 like the VPC firewalls, reaching up into layer 7 for hostnames and protocol detection. It handles any protocol (TCP, UDP, ICMP) [@aws-nfw-what], not only web traffic.

#### Putting it in the path

Take a VPC, `10.0.0.0/16`, with an ALB in a public subnet, `10.0.1.0/24`, and a firewall subnet, `10.0.0.0/28`, holding the endpoint `vpce-fw-a`. Traffic between the internet and the ALB has to pass the endpoint in both directions, which takes three route tables [@aws-nfw-arch-single-igw]:

| Route table | Associated with | Route | What it does |
|---|---|---|---|
| Internet gateway's | The internet gateway | `10.0.1.0/24` → `vpce-fw-a` | Sends traffic arriving for the ALB's subnet to the firewall first |
| ALB subnet's | `10.0.1.0/24` | `0.0.0.0/0` → `vpce-fw-a` | Sends the ALB's replies to the firewall instead of straight out |
| Firewall subnet's | `10.0.0.0/28` | `0.0.0.0/0` → `igw-…` | Sends what the firewall passes on out to the internet |

Each table also keeps the usual `10.0.0.0/16` → `local` route, and that's how the firewall hands arriving traffic on to the ALB's subnet.

The first table is the unusual one. A route table normally belongs to subnets and decides where traffic leaving them goes, but this one is associated with the internet gateway itself and decides where traffic arriving from the internet goes once it's inside the VPC. AWS calls it a **gateway route table**, and announced the feature as **ingress routing** [@aws-vpc-gateway-route-tables, @aws-vpc-ingress-routing-blog]. Without it, arriving traffic would take the local route straight to the ALB's subnet and never meet the firewall.

<div class="fw-diagram" role="img" aria-label="One availability zone with Network Firewall between the internet gateway and an ALB. The request goes from the internet to the internet gateway, then to the firewall endpoint vpce-fw-a in the firewall subnet 10.0.0.0/28, then to the ALB subnet 10.0.1.0/24. The reply goes back the same way: from the ALB subnet to the same firewall endpoint, then to the internet gateway, then to the internet. Step 1, the internet gateway's route table sends 10.0.1.0/24 to vpce-fw-a. Step 2, the ALB subnet's route table sends 0.0.0.0/0 to vpce-fw-a. Step 3, the firewall subnet's route table sends 0.0.0.0/0 to the internet gateway.">
<svg viewBox="0 0 400 186" aria-hidden="true" focusable="false">
<defs><marker id="fw3-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="fw-head" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="fw-kind fw-left" x="4" y="14">request →</text>
<rect class="fw-box" x="4" y="40" width="62" height="60" rx="6"/>
<text class="fw-name" x="35" y="67">Internet</text>
<text class="fw-kind" x="35" y="81">203.0.113.25</text>
<rect class="fw-box" x="90" y="40" width="76" height="60" rx="6"/>
<text class="fw-name" x="128" y="62">Internet</text>
<text class="fw-name" x="128" y="74">gateway</text>
<text class="fw-kind" x="128" y="88">igw-…</text>
<rect class="fw-fw" x="190" y="40" width="100" height="60" rx="4"/>
<text class="fw-chip" x="240" y="62">Firewall endpoint</text>
<text class="fw-kind" x="240" y="76">vpce-fw-a</text>
<text class="fw-kind" x="240" y="88">10.0.0.0/28</text>
<rect class="fw-box" x="314" y="40" width="82" height="60" rx="6"/>
<text class="fw-name" x="355" y="67">ALB subnet</text>
<text class="fw-kind" x="355" y="81">10.0.1.0/24</text>
<line class="fw-flow" x1="67" y1="52" x2="89" y2="52" marker-end="url(#fw3-head)"/>
<line class="fw-flow" x1="167" y1="52" x2="189" y2="52" marker-end="url(#fw3-head)"/>
<line class="fw-flow" x1="291" y1="52" x2="313" y2="52" marker-end="url(#fw3-head)"/>
<line class="fw-flow" x1="313" y1="90" x2="291" y2="90" marker-end="url(#fw3-head)"/>
<line class="fw-flow" x1="189" y1="90" x2="167" y2="90" marker-end="url(#fw3-head)"/>
<line class="fw-flow" x1="89" y1="90" x2="67" y2="90" marker-end="url(#fw3-head)"/>
<g class="fw-step"><circle cx="178" cy="30" r="7"/><text x="178" y="33">1</text></g>
<g class="fw-step"><circle cx="302" cy="110" r="7"/><text x="302" y="113">2</text></g>
<g class="fw-step"><circle cx="178" cy="110" r="7"/><text x="178" y="113">3</text></g>
<text class="fw-kind fw-left" x="4" y="130">← reply, back through the same endpoint</text>
<g class="fw-step"><circle cx="10" cy="148" r="6"/><text x="10" y="151">1</text></g>
<text class="fw-kind fw-left" x="22" y="151">internet gateway's table: 10.0.1.0/24 → vpce-fw-a</text>
<g class="fw-step"><circle cx="10" cy="163" r="6"/><text x="10" y="166">2</text></g>
<text class="fw-kind fw-left" x="22" y="166">ALB subnet's table: 0.0.0.0/0 → vpce-fw-a</text>
<g class="fw-step"><circle cx="10" cy="178" r="6"/><text x="10" y="181">3</text></g>
<text class="fw-kind fw-left" x="22" y="181">firewall subnet's table: 0.0.0.0/0 → igw-…</text>
</svg>
</div>

<p class="bitgrid-caption">The request and its reply both cross vpce-fw-a. If table 2 sent 0.0.0.0/0 straight to the internet gateway, the replies would skip the firewall.</p>

The reply has to come back through the same endpoint. Network Firewall doesn't support asymmetric routing, where a request and its response aren't routed to the same endpoint [@aws-nfw-asymmetric]. A stateful engine that sees only one direction of a connection has nothing to match the other half against, and AWS warns that a request and reply on different paths can get traffic dropped [@aws-tgw-asymmetric]. With more than one availability zone, each zone gets its own firewall subnet and endpoint, and each zone's tables point at the endpoint in that zone [@aws-nfw-arch-multi-igw].

### AWS WAF

**AWS WAF** is the application firewall. Its rules live in a **web ACL** (AWS's newer console calls it a **protection pack**). Despite the name, a web ACL has nothing to do with a network ACL beyond both being lists of rules: a network ACL filters packets at the edge of a subnet, and a web ACL filters HTTP requests wherever HTTPS is terminated. Rules can also come packaged in a **rule group**, a reusable set of rules you add to a web ACL. A rule group isn't attached to anything itself, and only takes effect through the web ACLs it's added to [@aws-waf-rule-groups].

Each rule inspects a part of every HTTP request: the method, a header, the cookies, the path, the query string, or the body [@aws-waf-request-components]. Rules can match the client's address or country, specific strings or patterns, the length of a request, SQL injection, and cross-site scripting, and you can add managed rule groups that AWS or other vendors maintain [@aws-waf-what]. A **rate-based rule** counts requests instead, grouped by client address or another key, and acts on the ones over a limit you set for a window of 1, 2, 5, or 10 minutes [@aws-waf-rate-settings, @aws-waf-rate-aggregation]. A matching rule can allow, block, or count the request, or show a CAPTCHA [@aws-waf-what], and a blocked request gets a `403 Forbidden` by default [@aws-waf-rule-actions].

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
| Stateful | Yes | No | Both engines, stateless first | No, each request on its own (rate rules count requests per address over a time window) |
| Typical use | The main firewall for every resource | A coarse deny or backstop for a subnet | Filtering outbound traffic by domain, inspecting traffic between VPCs and the internet | Blocking web attacks, bots, and floods of requests |

### One request through all four

Picture the VPC from [Putting it in the path](#putting-it-in-the-path): an ALB in a public subnet, app servers in private subnets, a Network Firewall endpoint between the internet gateway and the ALB's subnet, and a web ACL on the ALB. The same request from `203.0.113.25` arrives for `https://app.example.com/login?user=admin'--`:

1. **Network Firewall.** The internet gateway's route table sends the traffic to the firewall endpoint first. Inside the VPC only private addresses are used, so by now the destination is the ALB's private address, say `10.0.1.20`, rather than `198.51.100.10` [@aws-nfw-arch-single-igw]. A stateless rule forwards it to the stateful engine, where a pass rule for TCP port 443 to the ALB's subnet matches. Allowed. The firewall can read `app.example.com` in the SNI, but a domain list wouldn't check it, because this connection started outside the VPC [@aws-nfw-domain-lists]. The `'--` is inside the encrypted part, so the firewall has no idea it's there.
2. **Network ACL** on the ALB's subnet. Inbound TCP 443 from anywhere is allowed. Allowed.
3. **Security group** on the ALB. Inbound 443 from anywhere is allowed, and the replies will be let out automatically. Allowed.
4. **The ALB terminates TLS** and hands the decrypted request to **AWS WAF**. A SQL injection rule inspecting the query string matches. Blocked, and the client gets a `403`.

<div class="fw-diagram" role="img" aria-label="What each checkpoint can see of the same request. Network Firewall sees 203.0.113.25 to 10.0.1.20 port 443 and the SNI app.example.com, and the path, query, and headers are still encrypted. It passes the traffic. The network ACL sees 203.0.113.25 to 10.0.1.20, TCP port 443, with no memory of earlier packets. It allows it. The security group sees the same addresses and port, and that this is a new connection. It allows it. The ALB with AWS WAF sees the decrypted request, GET /login?user=admin'--, with the Host header, other headers, and cookies. It blocks the request with a 403.">
<svg viewBox="0 0 400 230" aria-hidden="true" focusable="false">
<rect class="fw-box" x="2" y="2" width="396" height="52" rx="6"/>
<text class="fw-name fw-left" x="12" y="24">Network Firewall</text>
<text class="fw-kind fw-left" x="12" y="37">after the IGW</text>
<text class="fw-chip fw-left" x="124" y="18">203.0.113.25 → 10.0.1.20:443</text>
<text class="fw-chip fw-left" x="124" y="31">SNI app.example.com</text>
<text class="fw-kind fw-left" x="124" y="44">path, query, headers: encrypted</text>
<text class="fw-chip fw-right" x="388" y="31">pass</text>
<rect class="fw-box" x="2" y="60" width="396" height="52" rx="6"/>
<text class="fw-name fw-left" x="12" y="82">Network ACL</text>
<text class="fw-kind fw-left" x="12" y="95">ALB subnet edge</text>
<text class="fw-chip fw-left" x="124" y="82">203.0.113.25 → 10.0.1.20, TCP 443</text>
<text class="fw-kind fw-left" x="124" y="95">no memory of earlier packets</text>
<text class="fw-chip fw-right" x="388" y="89">allow</text>
<rect class="fw-box" x="2" y="118" width="396" height="52" rx="6"/>
<text class="fw-name fw-left" x="12" y="140">Security group</text>
<text class="fw-kind fw-left" x="12" y="153">on the ALB</text>
<text class="fw-chip fw-left" x="124" y="140">203.0.113.25 → 10.0.1.20, TCP 443</text>
<text class="fw-chip fw-left" x="124" y="153">a new connection</text>
<text class="fw-chip fw-right" x="388" y="147">allow</text>
<rect class="fw-fw" x="2" y="176" width="396" height="52" rx="6"/>
<text class="fw-name fw-left" x="12" y="198">ALB + AWS WAF</text>
<text class="fw-kind fw-left" x="12" y="211">TLS ends here</text>
<text class="fw-chip fw-left" x="124" y="198">GET /login?user=admin'--</text>
<text class="fw-chip fw-left" x="124" y="211">Host, other headers, cookies</text>
<text class="fw-bad fw-right" x="388" y="205">block, 403</text>
</svg>
</div>

<p class="bitgrid-caption">Top to bottom in the order the request meets them. The WAF row is the first place the request is decrypted.</p>

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

**AWS Firewall Manager** is the AWS service for the first approach. You set up protections once in an administrator account, and it applies them across the accounts in your organization, including accounts and resources added later [@aws-fms-intro]. It manages AWS WAF, security groups, network ACLs, and Network Firewall, plus a few other protection types this primer leaves out [@aws-fms-intro, @aws-fms-policies].

You write a **policy** for one type of protection and give it a scope, like every account in the organization, certain organizational units, or resources with a certain tag [@aws-fms-policies]. For AWS WAF, the policy names rule groups that run first and last in the web ACL, and each account can add its own rules to run in between, so the central team sets a floor and every application team can still add rules for its own app [@aws-fms-policies, @aws-fms-waf-policies]. Firewall Manager can create new web ACLs for the resources in scope or take over the ones already there [@aws-fms-waf-policies]. For each policy you choose whether resources that don't comply only get reported, or get fixed automatically [@aws-fms-policies].

It needs a few things in place first [@aws-fms-prereq]:

- **AWS Organizations**, with all the accounts in one organization. An organization groups AWS accounts under one **management account**, and **organizational units (OUs)** are folders of accounts inside it [@aws-orgs-concepts]. One account in the organization is made the Firewall Manager administrator.
- **AWS Config** turned on in every account and region with resources to protect. Config records how each resource is configured and every change to it [@aws-config-what], and Firewall Manager reads that record to spot resources that have drifted out of line with a policy [@aws-fms-config].
- **AWS Resource Access Manager (RAM)**, which shares a resource from one account with other accounts [@aws-ram-what], turned on for Network Firewall policies.

Firewall Manager charges a monthly fee for each policy in each region, and on top of that you pay the usual price for what it creates, like the web ACLs, Network Firewall endpoints, and AWS Config rules [@aws-fms-pricing].

Each account still has its own web ACLs, security groups, and firewalls, sitting on its own resources. Firewall Manager only keeps their rules in line. That means no network connection between the accounts is needed, and it doesn't matter if their VPCs use overlapping address ranges, because no traffic ever moves between them.

#### A worked example

Say the central team writes an AWS WAF policy called `baseline-web`, scoped to Application Load Balancers tagged `env=prod` [@aws-fms-policies]. Account A has one of those, so Firewall Manager gives it a web ACL with three sets of rules, which AWS WAF checks in this order [@aws-fms-waf-rule-groups]:

1. **First rule groups, from the policy.** Two AWS managed rule groups: the SQL database group, which blocks request patterns used against SQL databases like SQL injection [@aws-waf-managed-sqli], and Known bad inputs, which blocks request patterns tied to finding or exploiting vulnerabilities [@aws-waf-managed-baseline].
2. **Account A's own rules.** Say one that blocks `/admin` unless the request comes from `10.0.0.0/8`. This set belongs to the account, and it's the only one account A edits.
3. **Last rule groups, from the policy.** A rule group of the central team's with one rate-based rule: no more than 2,000 requests per 5 minutes from any one client address. The policy's first and last sets can only hold rule groups, not single rules, which is why the rate rule comes wrapped in a group of its own [@aws-fms-waf-rule-groups].

<div class="fw-diagram" role="img" aria-label="A Firewall Manager AWS WAF policy called baseline-web, scoped to ALBs tagged env=prod, produces a web ACL on account A's ALB with three sets of rules checked in order. First, rule groups from the central team: the AWS managed SQL database and Known bad inputs rule groups. Second, account A's own rules, such as blocking /admin unless the request is from 10.0.0.0/8; this is the only part account A edits. Third, a rule group from the central team that rate limits each IP to 2,000 requests per 5 minutes.">
<svg viewBox="0 0 400 214" aria-hidden="true" focusable="false">
<defs><marker id="fw4-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="fw-head" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="fw-box" x="100" y="4" width="200" height="38" rx="6"/>
<text class="fw-name" x="200" y="19">Policy: baseline-web</text>
<text class="fw-kind" x="200" y="33">scope: ALBs tagged env=prod</text>
<line class="fw-policy" x1="200" y1="42" x2="200" y2="60" marker-end="url(#fw4-head)"/>
<rect class="fw-box" x="10" y="62" width="380" height="148" rx="6"/>
<text class="fw-name" x="200" y="78">Account A: web ACL on its env=prod ALB</text>
<g class="fw-step"><circle cx="30" cy="103" r="7"/><text x="30" y="106">1</text></g>
<rect class="fw-fw" x="44" y="86" width="334" height="34" rx="4"/>
<text class="fw-chip" x="211" y="100">First rule groups (central team)</text>
<text class="fw-kind" x="211" y="113">AWS managed: SQL database, Known bad inputs</text>
<g class="fw-step"><circle cx="30" cy="143" r="7"/><text x="30" y="146">2</text></g>
<rect class="fw-box" x="44" y="126" width="334" height="34" rx="4"/>
<text class="fw-name" x="211" y="140">Account A's own rules</text>
<text class="fw-kind" x="211" y="153">block /admin unless from 10.0.0.0/8 (the only part A edits)</text>
<g class="fw-step"><circle cx="30" cy="183" r="7"/><text x="30" y="186">3</text></g>
<rect class="fw-fw" x="44" y="166" width="334" height="34" rx="4"/>
<text class="fw-chip" x="211" y="180">Last rule groups (central team)</text>
<text class="fw-kind" x="211" y="193">rate limit: 2,000 requests per 5 minutes per IP</text>
</svg>
</div>

<p class="bitgrid-caption">The central team owns the top and bottom of every in-scope web ACL. Each account fills in the middle.</p>

### All traffic through one account: CloudFront with a web ACL

Put a CloudFront distribution in a central account with a web ACL on it (created in `us-east-1`, as above [@aws-waf-resources]), and point it at origins in the other accounts. Every request goes through the WAF at CloudFront before it reaches any of them. [CDNs and CloudFront](/primers/networking/cdns-and-cloudfront/) covers how CloudFront itself works.

The origins can be reached two ways:

- **A public ALB in the other account.** CloudFront connects to it by its public DNS name. The catch is that the ALB is still on the internet, so anyone who finds its name can go around CloudFront and the WAF. AWS's suggested fixes are having CloudFront add a secret custom header that the ALB requires before forwarding anything, and allowing only CloudFront's AWS-managed prefix list in the ALB's security group [@aws-cloudfront-alb-restrict].
- **A VPC origin.** CloudFront can deliver from an internal ALB, an NLB, or an EC2 instance in a private subnet, with nothing exposed to the internet at all [@aws-cloudfront-vpc-origins]. VPC origins can be shared across AWS accounts, whether or not they're in the same organization, from the CloudFront console or through AWS RAM [@aws-cloudfront-vpc-origins].

Either way, CloudFront reaches each origin on its own. There's no peering or transit gateway between the accounts, so their address ranges can overlap. The limit is the same as for any WAF: this only covers HTTP and HTTPS.

### All traffic through one account: a central load balancer

Put an ALB with a web ACL in a central account, and connect that account's VPC to the others with VPC peering or a transit gateway (peering works between VPCs in different accounts [@aws-vpc-peering]). The ALB's target group uses the **IP** target type, and its targets are the private addresses of the app servers in the other accounts. ALB IP targets can be instances in a peered VPC, in the same region or another, and instances in a peered VPC can only be registered by IP address, not by instance ID [@aws-alb-target-groups].

This needs a network link, which brings two requirements:

- **The VPCs' ranges can't overlap.** AWS won't create a peering connection between VPCs with overlapping ranges [@aws-vpc-peering], and a transit gateway won't route between attached VPCs whose ranges overlap [@aws-tgw-vpc-attachments].
- **Someone has to keep the target list current.** The ALB only knows the addresses registered with it. When servers in the other account are replaced or scaled, nothing tells the central account, so registering and removing addresses becomes a job someone owns, usually with automation.

It also puts production and non-production behind one load balancer, one WAF, and one set of listener rules, so one bad rule change or one overload hits both environments at the same time. That shared blast radius is the usual reason to give production a front door of its own.

### All traffic through one account: an inspection VPC

The CloudFront and load balancer patterns only cover web traffic coming in. To inspect everything, traffic between VPCs and traffic out to the internet included, the usual design routes it through a central **inspection VPC** running AWS Network Firewall:

1. **Every VPC attaches to one transit gateway.** Each VPC's connection to the transit gateway is called an **attachment** [@aws-tgw-vpc-attachments]. A transit gateway can be shared with other accounts through AWS RAM, so VPCs in different accounts can attach to the same one [@aws-nfw-tgw-attached].
2. **The transit gateway's route tables send traffic to the inspection VPC.** The VPCs being protected (often called **spoke** VPCs, with the transit gateway as the hub) use a route table whose routes point at the inspection VPC's attachment. The firewall inspects the traffic and sends it back to the transit gateway, which looks up the destination in the route table associated with the inspection VPC's attachment and sends it on to the right VPC [@aws-tgw-appliance-steering].
3. **Appliance mode is turned on** for the inspection VPC's attachment. The inspection VPC has a firewall endpoint in each availability zone, and normally a transit gateway keeps traffic in the zone it came in through, so a request from a server in one zone and the reply from a server in another can reach different endpoints [@aws-tgw-asymmetric]. Appliance mode keeps a whole flow in the same zone for as long as it lasts [@aws-tgw-vpc-attachments], and Network Firewall requires it in this design [@aws-nfw-tgw-config].

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

<div class="fw-diagram" role="img" aria-label="Appliance mode, shown twice. The inspection VPC has a firewall endpoint in zone a and another in zone b. Without appliance mode, the transit gateway sends the request, from a server in zone a, to the zone a endpoint, and the reply, from a server in zone b, to the zone b endpoint. The zone b endpoint has no state for the reply, and it is dropped. With appliance mode, the transit gateway sends both the request and the reply to the zone a endpoint, which sees the whole flow, and the zone b endpoint isn't used by this flow.">
<svg viewBox="0 0 400 252" aria-hidden="true" focusable="false">
<defs><marker id="fw5-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="fw-head" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="fw-title" x="2" y="12">Without appliance mode</text>
<rect class="fw-box" x="4" y="22" width="104" height="94" rx="6"/>
<text class="fw-name" x="56" y="62">Transit gateway</text>
<text class="fw-kind" x="56" y="76">inspection VPC's</text>
<text class="fw-kind" x="56" y="88">attachment</text>
<rect class="fw-box" x="150" y="22" width="246" height="42" rx="6"/>
<rect class="fw-fw" x="158" y="30" width="92" height="26" rx="4"/>
<text class="fw-chip" x="204" y="46">Zone a endpoint</text>
<text class="fw-kind fw-left" x="260" y="40">sees the request,</text>
<text class="fw-kind fw-left" x="260" y="52">never the reply</text>
<rect class="fw-box" x="150" y="74" width="246" height="42" rx="6"/>
<rect class="fw-fw" x="158" y="82" width="92" height="26" rx="4"/>
<text class="fw-chip" x="204" y="98">Zone b endpoint</text>
<text class="fw-kind fw-left" x="260" y="92">a reply with no state:</text>
<text class="fw-bad fw-left" x="260" y="104">dropped</text>
<text class="fw-kind" x="128" y="38">request</text>
<line class="fw-flow" x1="109" y1="43" x2="156" y2="43" marker-end="url(#fw5-head)"/>
<text class="fw-kind" x="128" y="90">reply</text>
<line class="fw-flow" x1="109" y1="95" x2="156" y2="95" marker-end="url(#fw5-head)"/>
<line class="fw-rule" x1="0" y1="128" x2="400" y2="128"/>
<text class="fw-title" x="2" y="146">With appliance mode</text>
<rect class="fw-box" x="4" y="154" width="104" height="94" rx="6"/>
<text class="fw-name" x="56" y="194">Transit gateway</text>
<text class="fw-kind" x="56" y="208">inspection VPC's</text>
<text class="fw-kind" x="56" y="220">attachment</text>
<rect class="fw-box" x="150" y="154" width="246" height="42" rx="6"/>
<rect class="fw-fw" x="158" y="162" width="92" height="26" rx="4"/>
<text class="fw-chip" x="204" y="178">Zone a endpoint</text>
<text class="fw-kind fw-left" x="260" y="172">sees both directions,</text>
<text class="fw-chip fw-left" x="260" y="184">one flow</text>
<rect class="fw-box" x="150" y="206" width="246" height="42" rx="6"/>
<rect class="fw-fw" x="158" y="214" width="92" height="26" rx="4"/>
<text class="fw-chip" x="204" y="230">Zone b endpoint</text>
<text class="fw-kind fw-left" x="260" y="230">not used by this flow</text>
<text class="fw-kind" x="128" y="166">request</text>
<line class="fw-flow" x1="109" y1="170" x2="156" y2="170" marker-end="url(#fw5-head)"/>
<line class="fw-flow" x1="109" y1="182" x2="156" y2="182" marker-end="url(#fw5-head)"/>
<text class="fw-kind" x="128" y="194">reply</text>
</svg>
</div>

<p class="bitgrid-caption">A request from a server in zone a and its reply from a server in zone b. Appliance mode keeps both on one endpoint, so the firewall sees a whole connection.</p>

Newer setups can skip building the inspection VPC. Network Firewall can attach directly to a transit gateway as a **network function attachment**, and AWS creates and runs the pieces behind it [@aws-tgw-network-function, @aws-nfw-tgw-attached]. The routing idea is the same, with a firewall attachment where the inspection VPC's attachment was.

Of the patterns that send traffic through one account, this is the only one that covers traffic other than HTTP, and traffic going out as well as coming in. It also has the most moving parts, and like the central load balancer it needs a transit gateway, so overlapping ranges are a problem here too. VPC peering doesn't work as a way around that: AWS lists peering as an architecture Network Firewall doesn't support [@aws-nfw-architectures].

### When address ranges overlap

Only the first two patterns ignore overlapping ranges, because neither one routes traffic between the accounts' VPCs. The other two need every connected VPC to have its own range, which is much easier to plan from the start ([don't overlap with networks you'll connect to](/primers/networking/aws-vpc-subnets/#dont-overlap-with-networks-youll-connect-to)) than to fix later. When it's too late for that, AWS documents a workaround with a private NAT gateway, which [Reaching private resources covers](/primers/networking/reaching-private-resources/#transit-gateway).

## Choosing

| Pattern | Network link between accounts | Overlapping ranges OK | What you maintain | Good for |
|---|---|---|---|---|
| Firewall Manager | No | Yes | Policies in the administrator account, plus Organizations and AWS Config. Each account keeps its own entry points. | Many accounts with their own load balancers that should all meet the same baseline |
| CloudFront with a web ACL | No | Yes | One distribution, its origins, and keeping public origins locked to CloudFront | Public websites and APIs that can share one front door |
| Central ALB with a web ACL | Peering or transit gateway | No | IP targets in the other accounts, kept current | A few stable backends, usually within one environment |
| Inspection VPC with Network Firewall | Transit gateway | No | Transit gateway route tables, appliance mode, the firewall's rules | Inspecting all traffic between VPCs and to the internet, not only HTTP |

The patterns combine. A common arrangement uses Firewall Manager to keep the same WAF rules on every account's load balancers and on a shared CloudFront distribution, with an inspection VPC handling traffic between VPCs and out to the internet.
