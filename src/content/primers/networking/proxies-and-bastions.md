---
title: Proxies, reverse proxies, and bastion hosts
description: Three kinds of machine in the middle, told apart by whose side they're on, with what each one does, what a connection through each looks like, and the settings and headers that trip people up.
order: 5
updated: 2026-10-08
---

A proxy, a reverse proxy, and a bastion host all sit in the middle of a connection. Each one takes a connection from one side and makes a new connection on the other side for it. They differ by **whose side they're on**:

- A **forward proxy** (usually just called a proxy) works for the **clients**. The clients know it's there and send their requests through it.
- A **reverse proxy** works for the **servers**. Clients think they're talking to the server and usually have no idea a proxy is involved.
- A **bastion host** works for **administrators**. It's the one machine they're allowed to log into from outside, and they hop from it to the private machines behind it.

In all three the request travels the same way, from the client toward the server. "Reverse" only means the proxy stands at the other end, beside the servers, set up by the site's owner instead of by the clients, and it doesn't mean the data flows backwards.

<div class="px-sides" role="img" aria-label="Three rows, each read left to right. Forward proxy: a laptop sends to a proxy, which sends across the internet to www.example.com. A dashed box labeled company network surrounds the laptop and the proxy. Reverse proxy: a browser sends across the internet to nginx, which sends to backends at 10.0.2.11 and 10.0.2.12. A dashed box labeled site owner surrounds nginx and the backends. Bastion host: an admin laptop connects across the internet to a bastion, which connects to a private instance at 10.0.2.11. A dashed box labeled VPC surrounds the bastion, in a public subnet, and the private instance, in a private subnet.">
<svg viewBox="0 0 400 330" aria-hidden="true" focusable="false">
<defs><marker id="px-sides-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto"><path class="px-head" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="px-row" x="4" y="12">Forward proxy</text>
<rect class="px-zone" x="4" y="20" width="180" height="70" rx="6"/>
<text class="px-zone-label" x="10" y="84">company network</text>
<g class="px-node"><rect x="12" y="38" width="66" height="26" rx="4"/><text x="45" y="55">laptop</text></g>
<g class="px-node px-mid"><rect x="106" y="38" width="66" height="26" rx="4"/><text x="139" y="55">proxy</text></g>
<text class="px-net" x="232" y="55">internet</text>
<g class="px-node"><rect x="290" y="38" width="104" height="26" rx="4"/><text x="342" y="55">www.example.com</text></g>
<line class="px-arrow" x1="78" y1="51" x2="104" y2="51" marker-end="url(#px-sides-head)"/>
<line class="px-arrow" x1="172" y1="51" x2="202" y2="51" marker-end="url(#px-sides-head)"/>
<line class="px-arrow" x1="262" y1="51" x2="288" y2="51" marker-end="url(#px-sides-head)"/>
<text class="px-row" x="4" y="122">Reverse proxy</text>
<rect class="px-zone" x="186" y="130" width="210" height="80" rx="6"/>
<text class="px-zone-label" x="192" y="204">site owner</text>
<g class="px-node"><rect x="12" y="153" width="66" height="26" rx="4"/><text x="45" y="170">browser</text></g>
<text class="px-net" x="132" y="170">internet</text>
<g class="px-node px-mid"><rect x="200" y="153" width="62" height="26" rx="4"/><text x="231" y="170">nginx</text></g>
<g class="px-node"><rect x="300" y="138" width="88" height="24" rx="4"/><text x="344" y="154">10.0.2.11</text></g>
<g class="px-node"><rect x="300" y="170" width="88" height="24" rx="4"/><text x="344" y="186">10.0.2.12</text></g>
<line class="px-arrow" x1="78" y1="166" x2="102" y2="166" marker-end="url(#px-sides-head)"/>
<line class="px-arrow" x1="162" y1="166" x2="198" y2="166" marker-end="url(#px-sides-head)"/>
<line class="px-arrow" x1="262" y1="162" x2="298" y2="151" marker-end="url(#px-sides-head)"/>
<line class="px-arrow" x1="262" y1="170" x2="298" y2="181" marker-end="url(#px-sides-head)"/>
<text class="px-row" x="4" y="242">Bastion host</text>
<rect class="px-zone" x="186" y="250" width="210" height="74" rx="6"/>
<line class="px-divide" x1="282" y1="256" x2="282" y2="318"/>
<text class="px-zone-label" x="192" y="318">VPC: public subnet</text>
<text class="px-zone-label px-end" x="390" y="318">private subnet</text>
<g class="px-node"><rect x="12" y="268" width="76" height="26" rx="4"/><text x="50" y="285">admin laptop</text></g>
<text class="px-net" x="138" y="285">internet</text>
<g class="px-node px-mid"><rect x="200" y="268" width="66" height="26" rx="4"/><text x="233" y="285">bastion</text></g>
<g class="px-node"><rect x="300" y="268" width="88" height="26" rx="4"/><text x="344" y="285">10.0.2.11</text></g>
<line class="px-arrow" x1="88" y1="281" x2="108" y2="281" marker-end="url(#px-sides-head)"/>
<line class="px-arrow" x1="168" y1="281" x2="198" y2="281" marker-end="url(#px-sides-head)"/>
<line class="px-arrow" x1="266" y1="281" x2="298" y2="281" marker-end="url(#px-sides-head)"/>
</svg>
</div>

