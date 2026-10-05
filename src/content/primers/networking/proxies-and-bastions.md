---
title: Proxies, reverse proxies, and bastion hosts
description: Three kinds of machine in the middle, told apart by whose side they're on, with what each one does, what a connection through each looks like, and the settings and headers that trip people up.
order: 8
updated: 2026-10-05
---

A proxy, a reverse proxy, and a bastion host all sit in the middle of a connection. Each one takes a connection from one side and makes a new connection on the other side for it. They differ by **whose side they're on**:

- A **forward proxy** (usually just called a proxy) works for the **clients**. The clients know it's there and send their requests through it.
- A **reverse proxy** works for the **servers**. Clients think they're talking to the server and usually have no idea a proxy is involved.
- A **bastion host** works for **administrators**. It's the one machine they're allowed to log into from outside, and they hop from it to the private machines behind it.

The names are a mess, which doesn't help. The HTTP specification calls a reverse proxy a "gateway" [@rfc9110], MDN says a forward proxy is sometimes called a gateway too [@mdn-proxies], and AWS uses "gateway" for things that aren't proxies at all. Going by whose side something is on works better than going by its name.

## Forward proxies

A forward proxy sits between a group of clients and the internet. The clients are configured to send their requests to the proxy, and the proxy makes the request on their behalf [@mdn-proxies]. Companies use them to:

- **Control what's reachable.** Allow only approved destinations, like letting build servers reach package repositories and nothing else.
- **See and log outbound traffic** in one place.
- **Cache** things many clients download.

### One request through a forward proxy

Say a laptop on a company network fetches `https://www.example.com`, with its proxy set to `proxy.corp.example.com:3128`:

1. **The laptop connects to the proxy, not to `www.example.com`.**
2. **It asks the proxy to open a tunnel** with an HTTP `CONNECT www.example.com:443` request [@rfc9110].
3. **The proxy checks whether that destination is allowed,** opens its own connection to `www.example.com:443`, and replies that the tunnel is ready.
4. **The laptop does its TLS handshake with `www.example.com` through the tunnel.** From here on the proxy just passes encrypted bytes back and forth.

