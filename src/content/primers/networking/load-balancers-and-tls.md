---
title: Load balancers and TLS termination
description: Layer 4 vs. layer 7, NLBs vs. ALBs, what it means to terminate TLS, and how to put HTTPS in front of a single server without a load balancer at all.
order: 3
updated: 2026-10-08
---

Say an app runs as three identical copies, on servers at `10.0.16.20`, `10.0.32.20`, and `10.0.48.20`, and users should reach all of them through one name, `app.example.com`. That name points at a **load balancer**. It accepts every incoming connection, hands each request (or connection) to one of the three copies, spreading the work between them, and keeps checking on them so it can stop sending anything to a copy that stops answering. Users never see the three addresses, and a copy can be replaced without them noticing.

Anything that accepts traffic from outside a private network sits behind something like that: a load balancer, a firewall, or a **reverse proxy**, a server that accepts connections on behalf of other servers and forwards each request to one of them ([Proxies, reverse proxies, and bastion hosts](/primers/networking/proxies-and-bastions/) covers them in general). The kind of traffic decides which of those can do the job, and the first question is always whether it's HTTP or not.

The examples use AWS. AWS networking terms (subnets, route tables, security groups) get a one-line explanation where they first come up, and [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/) covers them properly.

## Layer 4 and layer 7

Networking gets described in layers (the [OSI model](/primers/networking/osi-model/), which has its own primer). Two of them matter here:

- **Layer 4** is TCP and UDP: a connection between two addresses and ports, with no idea what's inside it.
- **Layer 7** is the application protocol riding on top, like HTTP. At this layer you can see URLs, hostnames, headers, and cookies.

Something working at layer 4 can forward any kind of traffic, because it never looks inside. Something working at layer 7 can make much smarter decisions, but only for the protocol it understands.

## How a load balancer works

Every AWS load balancer is built from the same parts, whichever layer it works at. A load balancer is a set of **listeners**, and each listener decides where the traffic arriving on it should go. Following one connection through:

