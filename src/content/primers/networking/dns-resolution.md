---
title: How DNS resolution works
description: The steps between typing a name and connecting to an address, who answers each question along the way, why changes take time to show up, and where Route 53 fits.
order: 2
updated: 2026-10-09
---

Every connection starts with a lookup. Before a browser can talk to `www.example.com`, something has to turn that name into an address like `203.0.113.10`, and DNS (the Domain Name System) is how that happens [@rfc1034]. It's usually invisible, and it's behind a surprising number of "it works on my machine" problems.

This primer is about the lookup itself, with [every record type you're likely to meet](#record-types) at the end as a reference.

## Reading a domain name

A name like `www.example.com` reads most naturally right to left, because that's the order DNS works through it. Each part between the dots is a **label**, and the labels form a tree with the root at the top [@rfc1034]:

<div class="dns-tree" role="img" aria-label="The domain name tree. The root, written as a single dot, is at the top. Under it are the top-level domains com, org, and net. Under com is example, and under example are www, app, api, and mail. Dashed boxes mark three zones and who answers for each: the root zone, answered by the root servers; the com zone, answered by the .com TLD servers; and the example.com zone, which holds example and everything under it, answered by example.com's authoritative servers. org and net are separate zones too. The lines that cross from one zone into the next are delegations, made with NS records.">
<svg viewBox="0 0 400 246" aria-hidden="true" focusable="false">
<rect class="dt-zone" x="160" y="6" width="80" height="40" rx="6"/>
<text class="dt-zname" x="248" y="23">root zone</text>
<text class="dt-who" x="248" y="34">root servers</text>
<line class="dt-deleg" x1="200" y1="37" x2="120" y2="80"/>
<line class="dt-deleg" x1="200" y1="37" x2="230" y2="80"/>
<line class="dt-deleg" x1="200" y1="37" x2="310" y2="80"/>
<text class="dt-ns dt-end" x="152" y="56">NS</text>
<g class="dt-node"><rect x="172" y="15" width="56" height="22" rx="4"/><text x="200" y="30">. (root)</text></g>
<rect class="dt-zone" x="84" y="70" width="72" height="42" rx="6"/>
<text class="dt-zname dt-end" x="78" y="82">com zone</text>
<text class="dt-who dt-end" x="78" y="93">.com TLD</text>
<text class="dt-who dt-end" x="78" y="103">servers</text>
<rect class="dt-zone dt-zone-other" x="196" y="70" width="68" height="42" rx="6"/>
<rect class="dt-zone dt-zone-other" x="276" y="70" width="68" height="42" rx="6"/>
<text class="dt-who dt-mid" x="270" y="126">separate zones too</text>
<g class="dt-node"><rect x="96" y="80" width="48" height="22" rx="4"/><text x="120" y="95">com</text></g>
<g class="dt-node"><rect x="206" y="80" width="48" height="22" rx="4"/><text x="230" y="95">org</text></g>
<g class="dt-node"><rect x="286" y="80" width="48" height="22" rx="4"/><text x="310" y="95">net</text></g>
<line class="dt-deleg" x1="120" y1="102" x2="120" y2="150"/>
<text class="dt-ns" x="126" y="130">NS (delegation)</text>
<rect class="dt-zone" x="14" y="140" width="212" height="98" rx="6"/>
<text class="dt-zname" x="234" y="178">example.com zone</text>
<text class="dt-who" x="234" y="189">example.com's</text>
<text class="dt-who" x="234" y="199">authoritative</text>
<text class="dt-who" x="234" y="209">servers</text>
<line class="dt-edge" x1="120" y1="172" x2="44" y2="200"/>
<line class="dt-edge" x1="120" y1="172" x2="96" y2="200"/>
<line class="dt-edge" x1="120" y1="172" x2="148" y2="200"/>
<line class="dt-edge" x1="120" y1="172" x2="200" y2="200"/>
<g class="dt-node"><rect x="86" y="150" width="68" height="22" rx="4"/><text x="120" y="165">example</text></g>
<g class="dt-node"><rect x="24" y="200" width="40" height="22" rx="4"/><text x="44" y="215">www</text></g>
<g class="dt-node"><rect x="76" y="200" width="40" height="22" rx="4"/><text x="96" y="215">app</text></g>
<g class="dt-node"><rect x="128" y="200" width="40" height="22" rx="4"/><text x="148" y="215">api</text></g>
<g class="dt-node"><rect x="180" y="200" width="40" height="22" rx="4"/><text x="200" y="215">mail</text></g>
</svg>
</div>
<p class="bitgrid-caption">Reading <code>www.example.com</code> from the bottom up: <code>www</code>, then <code>example</code>, then <code>com</code>, then the root. Each dashed box is a zone, and the teal lines are where one zone hands off to the next.</p>

- **The root** sits at the top of the tree, above every TLD. Its label is empty, zero characters long, and that's why it shows up as nothing but a trailing dot: the full form of `www.example.com` is `www.example.com.`, where the last dot separates `com` from the root's empty label [@rfc1034]. The label is empty because there's only one root and every name ends there, so it needs nothing to tell it apart. It has nothing to do with where the root servers are: a name never contains server addresses at any level, and resolvers find the root servers a different way, covered in [why there's a root](#why-theres-a-root) below. A file path works the same way. In `/usr/bin`, the leading `/` is the root directory, which has no name of its own either. DNS just writes names in the other order, most specific first, so `www.example.com.` read right to left is the path `/com/example/www`, and the root's `/` becomes the trailing dot.
- **`com`** is a **top-level domain (TLD)**, one level below the root.
- **`example`** is the **second-level domain**, the part someone registers and owns.
- **`www`** is a **subdomain**. The owner can make as many as they like (`app`, `api`, `mail`), and each one can point somewhere different.

Nobody runs the whole tree. It's split into **zones**, each a connected piece of the tree run by one organization and answered by one set of name servers [@rfc1034]. The dashed boxes are zones. The root zone only knows about the TLDs, the `com` zone only knows about the domains registered under it, and the `example.com` zone holds the actual records for `example.com` and everything under it (unless its owner splits a piece off into a zone of its own).

Handing part of the tree to someone else is called **delegation**. The parent zone keeps **NS records** (name server records) that say which servers answer for the child zone, and those records are the pointers across each zone boundary [@rfc1034]. The `com` zone has NS records for `example.com` and very little else about it: no web server addresses, no mail servers. So a lookup has to hop from zone to zone, following NS records down the tree.

### Why there's a root

The server that does lookups on your behalf, a **recursive resolver** ([more on it below](#whos-involved)), starts out knowing nothing about any domain. To look up a name it has never seen, it needs a fixed place to start, and that place has to lead to every name that exists. The root is that place. The root zone is mostly one list: every TLD, and the name servers that answer for each one [@iana-root-zone]. There are 1,437 TLDs as of October 2026 [@iana-tld-list], and new ones get added, so expecting every resolver in the world to keep its own up-to-date copy of all their servers wouldn't work.

So the list lives in one zone, and every resolver only has to know where that zone is. Resolver software ships with a small file called the **root hints**, the names and addresses of the root servers, which is all it needs to get started [@iana-root-files]. RFC 1034 gives the same reason for starting from root servers when a resolver has nothing better: they "provide eventual access to all of the domain space" [@rfc1034].

<div class="root-why" role="img" aria-label="Two panels. Left, without a root: a resolver would need lines to the servers of every TLD, shown as com, org, net, uk, de, and io, plus 1,431 more, and every resolver would have to keep that list up to date. Right, with a root: the resolver only knows the 13 root server names from its root hints file. The root zone holds the one list of all 1,437 TLDs and their servers.">
<svg viewBox="0 0 400 148" aria-hidden="true" focusable="false">
<defs><marker id="rt-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rt-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="rt-title" x="97" y="12">Without a root</text>
<rect class="rt-box" x="47" y="22" width="100" height="22" rx="4"/>
<text class="rt-name" x="97" y="37">every resolver</text>
<g class="rt-node"><rect x="9" y="80" width="26" height="18" rx="3"/><text x="22" y="93">com</text></g><line class="rt-edge" x1="97" y1="44" x2="22" y2="79"/><g class="rt-node"><rect x="39" y="80" width="26" height="18" rx="3"/><text x="52" y="93">org</text></g><line class="rt-edge" x1="97" y1="44" x2="52" y2="79"/><g class="rt-node"><rect x="69" y="80" width="26" height="18" rx="3"/><text x="82" y="93">net</text></g><line class="rt-edge" x1="97" y1="44" x2="82" y2="79"/><g class="rt-node"><rect x="99" y="80" width="26" height="18" rx="3"/><text x="112" y="93">uk</text></g><line class="rt-edge" x1="97" y1="44" x2="112" y2="79"/><g class="rt-node"><rect x="129" y="80" width="26" height="18" rx="3"/><text x="142" y="93">de</text></g><line class="rt-edge" x1="97" y1="44" x2="142" y2="79"/><g class="rt-node"><rect x="159" y="80" width="26" height="18" rx="3"/><text x="172" y="93">io</text></g><line class="rt-edge" x1="97" y1="44" x2="172" y2="79"/>
<text class="rt-small" x="97" y="116">+ 1,431 more TLDs,</text>
<text class="rt-small" x="97" y="128">each list kept up to date</text>
<text class="rt-small" x="97" y="140">by every resolver</text>
<line class="rt-divider" x1="200" y1="4" x2="200" y2="144"/>
<text class="rt-title" x="302" y="12">With a root</text>
<rect class="rt-box" x="252" y="22" width="100" height="22" rx="4"/>
<text class="rt-name" x="302" y="37">every resolver</text>
<line class="rt-arrow" x1="302" y1="44" x2="302" y2="56" marker-end="url(#rt-head)"/>
<rect class="rt-box rt-root" x="217" y="58" width="170" height="30" rx="4"/>
<text class="rt-name" x="302" y="72">root servers</text>
<text class="rt-small" x="302" y="83">13 names, from the root hints</text>
<line class="rt-arrow" x1="302" y1="88" x2="302" y2="100" marker-end="url(#rt-head)"/>
<rect class="rt-box" x="217" y="102" width="170" height="30" rx="4"/>
<text class="rt-name" x="302" y="116">root zone: one list</text>
<text class="rt-small" x="302" y="127">com, org, net, … all 1,437 TLDs</text>
</svg>
</div>

<p class="bitgrid-caption">The root moves the list of TLDs into one zone, served by 12 organizations, so each resolver only needs to know where the root is. In practice resolvers rarely ask it at all, because the TLD referrals it hands out <a href="#caching-ttls-and-propagation">get cached</a>.</p>

## Who's involved

Two different jobs get called "DNS servers," and mixing them up makes the rest confusing:

- A **resolver** asks questions on your behalf until it finds an answer. It doesn't own any names.
- A **name server** answers questions about the names it's responsible for. It doesn't go looking for anything.

There are five players in a typical lookup:

| Who | Job |
|---|---|
| **Stub resolver** | The small piece of your operating system that apps ask. "Stub" means minimal: it can't search on its own, and it only knows the address of a recursive resolver to hand every question to [@rfc1034]. |
| **Recursive resolver** | Does all the legwork: asks the other servers, follows their pointers, caches what it learns. Run by your ISP, your company, your cloud provider, or a public service. |
| **Root name servers** | Know which name servers handle each TLD. There are 13 root server names, run by 12 organizations, served from about two thousand instances around the world [@root-servers]. |
| **TLD name servers** | Know which name servers are responsible for each domain under their TLD (every `*.com`, for example). |
| **Authoritative name servers** | Hold the actual records for a zone and give the real answer. Run by whoever hosts the domain's DNS, like Route 53. |

**Recursive** describes what you get from the resolver, not how the lookup travels. You ask it once, and it does the whole job and hands back a final answer or an error, never a pointer to somewhere else [@rfc1034]. The servers it asks work the other way. They answer only from what they already hold, which is either the answer or a referral to a server closer to it [@rfc1034]. Nothing gets passed from one of them to the next.

## Following one lookup

The first time a laptop looks up `www.example.com`, with nothing cached anywhere, the recursive resolver goes out three times:

<div class="dns-walk" role="img" aria-label="Sequence diagram of one lookup across five lanes: the laptop (browser and stub resolver), the recursive resolver, a root server, a .com TLD server, and example.com's authoritative server. The laptop asks the recursive resolver for www.example.com. The resolver asks a root server, which replies with a referral: ask the .com servers. The resolver asks a .com server, which replies with a referral: ask ns1.example.com. The resolver asks example.com's authoritative server, which replies with the answer, A 203.0.113.10. The resolver hands 203.0.113.10 back to the laptop. The root, TLD, and authoritative servers only ever talk to the resolver, never to each other.">
<svg viewBox="0 0 400 284" aria-hidden="true" focusable="false">
<defs><marker id="dw-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="dw-head" d="M0,0 L8,4 L0,8 z"/></marker><marker id="dw-head-ans" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="dw-head-ans" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="dw-actor" x="34" y="14">Laptop</text>
<text class="dw-role" x="34" y="25">browser + stub</text>
<text class="dw-actor" x="118" y="14">Recursive</text>
<text class="dw-role" x="118" y="25">resolver</text>
<text class="dw-actor" x="205" y="14">Root</text>
<text class="dw-role" x="205" y="25">server</text>
<text class="dw-actor" x="286" y="14">.com TLD</text>
<text class="dw-role" x="286" y="25">server</text>
<text class="dw-actor" x="360" y="14">example.com</text>
<text class="dw-role" x="360" y="25">authoritative</text>
<line class="dw-life" x1="34" y1="32" x2="34" y2="276"/>
<line class="dw-life" x1="118" y1="32" x2="118" y2="276"/>
<line class="dw-life" x1="205" y1="32" x2="205" y2="276"/>
<line class="dw-life" x1="286" y1="32" x2="286" y2="276"/>
<line class="dw-life" x1="360" y1="32" x2="360" y2="276"/>
<line class="dw-msg" x1="34" y1="56" x2="118" y2="56" marker-end="url(#dw-head)"/>
<text class="dw-label dw-mid" x="76" y="51">www.example.com?</text>
<line class="dw-msg" x1="118" y1="88" x2="205" y2="88" marker-end="url(#dw-head)"/>
<text class="dw-label" x="124" y="83">www.example.com?</text>
<line class="dw-msg dw-ref" x1="205" y1="112" x2="118" y2="112" marker-end="url(#dw-head)"/>
<text class="dw-label dw-ref-text" x="124" y="107">referral: ask the .com servers</text>
<line class="dw-msg" x1="118" y1="144" x2="286" y2="144" marker-end="url(#dw-head)"/>
<text class="dw-label" x="124" y="139">www.example.com?</text>
<line class="dw-msg dw-ref" x1="286" y1="168" x2="118" y2="168" marker-end="url(#dw-head)"/>
<text class="dw-label dw-ref-text" x="124" y="163">referral: ask ns1.example.com</text>
<line class="dw-msg" x1="118" y1="200" x2="360" y2="200" marker-end="url(#dw-head)"/>
<text class="dw-label" x="124" y="195">www.example.com?</text>
<line class="dw-msg dw-ans" x1="360" y1="224" x2="118" y2="224" marker-end="url(#dw-head-ans)"/>
<text class="dw-label dw-ans-text" x="124" y="219">A 203.0.113.10</text>
<line class="dw-msg dw-ans" x1="118" y1="256" x2="34" y2="256" marker-end="url(#dw-head-ans)"/>
<text class="dw-label dw-ans-text dw-mid" x="76" y="251">203.0.113.10</text>
</svg>
</div>
<p class="bitgrid-caption">Dashed arrows are referrals, solid teal arrows carry the answer. Every query starts at the recursive resolver.</p>

1. **The browser asks the operating system** (the stub resolver) for the address of `www.example.com`.
2. **The stub resolver asks the recursive resolver** it's configured to use. From here on, the recursive resolver does all the work.
3. **The recursive resolver asks three servers in turn.** A root server doesn't know the answer and replies with a **referral**, the NS records for `.com`. A `.com` TLD server doesn't know it either and refers the resolver to `example.com`'s name servers. One of those is authoritative for the zone, so it has the record and answers: `www.example.com` is `203.0.113.10`.
4. **The recursive resolver hands the answer back to the stub resolver,** which hands it to the browser, and the browser connects to `203.0.113.10`.

Two details trip people up:

- **The root and TLD servers never go find the answer themselves.** They point the recursive resolver to the next server to ask, and the recursive resolver makes every query itself. The root server never talks to the TLD server, and the TLD server never talks to the authoritative one.
- **The answer doesn't travel back through the chain.** The recursive resolver already has it after the third query and gives it straight to your machine.

A directory helpline works the same way. You call the helpline and ask for the number of someone at Example Corp. The operator doesn't know it, so they call a national directory, which says "I don't have that, but call the business directory on this number." The business directory says "I don't have it either, but call Example Corp's front desk on this number." The front desk knows its own staff and gives the operator the number, and the operator passes it back to you. The helpline is the recursive resolver, the national directory is a root server, the business directory is the `.com` TLD server, and Example Corp's front desk is the authoritative name server. The operator makes every call, and you only ever talk to the helpline.

## Caching, TTLs, and "propagation"

That full walk is rare. Every answer comes with a **TTL** (time to live), in seconds, and the recursive resolver keeps the answer that long before asking again [@rfc1035]. Referrals get cached too, so a busy resolver almost never needs the root servers, and usually not the TLD servers either. Your operating system and browser keep their own small caches on top of that.

Caching explains "DNS propagation." When you change a record, the authoritative server has the new value immediately, but every resolver that cached the old value keeps using it until its TTL runs out. Nothing is propagating. Old copies are expiring.

Say `www.example.com` has a TTL of 3600 seconds (an hour) and you move it to a new address at 12:00. One resolver happened to look it up at 11:30:

| Time | TTL left at 3600 | TTL lowered to 300 the day before |
|---|---|---|
| The day before | Nothing changes. | You lower the TTL to 300. Copies cached under the old 3600-second TTL run out within the hour. |
| 11:30 | The resolver caches the old address until 12:30. | The resolver caches the old address until 11:35. |
| 12:00 | You change the record. The authoritative server gives the new address straight away. | Same. |
| 12:00 to 12:30 | The resolver keeps handing out the old address. | The 11:30 copy expired at 11:35. Any copy the resolver fetched again before 12:00 expires by 12:05. |
| Last moment anyone can get the old address | 13:00, from a resolver that cached it just before 12:00 | 12:05 |

That's why the usual advice before moving a site is to lower the record's TTL a day or so ahead, so the old copies expire quickly when you make the switch, and raise it again afterward. The lower TTL has to go in at least one old TTL early, because resolvers holding the old copy don't see the change to the TTL either until their copy expires.

"This name doesn't exist" gets cached too. If a resolver looks up a name before you've created it, it remembers the failure for as long as the last number in the zone's [SOA record](#reading-the-zone-file) says (or the SOA record's own TTL, if that's shorter), and keeps saying the name doesn't exist even after you add it [@rfc2308].

## Which resolver your machine uses

The recursive resolver usually comes from your network's settings, [handed out along with your IP address](/primers/networking/osi-model/#dhcp-how-a-device-gets-its-settings). To see which one you're using:

```bash tab="macOS / Linux"
scutil --dns              # macOS: the full resolver configuration
cat /etc/resolv.conf      # Linux: the resolver your programs are told to use
resolvectl status         # Linux with systemd-resolved: the real upstream resolvers
```

```powershell tab="Windows (PowerShell)"
Get-DnsClientServerAddress    # DNS servers for each network interface
```

`Get-DnsClientServerAddress` lists the DNS server addresses for each network interface [@ms-get-dnsclientserveraddress].

On many Linux systems `/etc/resolv.conf` lists only `127.0.0.53`. That's an address on the machine itself, where systemd-resolved runs a local caching stub resolver, so the file doesn't tell you which resolver does the lookups [@systemd-resolved]. `resolvectl status` shows the DNS servers in effect, globally and for each network link [@systemd-resolvectl].

That configuration can include more than one resolver, and some only apply to certain domains. A machine on a VPN might send `*.corp.example.com` to the company's resolver and everything else to the normal one. That's **split DNS**, and it's why a name can resolve with the VPN up and fail without it, or resolve to a different address depending on which resolver answered. It's also step 7 in the [checklist for reaching private resources](/primers/networking/reaching-private-resources/#connected-but-cant-reach-it).

<details class="aside">
<summary>Why <code>scutil --dns</code> lists so many resolvers</summary>

On a Mac at home, `scutil --dns` often prints seven or more numbered resolvers, which looks like far too many. Usually only the first does ordinary lookups. A shortened example:

```text
resolver #1
  nameserver[0] : 2001:db8::53
  nameserver[1] : 192.0.2.53
  if_index : 14 (en0)
  reach    : 0x00000002 (Reachable)
resolver #2
  domain   : local
  options  : mdns
  reach    : 0x00000000 (Not Reachable)
resolver #3
  domain   : 254.169.in-addr.arpa
  options  : mdns
resolver #4
  domain   : 8.e.f.ip6.arpa
  options  : mdns
  ... (#5 to #7 are 9.e.f, a.e.f, and b.e.f.ip6.arpa)
```

- **Resolver #1 is the default.** It has the server addresses from your network settings, often two IPv6 and two IPv4 so there's a backup of each, and no `domain` line. The manual page for `scutil` says the first one listed is the default, and the ones after it that name a `domain` are only used for names in that domain [@scutil-man].
- **The rest send local names to multicast DNS.** `options : mdns` means "don't ask a server, ask the devices on this network directly," which is **multicast DNS (mDNS)**, the protocol behind finding printers and other computers by name [@rfc6762]. They have no server addresses, so `reach` says Not Reachable, and that's expected.
- **`local`** covers names like `my-printer.local`, which mDNS owns [@rfc6762].
- **`254.169.in-addr.arpa`** covers reverse lookups for **link-local** IPv4 addresses, the `169.254/16` range a device gives itself when nothing on the network hands it one [@rfc3927]. Names for those addresses only mean something on the local network, so the mDNS standard sends their lookups there too [@rfc6762].
- **`8.e.f` through `b.e.f.ip6.arpa`** do the same for IPv6 link-local addresses, `fe80::/10` [@rfc4291, @rfc6762]. It takes four entries because reverse DNS writes an IPv6 address one hex digit at a time, backwards [@rfc3596]. A `/10` fixes the first two digits, `fe`, and only half of the third, which leaves four possible third digits, `8`, `9`, `a`, and `b`. Each gets its own entry, written backwards as `8.e.f` and so on.

A second list underneath, headed "for scoped queries", repeats the servers once for each network interface, such as `en0` for Wi-Fi and another `en` number for a wired adapter. A VPN or a domain-specific setting adds entries of its own, like the `*.corp.example.com` example above.

</details>

## Watching it happen

`dig` shows a single lookup in detail, including the TTL on each record [@bind9-dig]. On Windows, `Resolve-DnsName` does the same job [@ms-resolve-dnsname]:

```bash tab="macOS / Linux"
dig www.example.com
dig www.example.com @192.0.2.53           # ask a specific resolver (put its address here)
dig +short www.example.com                # just the answer
dig +trace www.example.com                # walk root → TLD → authoritative yourself
```

```powershell tab="Windows (PowerShell)"
Resolve-DnsName www.example.com
Resolve-DnsName www.example.com -Server 192.0.2.53   # ask a specific resolver (put its address here)
```

| Option | What it does |
|---|---|
| `@192.0.2.53` | Sends the question to that server instead of the resolver from your system settings [@bind9-dig]. `-Server` does the same for `Resolve-DnsName` [@ms-resolve-dnsname]. |
| `+short` | Prints a terse answer, usually just the values, without the sections and comments [@bind9-dig]. |
| `+trace` | Skips your recursive resolver and walks the tree itself, starting at the root and following each referral [@bind9-dig]. `Resolve-DnsName` has no equivalent. |
| `-x` | Reverse lookup, from an address to a name [@bind9-dig]. See [reverse lookups](#reverse-lookups). |

### Reading dig's output

Plain `dig www.example.com` prints something like this. It's trimmed, the addresses are changed to documentation ranges, and it's shown as if `example.com` used the [zone in Record types](#record-types), where `www` is a CNAME:

```
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 2716
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; QUESTION SECTION:
;www.example.com.               IN      A

;; ANSWER SECTION:
www.example.com.        300     IN      CNAME   example.com.
example.com.            300     IN      A       203.0.113.10

;; Query time: 48 msec
;; SERVER: 192.168.1.1#53(192.168.1.1)
```

- **`status: NOERROR`** means the lookup worked. **`NXDOMAIN`** means the name doesn't exist at all [@rfc2308], and **`SERVFAIL`** means the server hit a problem and couldn't answer [@rfc1035].
- **`flags: rd ra`** are "recursion desired" (dig asked for the whole job) and "recursion available" (the server offers it) [@rfc1035], the [recursive](#whos-involved) part from earlier.
- **`QUESTION SECTION`** repeats what was asked: the name and the record type, `A` unless you ask for another.
- **`ANSWER SECTION`** has one record per line: the name, the **TTL**, the class (`IN`, for internet, on nearly everything), the type, and the value. The first line is the CNAME, and the resolver followed it and included `example.com`'s A record on the second line.
- **`SERVER`** is the resolver that answered, with the port after the `#`. Here it's the home router at `192.168.1.1`. On Linux with systemd-resolved it's usually `127.0.0.53`.
- **`Query time`** is how long the answer took, including any walk the resolver had to do.

Run the same command a minute later, and the same resolver answers from its cache:

```
;; ANSWER SECTION:
www.example.com.        241     IN      CNAME   example.com.
example.com.            241     IN      A       203.0.113.10

;; Query time: 2 msec
```

The TTL has counted down by the 59 seconds the record has spent in the cache, and the query time is now just the trip to the resolver and back. When the TTL reaches zero, the resolver drops its copy and the next query goes out again.

### Following the referrals with +trace

`dig +trace` shows the walk from [Following one lookup](#following-one-lookup). Trimmed (it also prints DNSSEC records, which `+trace` turns on [@bind9-dig]) and with addresses changed, it looks like this:

```
.                       518400  IN      NS      a.root-servers.net.
.                       518400  IN      NS      b.root-servers.net.
;; Received 1097 bytes from 192.168.1.1#53(192.168.1.1) in 13 ms

com.                    172800  IN      NS      a.gtld-servers.net.
com.                    172800  IN      NS      b.gtld-servers.net.
;; Received 1175 bytes from 198.51.100.42#53(l.root-servers.net) in 35 ms

example.com.            172800  IN      NS      ns1.example.com.
example.com.            172800  IN      NS      ns2.example.net.
;; Received 510 bytes from 198.51.100.30#53(f.gtld-servers.net) in 46 ms

www.example.com.        300     IN      CNAME   example.com.
example.com.            300     IN      A       203.0.113.10
;; Received 183 bytes from 203.0.113.53#53(ns1.example.com) in 20 ms
```

Each block ends with a `Received ... from` line naming the server that sent it:

- **First block, from your own resolver:** the list of root servers. That's the only question your resolver gets, and with `@server` it goes to that server instead [@bind9-dig].
- **Second block, from a root server:** step 3's first referral, the NS records for `com`.
- **Third block, from a `.com` server:** the second referral, the NS records for `example.com`.
- **Last block, from `ns1.example.com`:** the answer, from the authoritative server.

<details class="aside">
<summary>Watching the packets</summary>

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

In the `tcpdump` command, `-i any` captures on every network interface at once [@tcpdump-man], and `udp port 53` is a filter that keeps only UDP packets to or from port 53 [@pcap-filter-man]. On Windows, `pktmon filter add -p 53` sets up the same port filter, `-c` turns on packet capture, and `-m real-time` prints packets on screen instead of writing a log file [@ms-pktmon-syntax, @ms-pktmon-start].

The cache commands come from each system's own documentation [@apple-dns-cache, @systemd-resolvectl, @ms-clear-dnsclientcache]. `curl.exe` is spelled out because in Windows PowerShell 5.1 plain `curl` is an alias for a different command [@ms-curl-windows].

The first request shows the queries going out. Repeat it and there's little or nothing, because the answer is cached. If you see nothing even the first time, your browser or system may be using **DNS over HTTPS**, which sends lookups inside ordinary encrypted HTTPS traffic on port 443 [@rfc8484], so a filter on port 53 never sees them.

</details>

## Where Route 53 fits

Route 53 is AWS's DNS service, and it does a few separate jobs that are easy to blur together [@aws-route53-concepts]:

- **Domain registration.** Registering a domain makes you its owner. The registrar's main technical job is telling the TLD which name servers are authoritative for your domain, which puts the [delegation](#reading-a-domain-name) in place. You can register a domain in one place and host its DNS somewhere else.
- **Authoritative DNS, through hosted zones.** A **hosted zone** is the set of records for one zone. When you create a public hosted zone, Route 53 assigns it four name servers and creates the zone's NS and SOA records. Those four name servers have to be the ones listed at your registrar, or the TLD's referrals will point somewhere else and your records won't be used [@aws-route53-public-zones].
- **Recursive resolution inside your VPCs.** Every VPC gets a resolver at its base address plus two, so a VPC using `10.0.0.0/16` has its resolver at `10.0.0.2` [@aws-vpc-amazon-dns]. That's the reserved `.2` address from [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/#the-five-reserved-addresses). It answers for names inside the VPC and looks everything else up on the internet [@aws-route53-resolver].

### Alias records and the zone apex

The name of a zone itself, `example.com` with nothing in front, is called the **zone apex** (people also say bare or naked domain) [@aws-route53-alias]. It's the top node of that one zone [@rfc1034] and has nothing to do with the root servers or the root of the tree.

You can put a CNAME on `www.example.com`, but not on the apex. Two rules collide there. A name that has a CNAME can't have any other records, because a CNAME means "this name is really that other name" and nothing else [@rfc2181]. And the apex always has other records: an SOA record and NS records, because those are what make it a zone [@rfc1034], and usually MX and TXT records too.

It matters as soon as you want `example.com` itself to point at an Application Load Balancer. An ALB's IP addresses aren't fixed, so an A record is a bad fit, and a CNAME to the ALB's name isn't allowed. Route 53's alias records fill that gap: you point the apex at the ALB, and Route 53 looks up its current addresses and answers with those, so to everyone else it looks like an ordinary A record [@aws-route53-alias]. Other DNS providers offer the same thing under names like ALIAS, ANAME, or CNAME flattening, and the newer HTTPS record type is the standard way to do it for web traffic [@rfc9460].

### Private hosted zones

A **private hosted zone** holds records that only answer inside the VPCs you associate with it. A query from outside those VPCs doesn't see the private zone at all and gets looked up on the public internet instead [@aws-route53-private-zones]. A private zone for `internal.example.com` might hold:

| Name | Type | Value |
|---|---|---|
| `db.internal.example.com` | A | `10.0.1.25` |
| `cache.internal.example.com` | A | `10.0.2.40` |

An instance in an associated VPC asks the VPC resolver at `10.0.0.2` for `db.internal.example.com` and gets `10.0.1.25`. A laptop at home asks its usual resolver, which looks on the public internet and finds no such name. So a laptop on a VPN can reach a private address but still fail to resolve its name, unless its DNS queries go to a resolver that can see the private zone.

Route 53 Resolver can bridge that gap in both directions, through endpoints you create in the VPC:

- An **inbound endpoint** is an address in your VPC that accepts DNS queries from outside it. Resolvers on an office network, reached over a VPN or Direct Connect, send queries for the private names there and get answers from the private zones associated with that VPC [@aws-route53-resolver-inbound, @aws-route53-private-zones]. Sending those queries straight to the VPC's `.2` address from outside isn't supported, and AWS recommends an inbound endpoint instead [@aws-route53-resolver-forwarding].
- An **outbound endpoint** goes the other way. With forwarding rules, the VPC resolver sends queries for chosen domains out to resolvers on another network. When rules overlap, the most specific domain wins [@aws-route53-resolver-forwarding], the same idea as [longest prefix match](/primers/networking/aws-vpc-subnets/#when-more-than-one-route-matches) in route tables.

### Routing policies

A plain record always returns the same answer. Route 53 can also choose between several answers for the same name [@aws-route53-routing-policies]:

| Policy | Chooses based on |
|---|---|
| Simple | Nothing. One answer. |
| Weighted | Proportions you set, like 90% to the current version and 10% to a new one |
| Failover | A health check: the primary while it's healthy, a standby when it isn't |
| Latency | Whichever AWS Region gives the person asking the lowest latency |

There are a few more that choose by location or by the asker's address range, all listed in [AWS's guide to routing policies](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html).

A routing policy only decides which address goes in the answer [@aws-route53-routing-policies]. The client then connects to that address directly, and none of the traffic itself passes through Route 53. Despite the name, routing policies have nothing to do with [route tables](/primers/networking/aws-vpc-subnets/#route-tables).

All of these happen at lookup time, so caching still applies. If a failover record has a five-minute TTL, some people keep getting the old answer for up to five minutes after the switch, which is why failover records usually have short TTLs.

## Record types

Every record has a name, a TTL, a type, and a value. A small zone for `example.com` with most of the types you'll come across, in the format DNS servers use for zone files, looks like this:

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
```

### Reading the zone file

| Column | Example | Meaning |
|---|---|---|
| Name | `www.example.com.` | The name the record belongs to |
| TTL | `300` | How many seconds a resolver may cache it |
| Type | `CNAME` | What kind of record it is |
| Value | `example.com.` | The data, in a format that depends on the type |

Real zone files and `dig` output often have one more column between the TTL and the type, the class, which is `IN` on nearly everything and left out here [@rfc1035].

**Names end in a dot** because that dot is the root. A name with the trailing dot is complete. Without it, a zone file treats the name as relative and adds the zone's own name to the end, so a forgotten dot turns `example.com` into `example.com.example.com.` [@rfc1035].

**The SOA line** packs the zone's housekeeping into one record [@rfc1035]:

| Field | Value | Meaning |
|---|---|---|
| Primary name server | `ns1.example.com.` | The original source of the zone's data |
| Admin mailbox | `admin.example.com.` | `admin@example.com`, with the first dot standing in for the `@` |
| Serial | `2026100601` | A version number that goes up with every change, so secondary name servers can tell their copy is out of date. This one is the date plus a counter [@rfc1034]. |
| Refresh | `7200` | How often secondary servers check for a new version, in seconds |
| Retry | `900` | How long a secondary waits before trying again after a failed check |
| Expire | `1209600` | How long a secondary keeps answering if it can't reach the primary (two weeks) |
| Negative TTL | `300` | How long resolvers may cache "this name doesn't exist" [@rfc2308] |

**The `www` CNAME** turns a lookup for `www.example.com` into a lookup for `example.com`, which has the A record. The resolver follows it and returns both [@rfc1034], which is why [dig shows two lines](#reading-digs-output) in its answer: the CNAME, then `example.com`'s A record.

There are over a hundred registered record types [@iana-dns-rr-types], but most are obsolete or experimental. These are the ones that matter in practice, grouped by what they're for.

### Addresses and aliases

| Type | Holds | Notes |
|---|---|---|
| **A** | An IPv4 address [@rfc1035] | The most common record there is. |
| **AAAA** | An IPv6 address [@rfc3596] | The IPv6 counterpart to A. A name can have both. |
| **CNAME** | Another name: "this name is really that one" [@rfc1035] | The resolver follows it and looks up the target instead. Not allowed at the [zone apex](#alias-records-and-the-zone-apex). |
| **HTTPS** / **SVCB** | Where and how to connect to a service: alternative names, ports, and supported protocols like HTTP/3 [@rfc9460] | Newer. Lets a browser learn about HTTP/3 before its first connection. |
| **Alias** (Route 53) | Another AWS resource, like a load balancer or CloudFront distribution | Not a real DNS type. Route 53 answers with the target's own A or AAAA records [@aws-route53-alias]. See [alias records](#alias-records-and-the-zone-apex). |

### Running the zone

| Type | Holds | Notes |
|---|---|---|
| **NS** | The name servers responsible for a zone [@rfc1035] | The TLD's [referrals](#following-one-lookup) point at these, and they're what you set at your registrar. |
| **SOA** | "Start of authority": housekeeping for the zone [@rfc1035] | The primary name server, an admin contact, a serial number, timers for secondary servers, and how long to cache "doesn't exist" answers [@rfc2308]. [Broken down above](#reading-the-zone-file). |

### Reverse lookups

| Type | Holds | Notes |
|---|---|---|
| **PTR** | A name, for an address [@rfc1035] | Lives under `in-addr.arpa` (IPv4) with the address backwards. Set by whoever owns the address block, usually your ISP or cloud provider, not by you. |

To go from an address to a name, use `dig -x` (plain `dig 203.0.113.10` treats the address as a name and won't find anything). Reverse lookups use PTR records under a special domain, with the address written backwards: `203.0.113.10` is looked up as `10.113.0.203.in-addr.arpa` [@rfc1035], and `dig -x` builds that name for you [@bind9-dig]. In PowerShell, ask for the PTR record by the backwards name [@ms-resolve-dnsname]:

```bash tab="macOS / Linux"
dig -x 203.0.113.10
```

```powershell tab="Windows (PowerShell)"
Resolve-DnsName 10.113.0.203.in-addr.arpa -Type PTR
```

The PTR record isn't in the `example.com` zone from earlier. It lives in a zone under `in-addr.arpa` run by whoever owns the `203.0.113.0/24` block [@rfc1035], and there it looks like this:

```
10.113.0.203.in-addr.arpa.  3600  PTR  example.com.
```

It's a quick way to see who runs a resolver or server, when the owner has set one up.

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

<details class="aside">
<summary>DNSSEC record types</summary>

Plain DNS has no way to prove an answer is genuine. **DNSSEC** adds signatures so a resolver can check that an answer really came from the zone's owner and wasn't changed on the way [@rfc4033]. It adds its own record types [@rfc4034]:

| Type | Holds |
|---|---|
| **DNSKEY** | The zone's public signing keys. |
| **RRSIG** | A signature over a set of records. |
| **DS** | A fingerprint of a child zone's key, published in the **parent** zone. This is how trust chains down from the root, through the TLD, to your domain. |
| **NSEC** (and NSEC3) | Signed proof that a name or type doesn't exist, so "no such name" can't be forged either. |

</details>

<details class="aside">
<summary>Less common record types</summary>

| Type | Holds |
|---|---|
| **NAPTR** | Rewrite rules for turning one kind of identifier into another, mostly used in telephony [@rfc3403]. |
| **SSHFP** | The fingerprint of a server's SSH key, so an SSH client can check it against DNS instead of asking you [@rfc4255]. |
| **TLSA** | A pin for a server's TLS certificate or CA, published in DNS (DANE). Only meaningful with DNSSEC [@rfc6698]. |

</details>

Route 53 supports 17 types: A, AAAA, CAA, CNAME, DS, HTTPS, MX, NAPTR, NS, PTR, SOA, SPF, SRV, SSHFP, SVCB, TLSA, and TXT, plus its own alias records [@aws-route53-record-types].
