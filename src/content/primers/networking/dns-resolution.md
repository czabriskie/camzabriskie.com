---
title: How DNS resolution works
description: What actually happens between typing a name and connecting to an address, who answers each question along the way, why changes take time to show up, and where Route 53 fits.
order: 6
updated: 2026-10-05
---

Every connection starts with a lookup. Before a browser can talk to `www.example.com`, something has to turn that name into an address like `203.0.113.10`, and DNS (the Domain Name System) is how that happens [@rfc1034]. It's usually invisible, and it's behind a surprising number of "it works on my machine" problems.

[Certificates and trust](/primers/networking/certificates-and-trust/#dns-names) covers the record types you'll set up most often (A, AAAA, CNAME, alias, TXT). This primer is about the lookup itself.

## Reading a domain name

A name like `www.example.com` reads most naturally right to left, because that's the order DNS works through it:

- **`.com`** is the **top-level domain (TLD)**. There's technically one more piece to its right, an invisible root, written as a trailing dot (`www.example.com.`), and every lookup starts there.
- **`example`** is the **second-level domain**, the part someone registers and owns.
- **`www`** is a **subdomain**. The owner can make as many as they like (`app`, `api`, `mail`), and each one can point somewhere different.

If it helps, think of the TLD as the city, the second-level domain as a street in it, and each subdomain as a house on that street. Together they pin down one place.

## Who's involved

Two different jobs get called "DNS servers," and mixing them up makes the rest confusing:

- A **resolver** asks questions on your behalf until it finds an answer. It doesn't own any names.
- A **name server** answers questions about the names it's responsible for. It doesn't go looking for anything.

There are five players in a typical lookup:

| Who | Job | Analogy |
|---|---|---|
| **Stub resolver** | The small piece of your operating system that apps ask. It doesn't search; it hands the question to a recursive resolver. | You at the front desk |
| **Recursive resolver** | Does all the legwork: asks the other servers, follows their pointers, caches what it learns. Run by your ISP, your company, your cloud provider, or a public service. | The librarian who goes and finds the book |
| **Root name servers** | Know which name servers handle each TLD. There are 13 root server names, run by 12 organizations, served from about two thousand instances around the world [@root-servers]. | The directory of which floor each subject is on |
| **TLD name servers** | Know which name servers are responsible for each domain under their TLD (every `*.com`, for example). | The shelf label for one subject |
| **Authoritative name servers** | Hold the actual records for a domain and give the real answer. Run by whoever hosts the domain's DNS, like Route 53. | The book itself |

## Following one lookup

Here's what happens the first time a laptop looks up `www.example.com`, with nothing cached anywhere:

1. **The browser asks the operating system** (the stub resolver) for the address of `www.example.com`.
2. **The stub resolver asks the recursive resolver** it's configured to use. From here on, the recursive resolver does all the work.
3. **The recursive resolver asks a root server.** The root doesn't know the answer. It replies with a **referral**: "I don't know `www.example.com`, but these are the name servers for `.com`."
4. **The recursive resolver asks a `.com` TLD server.** It doesn't know the answer either, and replies with another referral: "These are the name servers for `example.com`."
5. **The recursive resolver asks one of `example.com`'s authoritative name servers.** This one actually has the record and replies with the answer: `www.example.com` is `203.0.113.10`.
6. **The recursive resolver hands the answer back to the stub resolver,** which hands it to the browser, and the browser connects to `203.0.113.10`.

Two details trip people up:

- **The root and TLD servers never go find the answer themselves.** They point the recursive resolver to the next server to ask, and the recursive resolver makes every query itself. The root server never talks to the TLD server, and the TLD server never talks to the authoritative one.
- **The answer doesn't travel back through the chain.** The recursive resolver already has it after step 5 and gives it straight to your machine.

| Step | Recursive resolver asks | Question | Reply |
|---|---|---|---|
| 3 | A root server | Where's `www.example.com`? | Referral: ask the `.com` servers |
| 4 | A `.com` TLD server | Where's `www.example.com`? | Referral: ask `example.com`'s name servers |
| 5 | An `example.com` name server | Where's `www.example.com`? | Answer: `203.0.113.10` |

## Caching, TTLs, and "propagation"

That full walk is rare. Every answer comes with a **TTL** (time to live), in seconds, and the recursive resolver keeps the answer that long before asking again [@rfc1035]. Referrals get cached too, so a busy resolver almost never needs the root servers, and usually not the TLD servers either. Your operating system and browser keep their own small caches on top of that.

Caching explains "DNS propagation." When you change a record, the authoritative server has the new value immediately, but every resolver that cached the old value keeps using it until its TTL runs out. Nothing is propagating. Old copies are expiring. That's why the usual advice before moving a site is to lower the record's TTL a day or so ahead, so the old copies expire quickly when you make the switch, and raise it again afterward.

"This name doesn't exist" gets cached too. If a resolver looks up a name before you've created it, it remembers the failure for a while (set by the zone's SOA record) and keeps saying it doesn't exist even after you add it [@rfc2308].