1. **A listener accepts it.** A listener is a protocol and a port the load balancer answers on, like HTTPS on 443 or TCP on 5432 [@aws-alb-listener-rules, @aws-nlb-listeners]. A load balancer can have several, one per port.
2. **The listener's rules pick a target group.** Every listener has a **default action**, usually "forward to this target group," and can have **rules** on top that send some traffic elsewhere.
3. **A target group is the pool of places traffic can go.** Each member is a **target**, the server (or container, or IP address) that actually gets the request. An ALB can also send to Lambda functions. The load balancer health-checks every target in the group and stops sending traffic to any that fail [@aws-alb-intro]. (This "target" has nothing to do with the Target column in a [route table](/primers/networking/aws-vpc-subnets/#destination-and-target), which means the next hop. AWS uses the word for both.)
4. **The load balancer picks one healthy target** from that group and sends the traffic there.

## NLBs and ALBs

AWS has a load balancer for each of the two layers.

A **Network Load Balancer (NLB)** works at layer 4. With a TCP listener it forwards connections without looking inside them, which makes it the one to use for anything that isn't HTTP: databases, message brokers, SSH, anything with its own protocol. With a TLS listener it can also **terminate** TLS, which means being the place where the encryption ends: it holds the certificate, decrypts the traffic, and passes it on (nothing to do with stopping or killing anything; [Terminating TLS](#terminating-tls) has the details). Even then, it still doesn't understand HTTP [@aws-nlb-intro, @aws-nlb-listeners].

An **Application Load Balancer (ALB)** works at layer 7. It understands HTTP and HTTPS (including HTTP/2 and gRPC [@aws-alb-target-groups]), so it can route `/api/*` to one set of servers and `/admin/*` to another, send different hostnames to different apps, add headers, and redirect HTTP to HTTPS [@aws-alb-intro, @aws-alb-header-modification].

| | NLB | ALB |
|---|---|---|
| Layer | 4 (TCP, UDP, TLS) | 7 (HTTP, HTTPS) |
| Sees inside the traffic | No | Yes: paths, hostnames, headers |
| Good for | Non-HTTP protocols, very high throughput, fixed IP addresses | Web apps and APIs, routing by path or hostname |
| Works with a WAF | No | Yes |

### Rules: how much each one can see

Rules can only look at what the load balancer reads, which is where the layer 4 / layer 7 difference really shows up.

**ALB rules look inside the request.** A rule can match on the hostname, the path, any HTTP header, the method, the query string, or the client's address range [@aws-alb-rule-conditions]. Rules are checked in priority order, lowest number first, and the first one that matches decides. Anything nothing matches falls through to the default rule [@aws-alb-listener-rules]. A matching rule can forward to one or more target groups, redirect (say, HTTP to HTTPS), return a fixed response, or require users to log in through an identity provider first [@aws-alb-rule-actions].

| Rule | Condition | Action |
|---|---|---|
| 1 | host is `api.example.com` | forward to the `api` target group |
| 2 | path is `/admin/*` | forward to the `admin` target group |
| 3 | path is `/old-docs/*` | redirect to `/docs/` |
| default | (anything else) | forward to the `web` target group |

**NLB rules can only see the connection.** An NLB never reads what's inside the traffic, so it can't route by hostname or path. It does have listener rules, but they can only send IPv4 and IPv6 connections to different target groups, or split connections across several target groups by weight, which is handy for moving traffic over to a new version gradually [@aws-nlb-listeners].

### Picking a target

Once a rule has picked a target group, the load balancer still has to pick one target in it:

- **An ALB picks per request,** round robin by default. A target group can switch to "least outstanding requests" (send it to whoever is least busy) or weighted random instead [@aws-alb-target-group-attributes].
- **An NLB picks per connection,** using a hash of the connection's protocol, addresses, and ports, so every packet in one connection lands on the same target [@aws-elb-how-it-works].

### Health checks

A load balancer decides a target is healthy by asking it, over and over. For the `web` target group above, with targets listening on port 8080, a typical ALB health check looks like this:

| Setting | Value here | ALB default |
|---|---|---|
| Request | `GET /health` | `GET /` |
| Port | 8080, the port the target gets traffic on | the traffic port |
| Healthy response | `200` | `200` |
| How often | every 30 seconds | 30 seconds |
| No answer counts as a failure after | 5 seconds | 5 seconds |
| Unhealthy after | 2 failures in a row | 2 |
| Healthy again after | 5 successes in a row | 5 |

With those settings, a target that starts returning `500` (or stops answering) gets its second failed check within about a minute, and the load balancer stops sending it requests. Once it's fixed, it needs five good checks in a row, about two and a half minutes, before it gets traffic again [@aws-alb-health-checks]. A path like `/health` that does a little real work (checks that the app can reach its database, say) catches more problems than `/`, which often succeeds as long as the web server process is up.

If every target in a group fails at once, an ALB **fails open**: it gives up on health and sends requests to all of them anyway [@aws-alb-health-checks].

### Sticky sessions

Picking a fresh target for every request assumes any target can answer any request. That's true when the app keeps its state somewhere shared (a database, a cache), and not true when a server keeps something like a login session in its own memory. If the next request lands on a different server, that server has never heard of the user.

**Sticky sessions** (also called session affinity) fix that by sending all of a user's requests to the same target. On an ALB they work with cookies, so the client has to accept cookies, and they're turned on per target group [@aws-alb-target-group-attributes]:

- **Duration-based stickiness.** The ALB picks a target for the first request as usual, then sets its own encrypted cookie, `AWSALB`, recording which target it picked. Later requests carry the cookie, and the ALB sends them to the same target for as long as you configure.
- **Application-based stickiness.** If the app already sets its own session cookie, the ALB can follow that instead, so the stickiness lasts exactly as long as the app's session does.

When a sticky target goes away (it fails its health check or is deregistered), the ALB picks a new target for that user and updates the cookie [@aws-alb-target-group-attributes]. The user's in-memory session on the old server is gone, though, which is the main argument against relying on stickiness: it hides state on individual servers, it can pile users onto one target while new ones sit idle, and every deploy or scale-in logs some people out. Keeping session state somewhere shared, so any target can serve any request, is usually the better fix. Stickiness is a reasonable stopgap for an app that can't do that yet.

Two more cases:

- **WebSockets** (a long-lived two-way connection that starts as an HTTP request) are sticky on their own: whichever target accepts the connection keeps it for its whole life, and the cookie isn't used after that [@aws-alb-target-group-attributes].
- **NLBs** have a simpler version based on the client's IP address. Everyone behind the same NAT device shares one address, so they can all end up on the same target [@aws-nlb-target-group-attributes].

AWS's target group attributes pages cover the rest, including how the cookies behave across sites and with several layers of load balancers [@aws-alb-target-group-attributes, @aws-nlb-target-group-attributes].

### Not one server

It's easy to picture a load balancer as one machine, but AWS runs a load balancer **node**, one of AWS's own machines that together make up your load balancer, in each **availability zone** (roughly, a data center in the region) that you enable. Each node sits in a **subnet** you pick in that zone, a slice of your network's address range, and the load balancer's DNS name returns the nodes' addresses [@aws-elb-how-it-works]. An NLB's node in each zone gets a static IP address, and an internet-facing NLB can use your own **Elastic IP** (a public address you reserve and keep) for it [@aws-nlb-intro]. An ALB's addresses aren't fixed, so you always point DNS at the ALB's name rather than at an address.

### Proxy vs pass-through

The two also differ in what the targets see:

- **An ALB is a reverse proxy.** It ends the client's connection and opens a new one to the target, so the target sees the ALB node's address and gets the client's real address in the `X-Forwarded-For` header [@aws-alb-http-headers] (more on that [below](#the-host-header-problem)).
- **An NLB passes connections through,** and can keep the client's original address as the source the target sees. That's always on for UDP and QUIC and optional for TCP and TLS [@aws-nlb-target-group-attributes].

Here's one request from a laptop at `198.51.100.7` to `app.example.com`, through each kind. An internet-facing load balancer's nodes have public addresses for clients to reach, and talk to targets over private ones [@aws-elb-how-it-works]. The ALB node here sits in a **public subnet**, `10.0.0.0/24`, meaning one whose route table (its list of where to send traffic) has a way out to the internet, and has the private address `10.0.0.37`. The target is in a **private subnet**, with no route to the internet at all:

<div class="lb-path" role="img" aria-label="Through an ALB: the client at 198.51.100.7 looks up app.example.com and connects to the ALB node in zone a's public subnet, 10.0.0.0/24. The HTTPS listener on port 443 accepts the connection and decrypts the request. A rule picks the web target group, and the node opens a new connection from its own address, 10.0.0.37, to a healthy target at 10.0.16.20 port 8080. The target sees the source 10.0.0.37 and finds the client's address in the header X-Forwarded-For: 198.51.100.7. Through an NLB with client IP preservation on: the client at 198.51.100.7 connects to the NLB node in zone a, the TCP listener on port 443 passes the connection to a target at 10.0.16.20 port 8443, and the target sees the source 198.51.100.7 directly.">
<div class="lb-row" aria-hidden="true"><span class="lb-row-name">ALB</span>
<div class="lb-hops"><span class="lb-hop">client<small><code>198.51.100.7</code></small></span><span class="lb-hop">DNS<small><code>app.example.com</code> → ALB node</small></span><span class="lb-hop">ALB node, zone a<small>public subnet <code>10.0.0.0/24</code></small></span><span class="lb-hop">listener<small>HTTPS 443, decrypts</small></span><span class="lb-hop">rule → target group<small><code>web</code></small></span><span class="lb-hop lb-hop-end">target <code>10.0.16.20:8080</code><small>new connection from <code>10.0.0.37</code><br>sees source <code>10.0.0.37</code><br><code>X-Forwarded-For: 198.51.100.7</code></small></span></div></div>
<div class="lb-row" aria-hidden="true"><span class="lb-row-name">NLB, client IP preservation on</span>
<div class="lb-hops"><span class="lb-hop">client<small><code>198.51.100.7</code></small></span><span class="lb-hop">DNS<small><code>app.example.com</code> → NLB node</small></span><span class="lb-hop">NLB node, zone a<small>public subnet <code>10.0.0.0/24</code></small></span><span class="lb-hop">listener<small>TCP 443, never decrypts</small></span><span class="lb-hop">target group</span><span class="lb-hop lb-hop-end">target <code>10.0.16.20:8443</code><small>same connection, passed through<br>sees source <code>198.51.100.7</code></small></span></div></div>
</div>

<p class="bitgrid-caption">An ALB makes two connections, client to node and node to target, so the target has to read the client's address from a header. An NLB with client IP preservation hands the target the client's own connection.</p>

### Security groups on both sides

A **security group** is AWS's per-resource firewall: a list of what's allowed in and out of one load balancer or server, with everything else dropped. An ALB and its targets each have one, and they have to agree. AWS recommends letting clients reach the load balancer's listener port, and letting only the load balancer's security group reach the targets, on both the traffic port and the health check port [@aws-alb-security-groups]:

| Security group | Direction | Port | Allowed | Why |
|---|---|---|---|---|
| `alb-sg`, on the ALB | inbound | TCP 443 | `0.0.0.0/0`, anywhere | Clients reach the HTTPS listener |
| `alb-sg`, on the ALB | outbound | TCP 8080 | `web-sg` | The ALB reaches targets, for requests and health checks |
| `web-sg`, on each target | inbound | TCP 8080 | `alb-sg` | Only the ALB reaches the app |

Using `alb-sg` as the source, instead of an address range, keeps working as the ALB's nodes change addresses. Leave the `web-sg` rule out and the health checks can't reach the targets, so every target shows as unhealthy [@aws-alb-troubleshooting]. The ALB fails open and keeps trying them anyway, but the connections still can't get through, and clients get `504 Gateway Timeout` once the ALB gives up connecting [@aws-alb-health-checks, @aws-alb-troubleshooting]. When every target goes unhealthy at the same moment, check the security groups before the app.

Each load balancer is also its own entry point, with its own DNS name, its own security group, and its own list of who's allowed to reach it. Every one you add is another set of rules to keep track of, which adds up quickly when each non-HTTP service gets an NLB of its own.

## Terminating TLS

TLS is the encryption in HTTPS (and in plenty of other protocols) [@rfc9846, @rfc9110], set up by a short [handshake](/primers/networking/tls-handshake/) at the start of each connection. **Terminating** TLS means being the end of the encrypted connection: holding the certificate and private key, decrypting what comes in, and handing the plain request to whatever's behind it. Where that happens matters, because whatever terminates TLS is the only thing that can see inside the traffic.

There are three common places:

- **At the load balancer.** The ALB (or an NLB with a TLS listener) holds the certificate and decrypts. It can then send the request on to the targets unencrypted inside the VPC, or re-encrypt it with a second TLS connection to the target if everything has to be encrypted in transit. For that second connection the target needs a certificate of its own, and the ALB doesn't validate it, so a self-signed one works [@aws-alb-target-groups].
- **Passed through to the server.** An NLB with a plain TCP listener on port 443 forwards the encrypted bytes untouched, and the server behind it terminates TLS itself. The load balancer never sees inside.
- **On the server, with no load balancer at all.** A reverse proxy running on the server terminates TLS and forwards to the app on the same machine. There's a [section on this below](#https-on-one-server-without-a-load-balancer).

Here are the four setups side by side, with the encrypted stretches marked:

<div class="lb-term" role="img" aria-label="Four places to terminate TLS. One: client to ALB is encrypted with TLS, the ALB holds the certificate, and ALB to target is plain HTTP. Two: client to ALB is encrypted, the ALB holds the certificate and decrypts, then ALB to target is encrypted again with a second TLS connection using the target's own certificate. Three: client to NLB with a TCP listener is encrypted, the NLB passes the encrypted bytes through untouched, and the server holds the certificate and decrypts. Four: client to a reverse proxy such as Caddy on the server is encrypted, the proxy holds the certificate, and the proxy forwards plain HTTP to the app on 127.0.0.1 port 8000 on the same machine.">
<div class="lb-term-row" aria-hidden="true"><span class="lb-row-name">ALB, plain to targets</span><div class="lb-chain"><span class="lb-end">client</span><span class="lb-link lb-enc">TLS</span><span class="lb-end lb-cert">ALB<small>certificate</small></span><span class="lb-link">HTTP</span><span class="lb-end">target</span></div></div>
<div class="lb-term-row" aria-hidden="true"><span class="lb-row-name">ALB, re-encrypting</span><div class="lb-chain"><span class="lb-end">client</span><span class="lb-link lb-enc">TLS</span><span class="lb-end lb-cert">ALB<small>certificate</small></span><span class="lb-link lb-enc">TLS</span><span class="lb-end lb-cert">target<small>its own certificate</small></span></div></div>
<div class="lb-term-row" aria-hidden="true"><span class="lb-row-name">NLB, TCP pass-through</span><div class="lb-chain"><span class="lb-end">client</span><span class="lb-link lb-enc">TLS</span><span class="lb-end lb-pass">NLB<small>can't read it</small></span><span class="lb-link lb-enc">same TLS</span><span class="lb-end lb-cert">server<small>certificate</small></span></div></div>
<div class="lb-term-row" aria-hidden="true"><span class="lb-row-name">Proxy on the server</span><div class="lb-chain"><span class="lb-end">client</span><span class="lb-link lb-enc">TLS</span><span class="lb-end lb-cert">Caddy :443<small>certificate</small></span><span class="lb-link">HTTP</span><span class="lb-end">app<small><code>127.0.0.1:8000</code>, same machine</small></span></div></div>
<div class="lb-term-key" aria-hidden="true"><span><span class="lb-key lb-key-enc"></span>encrypted</span><span><span class="lb-key lb-key-plain"></span>plain HTTP</span><span><span class="lb-key lb-key-cert"></span>holds a certificate and decrypts</span></div>
</div>

<p class="bitgrid-caption">In the last row the plain stretch never leaves the machine, so it's as private as the app itself.</p>

| | Where the certificate lives | Can route by path | AWS WAF | Who sees a client certificate (mTLS) |
|---|---|---|---|---|
| ALB, plain to targets | On the ALB | Yes | Yes | The ALB, or the app if the ALB forwards it ([below](#mtls-the-client-proves-who-it-is-too)) |
| ALB, re-encrypting | On the ALB, plus one on each target | Yes | Yes | Same as above |
| NLB, TCP pass-through | On each server | No | No | The server |
| Proxy on the server | On the server, for the proxy | Only within that one server | No | The proxy |

The WAF column follows from where AWS WAF can attach: ALBs, CloudFront, and API Gateway, but not NLBs or your own servers [@aws-waf-resources]. A proxy like Caddy can route by path with request matchers [@caddy-caddyfile-concepts], and can ask clients for certificates if it's set up to [@caddy-tls-directive].

### SNI: many certificates on one address

One load balancer often serves several hostnames, each with its own certificate. The client says which hostname it wants at the very start of the TLS handshake, before anything is encrypted, using an extension called **SNI** (Server Name Indication) [@rfc6066]. The load balancer uses that to pick the right certificate. Without SNI, every hostname on an address would need to share one certificate.

### SNI on an ALB or NLB

There's no SNI setting to turn on. A secure listener (HTTPS on an ALB, TLS on an NLB) has two places for certificates, and SNI happens automatically as soon as the second one is used [@aws-alb-certificates, @aws-nlb-certificates]:

- **The default certificate,** the one you choose when you create the listener. Every secure listener has one.
- **The certificate list,** under the listener's Certificates tab (or the `AddListenerCertificates` API), for extra certificates. An ALB takes up to 25 beyond the default before you need a quota increase [@aws-alb-quotas].

If a listener only has the default certificate, or one wildcard or multi-name certificate that covers everything, there's nothing to choose between, so SNI is still sent on every connection but never changes anything. That's why it's easy to run load balancers for years without noticing it.

When there is a choice, a connection to `api.example.org` goes like this:

1. **The client's first handshake message names the host** it wants: `api.example.org`.
2. **The load balancer looks for certificates that cover that name** in the certificate list. One match gets used. If several match (an exact certificate and a wildcard, say), it picks the best one the client supports, preferring ECDSA keys over RSA and unexpired certificates over expired ones [@aws-alb-certificates].
3. **No match, or no hostname sent at all, falls back to the default certificate.**
4. **The handshake finishes, the request gets decrypted,** and only then do the listener rules run.

Step 4 is why SNI is easy to mix up with host-based routing, even though they're separate steps. **SNI picks the certificate,** during the handshake, before anything is decrypted. **The `Host` header picks the target group,** through the listener rules, after decryption. Both usually carry the same hostname, which makes them look like one feature.

A few details that matter in practice:

- A listener created in the console has its default certificate added to the certificate list too. One created through the API or CLI doesn't, and then the default is only a fallback that doesn't take part in matching [@aws-alb-certificates].
- On an NLB this only applies to a TLS listener. With a plain TCP listener the NLB never decrypts anything [@aws-nlb-listeners], so the servers behind it read SNI and pick their own certificates.
- The ALB's access logs record the hostname each client asked for and which certificate it got, which is the quickest way to answer "why did this client get the wrong certificate?" [@aws-alb-certificates]

## WAFs only work on HTTP

A **web application firewall (WAF)** inspects HTTP requests for attacks: SQL injection, cross-site scripting, bad bots, too many requests from one address. To see a request it has to be able to read it, so a WAF sits where TLS has already been terminated, on an ALB or in front of the site at a [CDN](/primers/networking/cdns-and-cloudfront/). AWS WAF, for example, attaches to ALBs, CloudFront, and API Gateway, but not to NLBs [@aws-waf-resources].

That means a WAF can't protect anything that isn't HTTP. A database connection or a message broker's protocol can't go through one, so non-HTTP traffic needs a different path: an NLB passing it through to a firewall, or a private connection like a VPN where it never touches the public internet at all. Designs with both kinds of traffic often end up splitting by protocol, with HTTP through the WAF and everything else through a separate path.

## mTLS: the client proves who it is too

In normal HTTPS only the server shows a certificate, and the client decides whether to trust it. In **mutual TLS (mTLS)** the client presents a certificate too, and the server checks it against the certificate authorities it trusts. It's common for machine-to-machine connections, where there's no person to type a password.

mTLS and TLS termination have to be planned together, because whatever terminates TLS is what sees the client's certificate:

- **ALB in verify mode:** the ALB checks the client certificate itself, against a trust store (a bundle of CA certificates) you upload [@aws-alb-mtls].
- **ALB in passthrough mode:** the ALB accepts the client certificate and forwards it to your app in HTTP headers, so the app makes the decision [@aws-alb-mtls].
- **NLB:** doesn't support mTLS on a TLS listener. Use a TCP listener instead, so the encrypted connection passes straight through and the server does the mTLS itself [@aws-nlb-listeners].

A WAF or proxy that terminates TLS in the middle, and isn't set up for mTLS, breaks it, because the client's certificate proves something only to whatever it was presented to.

mTLS is also one of the tools for **zero trust**, the idea that being on the right network shouldn't be enough to get access, and that every request gets authenticated and authorized on its own, wherever it comes from [@nist-sp-800-207]. Picture the service as a door. Routes and security groups decide who can reach the door at all, and that's still worth doing, but it isn't zero trust by itself. Zero trust is checking everyone who walks through it, whether with mTLS on every connection or with authentication on every request.

## HTTPS on one server without a load balancer

Sometimes all you need is HTTPS in front of one small internal service. Browsers give a page loaded over plain HTTP fewer abilities than one loaded over HTTPS: features like service workers and the clipboard API only work in a **secure context**, which means a page served over HTTPS or from `localhost` [@mdn-secure-contexts, @mdn-secure-contexts-features]. So an internal tool on `http://…:8000` can lose features in the browser even though it's only reachable over a VPN, and the same tool on `http://localhost:8000` worked fine on the developer's own laptop.

A load balancer works, but for one instance with nothing to balance it's a recurring cost and another resource to manage. A reverse proxy on the server itself does the same job ([Proxies, reverse proxies, and bastion hosts](/primers/networking/proxies-and-bastions/#reverse-proxies) covers them in general):

1. The app keeps running unchanged, but listens only on `127.0.0.1:8000`, so nothing off the machine can reach it directly.
2. A reverse proxy listens on port 443 with the certificate, terminates TLS, and forwards each request to `localhost:8000`.
3. The security group swaps its port 8000 rule for a port 443 rule from the same sources, so the only way in is through the proxy.

Caddy is a popular choice for this. nginx and HAProxy do the same job with more setup. A whole Caddy config can be this short:

```
app.example.com {
    tls /etc/caddy/certs/cert.pem /etc/caddy/certs/key.pem
    reverse_proxy localhost:8000
}
```

- **`app.example.com { … }`** is a site block: everything inside applies to requests for that hostname [@caddy-caddyfile-concepts].
- **`tls <cert> <key>`** tells Caddy to use the certificate and private key in those two files [@caddy-tls-directive]. Loading certificates by hand like this turns off Caddy's automatic certificates for that name, so renewing the files is now your job [@caddy-tls-directive, @caddy-automatic-https].
- **`reverse_proxy localhost:8000`** forwards each request to the app, adding the `X-Forwarded-For` and `X-Forwarded-Proto` headers on the way [@caddy-reverse-proxy].

Leave the `tls` line out and Caddy gets and renews a certificate on its own, which is what it's best known for. That only works when the certificate authority can check that you control the name: the name's DNS records point at the server and ports 80 and 443 are reachable from the internet, or Caddy has credentials for your DNS provider so it can prove control with a DNS record instead [@caddy-automatic-https]. A server that's only reachable over a VPN can't pass the first kind of check, so it needs either the DNS challenge or certificate files you supply, as above.

Getting the certificate onto the box is the harder part, and it's covered in [Certificates and Trust](/primers/networking/certificates-and-trust/).

### The Host header problem

Putting a proxy in front of an app can break the app in a confusing way. The browser or client asks for `app.example.com`, and the proxy forwards that hostname to the app in the `Host` header. Some apps check the `Host` header against an allowlist to defend against an attack called DNS rebinding, and an app bound to `127.0.0.1` may default that allowlist to just `localhost`. Every proxied request then gets rejected, often with `421 Misdirected Request` [@rfc9110] or "Invalid Host header", even though the certificate and proxy are fine.

The fix is to add the real hostname to the app's allowlist, not to turn the check off. Proxies also add headers like `X-Forwarded-For` (the client's real address) [@mdn-x-forwarded-for] and `X-Forwarded-Proto` (whether the original request was HTTPS) [@mdn-x-forwarded-proto], which apps behind a proxy often need to read to log and redirect correctly.

The proxy doesn't change who can reach the service. The security group still decides that. It only changes how the connection is secured.
