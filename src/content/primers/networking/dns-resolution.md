---
title: How DNS resolution works
description: What actually happens between typing a name and connecting to an address, who answers each question along the way, why changes take time to show up, and where Route 53 fits.
order: 7
updated: 2026-10-06
---

Every connection starts with a lookup. Before a browser can talk to `www.example.com`, something has to turn that name into an address like `203.0.113.10`, and DNS (the Domain Name System) is how that happens [@rfc1034]. It's usually invisible, and it's behind a surprising number of "it works on my machine" problems.

This primer is about the lookup itself, with [every record type you're likely to meet](#record-types) further down.

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

`dig` shows a single lookup in detail, including the TTL on each record. On Windows, `Resolve-DnsName` does the same job [@ms-resolve-dnsname]:

```bash tab="macOS / Linux"
dig www.example.com
dig www.example.com @192.0.2.53           # ask a specific resolver (put its address here)
dig +trace www.example.com                # walk root → TLD → authoritative yourself
```

```powershell tab="Windows (PowerShell)"
Resolve-DnsName www.example.com
Resolve-DnsName www.example.com -Server 192.0.2.53   # ask a specific resolver (put its address here)
```

`dig +trace` skips your recursive resolver and makes each query itself, so you can see every referral from the walkthrough above. `Resolve-DnsName` has no equivalent.

To go the other way, from an address to a name, use `dig -x` (plain `dig 203.0.113.10` treats the address as a name and won't find anything). Reverse lookups use **PTR** records under a special domain, with the address written backwards: `203.0.113.10` is looked up as `10.113.0.203.in-addr.arpa` [@rfc1035]. In PowerShell, ask for the PTR record by that backwards name: `Resolve-DnsName 10.113.0.203.in-addr.arpa -Type PTR` [@ms-resolve-dnsname]. It's a quick way to see who runs a resolver or server, when the owner has set one up.

You can also watch the raw traffic. DNS normally uses UDP port 53 (falling back to TCP for large answers) [@rfc1035, @rfc7766], so clear the local cache, watch port 53, and make a request:

```bash tab="macOS / Linux"
# clear the local cache so the next lookup goes out on the wire
sudo killall -HUP mDNSResponder      # macOS
sudo resolvectl flush-caches         # Linux with systemd-resolved

# watch DNS traffic
sudo tcpdump -i any udp port 53

# in another terminal
curl -sI https://www.example.com
```

```powershell tab="Windows (PowerShell)"
# in a PowerShell window opened as administrator
# clear the local cache so the next lookup goes out on the wire
Clear-DnsClientCache

# watch DNS traffic (Ctrl+C stops it)
pktmon filter add -p 53
pktmon start -c -m real-time

# in another window
curl.exe -sI https://www.example.com

# afterwards, remove the filter
pktmon filter remove
```

The cache commands come from each system's own documentation [@apple-dns-cache, @systemd-resolvectl, @ms-clear-dnsclientcache]. On Windows, `pktmon` is the built-in packet capture tool [@ms-pktmon-syntax, @ms-pktmon-start], and `curl.exe` is spelled out because in Windows PowerShell 5.1 plain `curl` is an alias for a different command [@ms-curl-windows].

The first request shows the queries going out. Repeat it and there's little or nothing, because the answer is cached. If you see nothing even the first time, your browser or system may be using **DNS over HTTPS**, which sends lookups inside ordinary encrypted HTTPS traffic on port 443 [@rfc8484], so a filter on port 53 never sees them.

## Record types

Every record has a name, a type, a TTL, and a value. Here's a small zone for `example.com` with most of the types you'll come across, in the format DNS servers use for zone files:

```
example.com.              3600  SOA    ns1.example.com. admin.example.com. 2026100601 7200 900 1209600 300
example.com.              3600  NS     ns1.example.com.
example.com.              3600  NS     ns2.example.net.
example.com.               300  A      203.0.113.10
example.com.               300  AAAA   2001:db8::10
www.example.com.           300  CNAME  example.com.
example.com.              3600  MX     10 mail1.example.com.
example.com.              3600  MX     20 mail2.example.com.
example.com.              3600  TXT    "v=spf1 include:_spf.mail.example.net -all"
_dmarc.example.com.       3600  TXT    "v=DMARC1; p=reject"
example.com.              3600  CAA    0 issue "letsencrypt.org"
_sip._tcp.example.com.    3600  SRV    10 50 5060 sip1.example.com.
10.113.0.203.in-addr.arpa. 3600 PTR    example.com.
```

There are over a hundred registered record types [@iana-dns-rr-types], but most are obsolete or experimental. These are the ones that matter in practice, grouped by what they're for.

### Addresses and aliases

| Type | Holds | Notes |
|---|---|---|
| **A** | An IPv4 address [@rfc1035] | The most common record there is. |
| **AAAA** | An IPv6 address [@rfc3596] | The IPv6 counterpart to A. A name can have both. |
| **CNAME** | Another name: "this name is really that one" [@rfc1035] | The resolver follows it and looks up the target instead. |
| **HTTPS** / **SVCB** | Where and how to connect to a service: alternative names, ports, and supported protocols like HTTP/3 [@rfc9460] | Newer. Lets a browser learn about HTTP/3 before its first connection. |
| **Alias** (Route 53) | Another AWS resource, like a load balancer or CloudFront distribution | Not a real DNS type. Route 53 answers with the target's own A or AAAA records [@aws-route53-alias]. |

**Why there's no CNAME on the bare domain.** You can put a CNAME on `www.example.com`, but not on `example.com` itself, the bare domain with nothing in front (DNS people call it the root or apex of the zone). Two rules collide there. A name that has a CNAME can't have any other records, because a CNAME means "this name is really that other name" and nothing else [@rfc2181]. And the bare domain always has other records: an SOA record and NS records, because those are what make it a zone [@rfc1034], and usually MX and TXT records too.

It matters as soon as you want `example.com` itself to point at an Application Load Balancer. An ALB's IP addresses aren't fixed, so an A record is a bad fit, and a CNAME to the ALB's name isn't allowed. Route 53's alias records fill that gap: you point the bare domain at the ALB, and Route 53 looks up its current addresses and answers with those, so to everyone else it looks like an ordinary A record [@aws-route53-alias]. Other DNS providers offer the same thing under names like ALIAS, ANAME, or CNAME flattening, and the newer HTTPS record type is the standard way to do it for web traffic [@rfc9460].

### Running the zone

| Type | Holds | Notes |
|---|---|---|
| **NS** | The name servers responsible for a domain [@rfc1035] | The TLD's [referrals](#following-one-lookup) point at these, and they're what you set at your registrar. |
| **SOA** | "Start of authority": housekeeping for the zone [@rfc1035] | The primary name server, an admin contact, a serial number that goes up with each change, timers for secondary servers, and how long to cache "doesn't exist" answers [@rfc2308]. |

### Reverse lookups

| Type | Holds | Notes |
|---|---|---|
| **PTR** | A name, for an address [@rfc1035] | Lives under `in-addr.arpa` (IPv4) with the address backwards. Set by whoever owns the address block, usually your ISP or cloud provider, not by you. |

### Email

Email leans on DNS more than anything else, mostly through TXT records with special formats:

| Type | Holds | Notes |
|---|---|---|
| **MX** | The mail servers that accept email for the domain, each with a preference number [@rfc1035] | Lower numbers are tried first, so `10` before `20`. |
| **TXT**: SPF | Which servers are allowed to send email as the domain [@rfc7208] | Published as a TXT record starting `v=spf1`. There used to be a dedicated SPF record type, but it's been removed from the standard [@rfc7208]. |
| **TXT**: DKIM | The public key that checks the signature on outgoing email [@rfc6376] | Lives at `<selector>._domainkey.example.com`. |
| **TXT**: DMARC | What receivers should do with email that fails SPF or DKIM, and where to send reports [@rfc9989] | Lives at `_dmarc.example.com`. |

### Services and security

| Type | Holds | Notes |
|---|---|---|
| **TXT** (general) | Arbitrary text [@rfc1035] | Also how outside services check you control a domain, like the `_acme-challenge` record in [Certificates and Trust](/primers/networking/certificates-and-trust/#getting-a-certificate). |
| **SRV** | The host and port for a service, with priority and weight [@rfc2782] | Named `_service._protocol.example.com`. Used by protocols like SIP and XMPP and some directory services. |
| **CAA** | Which certificate authorities may issue certificates for the domain [@rfc8659] | Covered in [Certificates and Trust](/primers/networking/certificates-and-trust/#caa-records-can-block-a-ca-entirely). |

### DNSSEC

Plain DNS has no way to prove an answer is genuine. **DNSSEC** adds signatures so a resolver can check that an answer really came from the zone's owner and wasn't changed on the way [@rfc4033]. It adds its own record types [@rfc4034]:

| Type | Holds |
|---|---|
| **DNSKEY** | The zone's public signing keys. |
| **RRSIG** | A signature over a set of records. |
| **DS** | A fingerprint of a child zone's key, published in the **parent** zone. This is how trust chains down from the root, through the TLD, to your domain. |
| **NSEC** (and NSEC3) | Signed proof that a name or type doesn't exist, so "no such name" can't be forged either. |

### Less common

| Type | Holds |
|---|---|
| **NAPTR** | Rewrite rules for turning one kind of identifier into another, mostly used in telephony [@rfc3403]. |
| **SSHFP** | The fingerprint of a server's SSH key, so an SSH client can check it against DNS instead of asking you [@rfc4255]. |
| **TLSA** | A pin for a server's TLS certificate or CA, published in DNS (DANE). Only meaningful with DNSSEC [@rfc6698]. |

Route 53 supports 17 types: A, AAAA, CAA, CNAME, DS, HTTPS, MX, NAPTR, NS, PTR, SOA, SPF, SRV, SSHFP, SVCB, TLSA, and TXT, plus its own alias records [@aws-route53-record-types].

## Where Route 53 fits

Route 53 is AWS's DNS service, and it does a few separate jobs that are easy to blur together [@aws-route53-concepts]:

- **Domain registration.** Registering a domain makes you its owner. The registrar's main technical job is telling the TLD which name servers are authoritative for your domain. You can register a domain in one place and host its DNS somewhere else.
- **Authoritative DNS, through hosted zones.** A **hosted zone** is the set of records for one domain. When you create a public hosted zone, Route 53 assigns it four name servers and creates the zone's NS and SOA records. Those four name servers have to be the ones listed at your registrar, or the TLD's referrals will point somewhere else and your records won't be used [@aws-route53-public-zones].
- **Recursive resolution inside your VPCs.** Every VPC gets a resolver at its base address plus two (the reserved `.2` address from [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/#the-five-reserved-addresses)). It answers for names inside the VPC and looks everything else up on the internet [@aws-route53-resolver].

### Private hosted zones

A **private hosted zone** holds records that only answer inside the VPCs you associate with it, like `db.internal.example.com` pointing at a private address. A query from outside those VPCs doesn't see the private zone at all and gets looked up on the public internet instead [@aws-route53-private-zones]. So a laptop on a VPN can reach a private address but still fail to resolve its name, unless its DNS queries go to a resolver that can see the private zone.

The VPC resolver can bridge that gap in both directions: networks outside AWS can forward queries to it, and it can forward queries for chosen domains out to resolvers on another network. When forwarding rules overlap, the most specific domain wins [@aws-route53-resolver-forwarding], the same idea as [longest prefix match](/primers/networking/aws-vpc-subnets/#when-more-than-one-route-matches) in route tables.

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