## Which resolver your machine uses

The recursive resolver usually comes from your network's settings, handed out along with your IP address. On Linux it's listed in `/etc/resolv.conf`, and on macOS `scutil --dns` shows the full configuration.

That configuration can include more than one resolver, and some only apply to certain domains. A machine on a VPN might send `*.corp.example.com` to the company's resolver and everything else to the normal one. That's **split DNS**, and it's why a name can resolve with the VPN up and fail without it, or resolve to a different address depending on which resolver answered. It's also step 7 in the [checklist for reaching private resources](/primers/networking/reaching-private-resources/#connected-but-cant-reach-it).

## Watching it happen

`dig` shows a single lookup in detail, including the TTL on each record:

```bash
dig www.example.com
dig www.example.com @<resolver address>   # ask a specific resolver
dig +trace www.example.com                # walk root → TLD → authoritative yourself
```

`dig +trace` skips your recursive resolver and makes each query itself, so you can see every referral from the walkthrough above.

To go the other way, from an address to a name, use `dig -x` (plain `dig 203.0.113.10` treats the address as a name and won't find anything). Reverse lookups use **PTR** records under a special domain, with the address written backwards: `203.0.113.10` is looked up as `10.113.0.203.in-addr.arpa` [@rfc1035]. It's a quick way to see who runs a resolver or server, when the owner has set one up.

You can also watch the raw traffic. DNS normally uses UDP port 53 (falling back to TCP for large answers) [@rfc1035], so on macOS:

```bash
# clear the local cache so the next lookup goes out on the wire
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# watch DNS traffic
sudo tcpdump -i any udp port 53

# in another terminal
curl -sI https://www.example.com
```

The first request shows the queries going out. Repeat it and there's little or nothing, because the answer is cached. If you see nothing even the first time, your browser or system may be using **DNS over HTTPS**, which sends lookups inside ordinary encrypted HTTPS traffic on port 443 [@rfc8484], so a filter on port 53 never sees them.

## A few more record types

These show up as soon as you look at a whole zone instead of one record:

| Record | What it holds |
|---|---|
| **NS** | Which name servers are authoritative for a domain. These are what the TLD's referral points to. |
| **SOA** | Start of authority: housekeeping for the zone, including how long to cache "doesn't exist" answers. |
| **AAAA** | An IPv6 address, the counterpart to A [@rfc3596]. |
| **PTR** | A name for an address, used for reverse lookups. |
| **MX** | Which servers accept email for the domain. |

## Where Route 53 fits

Route 53 is AWS's DNS service, and it does a few separate jobs that are easy to blur together [@aws-route53-concepts]:

- **Domain registration.** Registering a domain makes you its owner. The registrar's main technical job is telling the TLD which name servers are authoritative for your domain. You can register a domain in one place and host its DNS somewhere else.
- **Authoritative DNS, through hosted zones.** A **hosted zone** is the set of records for one domain. When you create a public hosted zone, Route 53 assigns it four name servers and creates the zone's NS and SOA records. Those four name servers have to be the ones listed at your registrar, or the TLD's referrals will point somewhere else and your records won't be used [@aws-route53-public-zones].
- **Recursive resolution inside your VPCs.** Every VPC gets a resolver at its base address plus two (the reserved `.2` address from [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/#the-five-reserved-addresses)). It answers for names inside the VPC and looks everything else up on the internet [@aws-route53-resolver].

### Private hosted zones

A **private hosted zone** holds records that only answer inside the VPCs you associate with it, like `db.internal.example.com` pointing at a private address. A query from outside those VPCs doesn't see the private zone at all and gets looked up on the public internet instead [@aws-route53-private-zones]. So a laptop on a VPN can reach a private address but still fail to resolve its name, unless its DNS queries go to a resolver that can see the private zone.

The VPC resolver can bridge that gap in both directions: networks outside AWS can forward queries to it, and it can forward queries for chosen domains out to resolvers on another network. When forwarding rules overlap, the most specific domain wins [@aws-route53-resolver], the same idea as [longest prefix match](/primers/networking/aws-vpc-subnets/#when-more-than-one-route-matches) in route tables.

### Routing policies

A plain record always returns the same answer. Route 53 can also choose between several answers for the same name [@aws-route53-routing-policies]:

| Policy | Chooses based on |
|---|---|
| Simple | Nothing. One answer. |
| Weighted | Proportions you set, like 90% to the current version and 10% to a new one |
| Latency | Whichever AWS Region gives the person asking the lowest latency |
| Failover | A health check: the primary while it's healthy, a standby when it isn't |
| Geolocation | Where the person asking is located |
| Geoproximity | Where your resources are, optionally shifting traffic from one location to another |
| IP-based | Which address range the query comes from |
| Multivalue answer | Up to eight healthy records, picked at random |

All of these happen at lookup time, so caching still applies. If a failover record has a five-minute TTL, some people keep getting the old answer for up to five minutes after the switch, which is why failover records usually have short TTLs.