<p class="bitgrid-caption">Every arrow points from client to server. The machine in the middle, in teal, is in the same dashed box as the side it works for.</p>

The names are a mess, which doesn't help. The HTTP specification calls a reverse proxy a "gateway" [@rfc9110], MDN says a forward proxy is sometimes called a gateway too [@mdn-proxies], and AWS uses "gateway" for things that aren't proxies at all. Going by whose side something is on works better than going by its name.

## Forward proxies

A forward proxy sits between a group of clients and the internet. The clients are configured to send their requests to the proxy, and the proxy makes the request on their behalf [@rfc9110, @mdn-proxies]. Companies use them to:

- **Control what's reachable.** Allow only approved destinations, like letting build servers reach package repositories and nothing else.
- **See and log outbound traffic** in one place.
- **Cache** things many clients download.

### One request through a forward proxy

Say a laptop on a company network fetches `https://www.example.com`, with its proxy set to `proxy.corp.example.com:3128`:

1. **The laptop connects to the proxy, not to `www.example.com`.**
2. **It asks the proxy to open a tunnel** with an HTTP `CONNECT` request naming just the host and port it wants [@rfc9110, @rfc9112]:

   ```http
   CONNECT www.example.com:443 HTTP/1.1
   Host: www.example.com:443
   ```

3. **The proxy checks whether that destination is allowed,** opens its own connection to `www.example.com:443`, and answers:

   ```http
   HTTP/1.1 200 Connection established
   ```

   Any `2xx` status means the tunnel is up [@rfc9110, @mdn-connect]. The words after `200` vary between proxies, and clients are supposed to ignore them [@rfc9112].
4. **The laptop does its TLS handshake with `www.example.com` through the tunnel.** TLS is the encryption in HTTPS, and the handshake is the few messages that set it up at the start of a connection [@rfc9846] ([The TLS handshake](/primers/networking/tls-handshake/) goes through them). From here on the proxy just passes encrypted bytes back and forth.

A **tunnel** here means the proxy agrees to copy bytes blindly in both directions, without looking at them, until either side closes the connection [@rfc9110]. The laptop's TLS connection runs inside it, so the proxy can't read or change what goes through without breaking the encryption [@curl-http-proxy].