So for HTTPS, an ordinary forward proxy knows which host you connected to and how much data moved, but not what was inside. Proxies that do read HTTPS do it by **TLS inspection**: they terminate the connection themselves and re-sign every site's certificate with a company CA that's installed on company machines. That's why corporate laptops can need a [private CA in every tool's trust store](/primers/networking/certificates-and-trust/#trusting-a-private-ca).

### Pointing tools at a proxy

Most command-line tools and language runtimes read proxy settings from environment variables [@curl-proxy-env]:

```bash
export http_proxy=http://proxy.corp.example.com:3128
export https_proxy=http://proxy.corp.example.com:3128
export no_proxy=localhost,127.0.0.1,.corp.example.com,10.0.0.0/8,169.254.169.254
```

Three things catch people:

- **`no_proxy` matters as much as the proxy itself.** Anything internal should skip the proxy: internal hostnames, private address ranges, and on AWS the instance metadata address `169.254.169.254`. Otherwise requests to internal services go out to the proxy, which can't reach them.
- **Case isn't consistent between tools.** curl only reads the lowercase `http_proxy`, on purpose: a web server sets the uppercase `HTTP_PROXY` variable from a request header that anyone can send, so trusting it would let a visitor reroute the server's own requests [@curl-proxy-env]. Other tools read the uppercase versions. Setting both is the safe habit.
- **Support for CIDR ranges in `no_proxy` varies.** Some tools accept `10.0.0.0/8` and some only match hostnames and suffixes, so test the tools you actually use.

Browsers usually use the operating system's proxy settings or a **PAC file** (a small script that picks a proxy per URL) instead [@mdn-proxies].

### Forward proxy vs NAT gateway

A private subnet's [NAT gateway](/primers/networking/aws-vpc-subnets/#public-and-private-subnets) also lets machines reach the internet without being reachable from it, but it works on addresses and ports, not on names. It can't tell a request to a package repository from a request to anywhere else on the same port. When outbound traffic has to be limited to particular domains, a forward proxy (or a firewall that understands domain names) is the tool.

### SOCKS proxies

A **SOCKS** proxy is a forward proxy that works below HTTP: it relays any TCP connection, not just web requests [@rfc1928]. The handy one to know is the one SSH gives you for free. `ssh -D 1080 user@host` starts a SOCKS proxy on your laptop's port 1080, and anything pointed at it gets relayed through `host` [@openssh-ssh]. It's a quick way to browse an internal web UI through a machine that can reach it.

## Reverse proxies

A reverse proxy sits in front of one or more servers and answers for them. Clients connect to it as if it were the server, and it passes each request on to a backend and relays the response [@mdn-proxies]. Almost every production web service has at least one:

- **Terminating TLS,** so the backends don't each need certificates ([Load balancers and where TLS ends](/primers/networking/load-balancers-and-tls/#terminating-tls)).
- **Load balancing** across several backends.
- **Routing** by hostname or path, so `/api/*` and `/admin/*` can go to different services behind one address.
- **Caching and compression.**
- **Hiding the backends,** which can stay in private subnets with only the proxy reachable.

nginx, HAProxy, Caddy, and Envoy are common ones to run yourself. A lot of managed services are reverse proxies under a different name: an Application Load Balancer, a CDN like [CloudFront](/primers/networking/cdns-and-cloudfront/), an API gateway, and a Kubernetes ingress controller all receive requests on behalf of servers and pass them along.

### One request through a reverse proxy

Say `https://app.example.com` is served by nginx in front of two app servers at `10.0.2.11` and `10.0.2.12`:

1. **The browser looks up `app.example.com` and gets the proxy's address.** As far as it knows, the proxy is the site.
2. **The proxy terminates TLS** with the certificate for `app.example.com`.
3. **The proxy picks a backend** (say `10.0.2.12`) and sends it the request over a new connection, adding headers that say where the request really came from.
4. **The backend responds to the proxy,** and the proxy sends the response back to the browser.

### Headers that cross the proxy

From the backend's point of view, every request comes from the proxy's address. The original details travel in headers instead [@mdn-x-forwarded-for, @rfc7239]:

| Header | Carries |
|---|---|
| `X-Forwarded-For` | The client's real address (each proxy along the way appends the address it received from) |
| `X-Forwarded-Proto` | Whether the original request was `https` or `http` |
| `X-Forwarded-Host` / `Host` | The hostname the client asked for |
| `Forwarded` | The standardized single header that carries all of the above |

These headers are just text, and anyone can send them. A backend should only trust them when they come from its own proxy, and the proxy should overwrite what the client sent rather than pass it through. Otherwise a client can claim to be any address it likes. The [Host header problem](/primers/networking/load-balancers-and-tls/#the-host-header-problem) is the other usual surprise after putting a proxy in front of an app.

## Forward vs reverse, side by side

| | Forward proxy | Reverse proxy |
|---|---|---|
| Works for | Clients | Servers |
| Who configures it | The clients (or their network) | The server's owner |
| Does the client know it's there? | Yes | Usually not |
| Typical job | Control and log outbound traffic | TLS, load balancing, routing, caching |
| Examples | A corporate web proxy, Squid, an SSH SOCKS tunnel | nginx, HAProxy, an ALB, a CDN, an ingress controller |

## Bastion hosts

A **bastion host** (or jump host) is a single, locked-down machine that administrators log into from outside, then use to reach machines that aren't reachable directly. The private servers only accept SSH from the bastion, and the bastion only accepts SSH from known addresses, so there's one well-watched door instead of many.

### One SSH session through a bastion

Say the bastion is `bastion.example.com` in a public subnet and the target is a private instance at `10.0.2.11`:

```bash
ssh -J admin@bastion.example.com admin@10.0.2.11
```

1. **SSH connects to the bastion and authenticates.**
2. **Through that connection, it opens a second connection to `10.0.2.11:22`.**
3. **It authenticates to the private instance end to end,** with the bastion just relaying bytes.

`-J` is a shortcut for SSH's `ProxyJump` setting [@openssh-ssh], which can live in `~/.ssh/config` so a plain `ssh private-box` does the jump automatically. The keys stay on your laptop, which is better than the older habit of copying private keys onto the bastion and hopping from there.

The same bastion can forward ports for tools that aren't SSH, which is the pattern in [Reaching private resources](/primers/networking/reaching-private-resources/#through-session-manager-or-ssh):

```bash
ssh -L 5433:db.internal.example.com:5432 admin@bastion.example.com
```

### Keeping a bastion safe

A bastion is a machine with SSH open to the outside, so it gets attacked constantly. The usual precautions:

- Its security group allows port 22 only from known address ranges, never `0.0.0.0/0`.
- Key-based login only, no passwords, and one key per person so access can be revoked individually.
- Nothing else runs on it, and it gets patched promptly.
- Logins are logged somewhere the bastion can't erase.

### Alternatives to a bastion

AWS now offers ways to reach private instances with no bastion and no inbound SSH at all:

- **Session Manager** gives a shell (and port forwarding) through the Systems Manager agent on the instance, controlled by IAM, with no inbound ports, no bastion, and no SSH keys [@aws-ssm-session-manager].
- **EC2 Instance Connect Endpoint** lets you SSH to an instance's private address from outside without a bastion and without the instance having a public address [@aws-ec2-instance-connect-endpoint].
- A **client VPN** puts the person on the network instead ([Reaching private resources](/primers/networking/reaching-private-resources/#connecting-people-client-vpn)).

A bastion is still the most portable option, since it's plain SSH and works the same anywhere, but on AWS the managed options remove the most exposed piece.
