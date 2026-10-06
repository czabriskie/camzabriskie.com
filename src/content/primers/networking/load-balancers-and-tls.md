---
title: Load balancers and TLS termination
description: Layer 4 vs. layer 7, NLBs vs. ALBs, what it means to terminate TLS, and how to put HTTPS in front of a single server without a load balancer at all.
order: 3
updated: 2026-10-05
---

Anything that accepts traffic from outside a private network sits behind something: a load balancer, a firewall, a reverse proxy. The kind of traffic decides which of those can do the job, and the first question is always whether it's HTTP or not.

This builds on [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/), mostly for public vs. private subnets and security groups.

## Layer 4 and layer 7

Networking gets described in layers (the [OSI model](/primers/networking/osi-model/), which has its own primer). Two of them matter here:

- **Layer 4** is TCP and UDP: a connection between two addresses and ports, with no idea what's inside it.
- **Layer 7** is the application protocol riding on top, like HTTP. At this layer you can see URLs, hostnames, headers, and cookies.

Something working at layer 4 can forward any kind of traffic, because it never looks inside. Something working at layer 7 can make much smarter decisions, but only for the protocol it understands.

## NLBs and ALBs

AWS has a load balancer for each.

A **Network Load Balancer (NLB)** works at layer 4. With a TCP listener it forwards connections without looking inside them, which makes it the one to use for anything that isn't HTTP: databases, message brokers, SSH, anything with its own protocol. It can also terminate TLS with a TLS listener (more on that below), but it still doesn't understand HTTP [@aws-nlb-intro, @aws-nlb-listeners].

An **Application Load Balancer (ALB)** works at layer 7. It understands HTTP and HTTPS (including HTTP/2 and gRPC [@aws-alb-target-groups]), so it can route `/api/*` to one set of servers and `/admin/*` to another, send different hostnames to different apps, add headers, and redirect HTTP to HTTPS [@aws-alb-intro, @aws-alb-header-modification].

| | NLB | ALB |
|---|---|---|
| Layer | 4 (TCP, UDP, TLS) | 7 (HTTP, HTTPS) |
| Sees inside the traffic | No | Yes: paths, hostnames, headers |
| Good for | Non-HTTP protocols, very high throughput, fixed IP addresses | Web apps and APIs, routing by path or hostname |
| Works with a WAF | No | Yes |

### Listeners and target groups

Both kinds are set up the same way. A **listener** waits on a port (say 443) and has rules for what to do with what arrives. The rules forward to a **target group**, the set of instances, IP addresses, or containers doing the actual work (an ALB can also send to Lambda functions). The load balancer health-checks each target and stops sending traffic to any that fail [@aws-alb-intro].

Each load balancer is its own entry point, with its own DNS name, its own security group, and its own list of who's allowed to reach it. Every one you add is another set of rules to keep track of, which adds up quickly when each non-HTTP service gets an NLB of its own.

## Terminating TLS

TLS is the encryption in HTTPS (and in plenty of other protocols) [@rfc8446, @rfc9110]. **Terminating** TLS means being the end of the encrypted connection: holding the certificate and private key, decrypting what comes in, and handing the plain request to whatever's behind it. Where that happens matters, because whatever terminates TLS is the only thing that can see inside the traffic.

There are three common places:

- **At the load balancer.** The ALB (or an NLB with a TLS listener) holds the certificate and decrypts. It can then send the request on to the targets unencrypted inside the VPC, or re-encrypt it with a second TLS connection to the target if everything has to be encrypted in transit.
- **Passed through to the server.** An NLB with a plain TCP listener on port 443 forwards the encrypted bytes untouched, and the server behind it terminates TLS itself. The load balancer never sees inside.
- **On the server, with no load balancer at all.** A reverse proxy running on the server terminates TLS and forwards to the app on the same machine. There's a section on this below.

### SNI: many certificates on one address

One load balancer often serves several hostnames, each with its own certificate. The client says which hostname it wants at the very start of the TLS handshake, before anything is encrypted, using an extension called **SNI** (Server Name Indication) [@rfc6066]. The load balancer uses that to pick the right certificate. Without SNI, every hostname on an address would need to share one certificate.

### SNI on an ALB or NLB

There's no SNI setting to turn on. A secure listener (HTTPS on an ALB, TLS on an NLB) has two places for certificates, and SNI happens automatically as soon as the second one is used [@aws-alb-certificates, @aws-nlb-certificates]:

- **The default certificate,** the one you choose when you create the listener. Every secure listener has one.
- **The certificate list,** under the listener's Certificates tab (or the `AddListenerCertificates` API), for extra certificates. An ALB takes up to 25 beyond the default before you need a quota increase [@aws-alb-quotas].

If a listener only has the default certificate, or one wildcard or multi-name certificate that covers everything, there's nothing to choose between, so SNI is still sent on every connection but never changes anything. That's why it's easy to run load balancers for years without noticing it.

When there is a choice, here's what happens for a connection to `api.example.org`:

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

## Zero trust

Zero trust is the idea that being on the right network shouldn't be enough to get access. Every request gets authenticated and authorized on its own, wherever it comes from [@nist-sp-800-207]. Keeping traffic on a private network is still worth doing, but it isn't zero trust by itself: a private path decides who can reach the door, and zero trust is about checking everyone who walks through it. mTLS is one of the tools for that, since every connection has to prove who's making it.

## HTTPS on one server without a load balancer

Sometimes all you need is HTTPS in front of one small internal service. Some clients refuse to connect to anything over plain HTTP unless it's `localhost`, so an internal tool listening on `http://…:8000` can get rejected even though it's only reachable over a VPN.

A load balancer works, but for one instance with nothing to balance it's a recurring cost and another resource to manage. A **reverse proxy** on the server itself does the same job ([Proxies, reverse proxies, and bastion hosts](/primers/networking/proxies-and-bastions/#reverse-proxies) covers them in general):

1. The app keeps running unchanged, but listens only on `127.0.0.1:8000`, so nothing off the machine can reach it directly.
2. A reverse proxy listens on port 443 with the certificate, terminates TLS, and forwards each request to `localhost:8000`.
3. The security group swaps its port 8000 rule for a port 443 rule from the same sources, so the only way in is through the proxy.

Caddy is a popular choice for this because it can get and renew certificates on its own [@caddy-automatic-https]. nginx and HAProxy do the same job with more setup. The whole Caddy config can be this short:

```
app.example.com {
    tls /etc/caddy/certs/cert.pem /etc/caddy/certs/key.pem
    reverse_proxy localhost:8000
}
```

Getting the certificate onto the box is the harder part, and it's covered in [Certificates and trust](/primers/networking/certificates-and-trust/).

### The Host header problem

Putting a proxy in front of an app can break the app in a confusing way. The browser or client asks for `app.example.com`, and the proxy forwards that hostname to the app in the `Host` header. Some apps check the `Host` header against an allowlist to defend against an attack called DNS rebinding, and an app bound to `127.0.0.1` may default that allowlist to just `localhost`. Every proxied request then gets rejected, often with `421 Misdirected Request` [@rfc9110] or "Invalid Host header", even though the certificate and proxy are fine.

The fix is to add the real hostname to the app's allowlist, not to turn the check off. Proxies also add headers like `X-Forwarded-For` (the client's real address) [@mdn-x-forwarded-for] and `X-Forwarded-Proto` (whether the original request was HTTPS) [@mdn-x-forwarded-proto], which apps behind a proxy often need to read to log and redirect correctly.

The proxy doesn't change who can reach the service. The security group still decides that. It only changes how the connection is secured.