<div class="px-connect" role="img" aria-label="Sequence diagram with three participants: laptop, proxy, and www.example.com, time running downward. The laptop sends the proxy CONNECT www.example.com:443, which the proxy can read. The proxy opens a TCP connection to www.example.com port 443. The proxy answers the laptop 200 Connection established, which the laptop reads. Then, inside the tunnel, the laptop and www.example.com do a TLS handshake, which the proxy copies through. After that the laptop sends GET / with headers and cookies, encrypted, and the site sends back the page, encrypted. The proxy copies these without being able to read them.">
<svg viewBox="0 0 400 260" aria-hidden="true" focusable="false">
<defs><marker id="px-connect-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="px-head" d="M0,0 L8,4 L0,8 z"/></marker><marker id="px-connect-head-enc" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="px-head-enc" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="px-tunnel" x="30" y="140" width="340" height="96" rx="6"/>
<text class="px-actor" x="40" y="16">Laptop</text>
<text class="px-actor" x="200" y="16">Proxy</text>
<text class="px-actor" x="350" y="16">www.example.com</text>
<line class="px-life" x1="40" y1="24" x2="40" y2="250"/>
<line class="px-life" x1="200" y1="24" x2="200" y2="250"/>
<line class="px-life" x1="350" y1="24" x2="350" y2="250"/>
<line class="px-msg" x1="40" y1="52" x2="200" y2="52" marker-end="url(#px-connect-head)"/>
<text class="px-label" x="120" y="46">CONNECT www.example.com:443</text>
<text class="px-note" x="120" y="64">the proxy reads this</text>
<line class="px-msg" x1="200" y1="88" x2="350" y2="88" marker-end="url(#px-connect-head)"/>
<text class="px-label" x="275" y="82">TCP to port 443</text>
<line class="px-msg" x1="200" y1="114" x2="40" y2="114" marker-end="url(#px-connect-head)"/>
<text class="px-label" x="120" y="108">200 Connection established</text>
<text class="px-note" x="285" y="152">inside the tunnel</text>
<line class="px-msg px-pass" x1="40" y1="172" x2="350" y2="172" marker-end="url(#px-connect-head)"/>
<text class="px-label px-halo" x="195" y="166">TLS handshake (copied through)</text>
<line class="px-msg px-enc" x1="40" y1="200" x2="350" y2="200" marker-end="url(#px-connect-head-enc)"/>
<text class="px-label px-enc-text px-halo" x="195" y="194">GET / with headers and cookies</text>
<line class="px-msg px-enc" x1="350" y1="226" x2="40" y2="226" marker-end="url(#px-connect-head-enc)"/>
<text class="px-label px-enc-text px-halo" x="195" y="220">the page</text>
</svg>
</div>

<p class="bitgrid-caption">Time runs downward. The proxy reads the CONNECT line and its own reply. Everything in teal is encrypted between the laptop and the site, and the proxy only copies it.</p>

So for HTTPS, an ordinary forward proxy knows which host you connected to and how much data moved, but not what was inside. Proxies that do read HTTPS do it by **TLS inspection**: they **terminate** the laptop's TLS connection, meaning they become the end that holds the certificate and decrypts the traffic ([Load balancers and TLS termination](/primers/networking/load-balancers-and-tls/#terminating-tls) covers the idea), and then open a second TLS connection of their own to the real site. A **certificate** is a small file that ties a public key to a name like `www.example.com`, signed by a **certificate authority** (CA) the laptop already trusts [@rfc5280] ([Certificates and trust](/primers/networking/certificates-and-trust/) covers them). To make the laptop accept the proxy's end, the proxy hands it a certificate for `www.example.com` that it made on the spot and signed with a company CA installed on company machines.

| | Plain tunnel | TLS inspection |
|---|---|---|
| What the proxy sees | The hostname and how many bytes moved | Full URLs, headers, and content |
| The laptop's TLS connection is with | The real site | The proxy |
| The certificate the laptop gets | The site's own | One for `www.example.com` signed by the company CA |

Any tool that doesn't trust the company CA sees that certificate as forged and fails with a certificate error, which is why corporate laptops can need a [private CA in every tool's trust store](/primers/networking/certificates-and-trust/#trusting-a-private-ca).

### Pointing tools at a proxy

Most command-line tools and language runtimes read proxy settings from environment variables [@curl-proxy-env, @gitlab-no-proxy]:

```bash tab="macOS / Linux"
export http_proxy=http://proxy.corp.example.com:3128
export https_proxy=http://proxy.corp.example.com:3128
export no_proxy=localhost,127.0.0.1,.corp.example.com,10.0.0.0/8,169.254.169.254
```

```powershell tab="Windows (PowerShell)"
$env:http_proxy = "http://proxy.corp.example.com:3128"
$env:https_proxy = "http://proxy.corp.example.com:3128"
$env:no_proxy = "localhost,127.0.0.1,.corp.example.com,10.0.0.0/8,169.254.169.254"
```

Either way the settings only last for that terminal session and the programs started from it [@ms-about-env-vars]. Each variable has one job [@curl-proxy-env]:

- `http_proxy` is the proxy to use for `http://` URLs.
- `https_proxy` is the proxy to use for `https://` URLs.
- `no_proxy` lists the hosts to reach directly, skipping the proxy.

`https_proxy` starting with `http://` looks like a mistake, but the value describes how to talk to the proxy itself, not to the site. The tool connects to the proxy in plain HTTP, sends `CONNECT`, and does its TLS with the site through the tunnel, so the site's traffic is still encrypted [@curl-http-proxy].

Two things catch people:

- **`no_proxy` matters as much as the proxy itself.** Anything internal should skip the proxy: internal hostnames, private address ranges, and on AWS the instance metadata address `169.254.169.254`. That address is where an EC2 instance asks for its own settings and, if it has an IAM role, temporary credentials for that role, and it only answers requests from the instance itself [@aws-ec2-instance-metadata, @aws-ec2-imds-access]. Sent through the proxy, a request for it can't get this instance's answer, and the same goes for internal services the proxy can't reach. A name with a leading dot, like `.corp.example.com`, matches every host under that domain, so `wiki.corp.example.com` goes direct [@curl-proxy-env].
- **Case isn't consistent between tools.** curl only reads the lowercase `http_proxy`, because on a web server the uppercase one can be set by a visitor's request header [@curl-proxy-env]. Other tools read the uppercase versions. Setting both is the safe habit. On Windows, setting one sets both, because environment variable names aren't case-sensitive there [@ms-about-env-vars].

Three requests, with the settings above:

| Request | Matches in `no_proxy` | Goes |
|---|---|---|
| `curl https://www.example.com` | Nothing | Through the proxy, using `https_proxy` and `CONNECT` |
| `curl http://wiki.corp.example.com` | `.corp.example.com` | Direct |
| `curl http://10.0.2.11` | `10.0.0.0/8`, if the tool understands CIDR | Direct in curl 7.86.0 or later, through the proxy in a tool that only matches names |

The last row depends on the tool. curl has accepted CIDR ranges like `10.0.0.0/8` in `no_proxy` since version 7.86.0 [@curl-proxy-env], and some tools only match hostnames and suffixes [@gitlab-no-proxy], so test the tools you actually use.

Browsers usually use the operating system's proxy settings or a **PAC file** (a small script that picks a proxy per URL) instead [@chromium-network-settings, @mdn-proxies].

### Forward proxy vs NAT gateway

On AWS, a **private subnet** is a part of the network with no route in from the internet [@aws-vpc-subnets], and a **NAT gateway** is how machines in one reach the internet anyway. It sends their traffic out from its own public address and passes the replies back, and nothing on the internet can start a connection in through it [@aws-vpc-nat-gateways] ([AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/#public-and-private-subnets) covers where it fits). That overlaps with a forward proxy's job, but a NAT gateway works on addresses and ports, not on names. It can't tell a request to a package repository from a request to anywhere else on the same port. When outbound traffic has to be limited to particular domains, a forward proxy (or a firewall that understands domain names) is the tool.

## Reverse proxies

A reverse proxy sits in front of one or more servers and answers for them. Clients connect to it as if it were the server, and it passes each request on to a backend and relays the response [@rfc9110, @mdn-proxies]. Almost every production web service has at least one:

- **Terminating TLS,** so the backends don't each need certificates ([Load balancers and TLS termination](/primers/networking/load-balancers-and-tls/#terminating-tls)).
- **Load balancing** across several backends.
- **Routing** by hostname or path, so `/api/*` and `/admin/*` can go to different services behind one address.
- **Caching and compression.**
- **Hiding the backends,** which can stay in private subnets with only the proxy reachable.

nginx, HAProxy, Caddy, and Envoy are common ones to run yourself. A lot of managed services are reverse proxies under a different name: an Application Load Balancer, a CDN like [CloudFront](/primers/networking/cdns-and-cloudfront/), an API gateway, and a Kubernetes ingress controller all receive requests on behalf of servers and pass them along.

### One request through a reverse proxy

Say `https://app.example.com` is served by nginx in front of two app servers at `10.0.2.11` and `10.0.2.12`, and a browser at `203.0.113.7` visits it:

1. **The browser looks up `app.example.com` and gets the proxy's address.** As far as it knows, the proxy is the site.
2. **The proxy terminates TLS** with the certificate for `app.example.com`.
3. **The proxy picks a backend** (say `10.0.2.12`) and sends it the request over a new connection. That connection is usually plain HTTP on the private network, so the backend can't tell on its own that the browser used HTTPS. The proxy adds headers to fill in what the backend can't see: `X-Forwarded-For: 203.0.113.7`, `X-Forwarded-Proto: https`, and `Host: app.example.com` passed through [@mdn-x-forwarded-for, @mdn-x-forwarded-proto].
4. **The backend responds to the proxy,** and the proxy sends the response back to the browser.

### Headers that cross the proxy

From the backend's point of view, every request comes from the proxy's address. The original details travel in headers instead [@mdn-x-forwarded-for, @rfc7239]:

| Header | Carries |
|---|---|
| `X-Forwarded-For` | The client's real address (each proxy along the way appends the address it received from) |
| `X-Forwarded-Proto` | Whether the original request was `https` or `http` |
| `X-Forwarded-Host` / `Host` | The hostname the client asked for |
| `Forwarded` | The standardized single header that carries all of the above |

Backends need these for anything that depends on who the visitor is or how they connected: logs that show the visitor instead of the proxy, rate limits per visitor, IP allowlists, and redirects or links that have to start with `https://` even though the backend's own connection was plain HTTP [@mdn-x-forwarded-for, @mdn-x-forwarded-proto].

With more than one proxy, `X-Forwarded-For` grows by one entry per hop. Say the same visitor at `203.0.113.7` reaches `app.example.com` through a CDN edge at `198.51.100.20`, then nginx, then a backend. The CDN adds `203.0.113.7`, since that's who connected to it. nginx appends `198.51.100.20`, since the CDN is who connected to nginx. The backend receives:

```http
Host: app.example.com
X-Forwarded-For: 203.0.113.7, 198.51.100.20
X-Forwarded-Proto: https
```

The TCP connection itself comes from nginx's private address, so nginx's own address never appears in the header. The leftmost entry is the original client and the rightmost is the most recent proxy [@mdn-x-forwarded-for].

These headers are just text, and anyone can send them. Say a visitor at `203.0.113.7` connects to nginx directly and sends `X-Forwarded-For: 10.0.0.1` itself. If nginx appends instead of replacing, the backend gets:

```http
X-Forwarded-For: 10.0.0.1, 203.0.113.7
```

An app that reads the first entry now believes the request came from inside the network, and an allowlist for internal addresses lets it in. So a backend should only trust entries its own proxies added, reading from the right [@mdn-x-forwarded-for], and the outermost proxy should overwrite what the client sent rather than pass it through. The [Host header problem](/primers/networking/load-balancers-and-tls/#the-host-header-problem) is the other usual surprise after putting a proxy in front of an app.

## Forward vs reverse, side by side

| | Forward proxy | Reverse proxy |
|---|---|---|
| Works for | Clients | Servers |
| Who configures it | The clients (or their network) | The server's owner |
| Does the client know it's there? | Yes | Usually not |
| Typical job | Control and log outbound traffic | TLS, load balancing, routing, caching |
| Examples | A corporate web proxy, Squid, an [SSH SOCKS tunnel](#bastions-as-a-socks-proxy) | nginx, HAProxy, an ALB, a CDN, an ingress controller |

## Bastion hosts

A **bastion host** (or jump host) is a single, locked-down machine that administrators log into from outside, then use to reach machines that aren't reachable directly. The private servers only accept SSH from the bastion, and the bastion only accepts SSH from known addresses, so there's one well-watched door instead of many.

### One SSH session through a bastion

Say the bastion is `bastion.example.com` in a public subnet, one with a route to the internet [@aws-vpc-subnets], and the target is a private instance at `10.0.2.11`:

```bash
ssh -J admin@bastion.example.com admin@10.0.2.11
```

1. **SSH connects to the bastion and authenticates.**
2. **Through that connection, it asks the bastion to open a TCP connection to `10.0.2.11:22`** [@openssh-ssh].
3. **It authenticates to the private instance end to end,** with the bastion just relaying bytes.

<div class="px-hop" role="img" aria-label="A laptop connects with SSH to bastion.example.com. The bastion opens a TCP connection to port 22 on 10.0.2.11. Running through both, a second SSH session goes from the laptop all the way to 10.0.2.11, encrypted end to end, so the bastion relays it without being able to read it.">
<svg viewBox="0 0 400 140" aria-hidden="true" focusable="false">
<defs><marker id="px-hop-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="px-head-enc" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<g class="px-node"><rect x="4" y="30" width="78" height="60" rx="4"/><text x="43" y="46">laptop</text></g>
<g class="px-node px-mid"><rect x="140" y="30" width="118" height="60" rx="4"/><text x="199" y="46">bastion.example.com</text></g>
<g class="px-node"><rect x="316" y="30" width="80" height="60" rx="4"/><text x="356" y="46">10.0.2.11</text></g>
<rect class="px-pipe" x="82" y="56" width="58" height="18"/>
<rect class="px-pipe" x="258" y="56" width="58" height="18"/>
<text class="px-note" x="111" y="22">ssh</text>
<text class="px-note" x="287" y="22">TCP port 22</text>
<line class="px-guide" x1="111" y1="26" x2="111" y2="54"/>
<line class="px-guide" x1="287" y1="26" x2="287" y2="54"/>
<line class="px-inner" x1="60" y1="65" x2="338" y2="65" marker-end="url(#px-hop-head)"/>
<text class="px-note" x="199" y="84">relays, can't read</text>
<text class="px-label px-enc-text" x="200" y="112">inner SSH session: encrypted laptop to 10.0.2.11</text>
</svg>
</div>

<p class="bitgrid-caption">The grey pipes are the two connections the jump is built from. The teal line is your real session to the private instance, which passes through the bastion still encrypted.</p>

`-J` is a shortcut for SSH's `ProxyJump` setting [@openssh-ssh]. The inner session is encrypted between your laptop and `10.0.2.11`, so the bastion only ever handles encrypted bytes and can't read what you type or see on the private instance. Your keys stay on your laptop too, which is better than the older habit of copying private keys onto the bastion and hopping from there.

The setting can live in `~/.ssh/config`, so a plain `ssh private-box` does the jump automatically [@openssh-ssh-config]:

```
Host private-box
    HostName 10.0.2.11
    User admin
    ProxyJump admin@bastion.example.com
```

`Host` is the nickname you type, `HostName` is the real address, `User` is who to log in as, and `ProxyJump` is the hop on the way [@openssh-ssh-config]. Windows offers the same OpenSSH client as an optional feature [@ms-openssh-overview], so once it's installed these commands are the same in PowerShell.

### Forwarding a port through a bastion

The same bastion can forward ports for tools that aren't SSH, which is the pattern in [Reaching private resources](/primers/networking/reaching-private-resources/#through-session-manager-or-ssh):

```bash
ssh -L 5433:db.internal.example.com:5432 admin@bastion.example.com
```

The command has three pieces [@openssh-ssh]:

- **`5433`** is a port on your laptop. SSH starts listening on it.
- **`db.internal.example.com:5432`** is where the bastion connects whenever something uses that port. The connection is made from the bastion, so the name is looked up by the bastion and only has to make sense from there. Your laptop never has to resolve or reach the database itself.
- **`admin@bastion.example.com`** is the bastion.

Then, in a second terminal, point the database client at your own laptop:

```bash
psql -h localhost -p 5433
```

The connection goes into port 5433, through the SSH connection to the bastion, and out to the database on port 5432. The tunnel lasts as long as that `ssh` session does. Adding `-N` skips opening a shell on the bastion when forwarding is all you want [@openssh-ssh].

### Bastions as a SOCKS proxy

`-L` forwards one fixed destination. `-D` turns SSH into a **SOCKS** proxy instead, a kind of forward proxy that relays any TCP connection to wherever the client asks, without needing to understand web requests or any other protocol inside it [@rfc1928]. (In [OSI](/primers/networking/osi-model/#where-the-things-in-the-other-primers-sit) terms, it hands over whole connections instead of reading HTTP at layer 7.)

```bash
ssh -D 1080 admin@bastion.example.com
```

That starts a SOCKS proxy on your laptop's port 1080, and every connection made through it is opened from the bastion [@openssh-ssh]. Set a browser's SOCKS proxy to `localhost` port `1080`, open `http://10.0.2.11:8080`, and the bastion makes the connection to the private instance's web UI for you. It's a quick way to use an internal web page through a machine that can reach it.

### Keeping a bastion safe

A bastion is a machine with SSH open to the outside, so it gets attacked constantly. On AWS, much of the protection comes from **security groups**, the firewall attached to each instance, which lists the traffic allowed in and drops everything else [@aws-vpc-security-groups] ([more on security groups](/primers/networking/aws-vpc-subnets/#security-groups-and-network-acls)). The usual precautions:

- Its security group allows port 22 only from known address ranges, never `0.0.0.0/0`, which means any address on the internet.
- The private instances' security groups allow port 22 only from the bastion's security group, so the bastion is the only way to reach their SSH port [@aws-vpc-sg-rules].
- Key-based login only, no passwords, and one key per person so access can be revoked individually.
- Nothing else runs on it, and it gets patched promptly.
- Logins are logged somewhere the bastion can't erase.

### Alternatives to a bastion

AWS now offers ways to reach private instances with no bastion and no inbound SSH at all:

- **Session Manager** gives a shell (and port forwarding) through the Systems Manager agent on the instance, controlled by IAM, with no inbound ports, no bastion, and no SSH keys [@aws-ssm-session-manager].
- **EC2 Instance Connect Endpoint** lets you SSH to an instance's private address from outside without a bastion and without the instance having a public address [@aws-ec2-instance-connect-endpoint].
- A **client VPN** puts the person on the network instead ([Reaching private resources](/primers/networking/reaching-private-resources/#connecting-people-client-vpn)).

A bastion is still the most portable option, since it's plain SSH and works the same anywhere, but on AWS the managed options remove the most exposed piece.
