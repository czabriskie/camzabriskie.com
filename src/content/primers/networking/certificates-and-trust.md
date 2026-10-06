---
title: Certificates and Trust
description: How a hostname reaches a server, what a TLS certificate actually proves, how you get one, and what to do when a client refuses to trust it.
order: 4
updated: 2026-10-05
---

Every HTTPS connection depends on two lookups. DNS turns a name into an address, and the certificate proves the server at that address is allowed to answer for the name. Most "it works in the browser but not in my tool" problems come from the second one.

## DNS names

A few record types do most of the work. ([How DNS resolution works](/primers/networking/dns-resolution/) covers how a lookup actually finds them.)

- An **A record** maps a name to an IPv4 address (`app.example.com → 203.0.113.10`). An **AAAA record** does the same for IPv6.
- A **CNAME record** says one name is really another name: `app.example.com → my-lb-1234567890.us-east-1.elb.amazonaws.com`. The client follows the alias and looks up the real name [@rfc1034]. Load balancers get long generated names and addresses that can change, so you point a friendly name at them with a CNAME and never deal with their addresses directly.
- A CNAME isn't allowed at the root of a domain (the zone apex, `example.com` itself). In Route 53, AWS's DNS service, an **alias record** fills that gap. It works like a CNAME to an AWS resource, but it's allowed at the apex [@aws-route53-alias].
- A **TXT record** holds arbitrary text, and it's how you prove to outside services (certificate authorities included) that you control a domain.

## What a certificate proves

A TLS certificate says "this public key belongs to these names," signed by a **certificate authority (CA)** that checked. During the handshake the server shows its certificate and proves it holds the matching private key [@rfc5280, @rfc8446]. The client checks three things:

1. **The name matches.** The hostname the client asked for is on the certificate.
2. **It's in date.** Certificates expire, and an expired one is rejected even if nothing else changed.
3. **It chains to a CA the client trusts.** More on that below.

### SANs and wildcards

One certificate can cover several names. They're listed as **Subject Alternative Names (SANs)**, so one certificate might cover `example.com`, `app.example.com`, and `api.example.com` at once.

A **wildcard** like `*.example.com` covers any single name in that position, so `app.example.com` and `new-thing.example.com` both match and new subdomains don't need a new certificate. It only covers one level, so `a.b.example.com` doesn't match, and it doesn't cover `example.com` itself. Certificates often list both `example.com` and `*.example.com` for that reason.

### The chain of trust

CAs don't sign server certificates with their most valuable key. The chain usually has three links:

- A **root certificate**, which is built into operating systems, browsers, and language runtimes. That built-in list is the **trust store** [@rfc5280, @mozilla-root-store].
- One or more **intermediate certificates**, signed by the root.
- The **leaf certificate**, the server's own, signed by an intermediate.

The server is supposed to send its leaf certificate plus the intermediates, and the client connects them up to a root in its trust store. If the server forgets the intermediates, some clients cope (browsers often fetch or cache them) and others fail, which is one way a site can work in a browser and fail from a script.

## Getting a certificate

Before a public CA issues a certificate, it checks that you control the domain. The automated way is the **ACME** protocol, which Let's Encrypt made popular and tools like Caddy and certbot speak. ACME gives you a few ways to prove control [@rfc8555, @letsencrypt-challenges]:

| Challenge | How you prove control | Needs |
|---|---|---|
| **HTTP-01** | Serve a token the CA gives you at `http://<your domain>/.well-known/acme-challenge/…` | The server reachable from the internet on port 80 |
| **DNS-01** | Create a TXT record at `_acme-challenge.<your domain>` with the token | API access to your DNS, but no inbound access to the server at all |
| **TLS-ALPN-01** | Answer a special TLS handshake on port 443 | The server reachable from the internet on port 443 |

HTTP-01 is the simplest, but it can't work for a server that's only reachable over a VPN, because the CA has to reach it from the public internet. DNS-01 works for completely private servers, since the CA only ever looks at public DNS, and it's also the only challenge that can issue wildcard certificates [@letsencrypt-challenges].

Certificates from Let's Encrypt are short-lived, so renewal has to be automatic. A certificate that someone renews by hand eventually gets forgotten.

### CAA records can block a CA entirely

A domain can publish a **CAA record** listing which CAs are allowed to issue certificates for it:

```
example.com.  CAA  0 issue "letsencrypt.org"
```

CAs are required to check it before issuing [@rfc8659]. If the domain's CAA record only lists Amazon's CAs, for example, Let's Encrypt will refuse with a CAA error no matter how the challenge is set up, and retrying won't help. The only ways around it are changing the CAA record (a policy decision for the whole domain) or using a CA that's on the list. If a domain has no CAA record, any CA can issue.

### AWS Certificate Manager

**ACM** is AWS's certificate service. Its public certificates are free to use with AWS's own services (load balancers, CloudFront, API Gateway), they're validated through DNS, and ACM renews them automatically for as long as they're in use [@aws-acm-faq, @aws-acm-dns-renewal]. You never see the private key, which is the point [@aws-acm-exportable-blog]: ACM attaches the certificate to the load balancer and handles everything itself.

ACM checks CAA records too. If a domain has one, it has to list `amazon.com`, `amazontrust.com`, `awstrust.com`, or `amazonaws.com` [@aws-acm-caa].

To use an ACM certificate somewhere ACM can't attach it, like a reverse proxy on an EC2 instance, you need an **exportable** certificate:

- Export has to be turned on when the certificate is requested. It can't be added later, and older certificates can't be exported [@aws-acm-exportable-blog].
- Exportable certificates cost a fee per name when they're issued and again at each renewal, unlike the free non-exportable ones [@aws-acm-pricing].
- ACM renews the certificate on its side, but the copy you exported to a server doesn't update itself [@aws-acm-exportable]. Something has to re-export it and reload the server on a schedule, and that job is the first thing to check if HTTPS stops working months later.

## Trusting a private CA

Companies often run their own internal CA for internal services, and corporate networks sometimes inspect TLS traffic with a [proxy](/primers/networking/proxies-and-bastions/#forward-proxies) that re-signs every certificate with a company CA. Either way, clients only trust those certificates if the company's root certificate is in their trust store, and different tools have different trust stores:

| Client | Where it looks | How to add a CA |
|---|---|---|
| Browsers, most system tools | The operating system's store | Install it in the OS keychain or certificate store |
| `curl` | The system store, usually | `--cacert bundle.pem` |
| Python (`requests`) | Its own bundle (`certifi`), not the OS store | `REQUESTS_CA_BUNDLE=/path/bundle.pem` [@python-requests-advanced] |
| Node.js | Its own built-in list | `NODE_EXTRA_CA_CERTS=/path/bundle.pem` [@node-cli] |
| Java (and JDBC drivers) | A Java truststore file (JKS or PKCS12) | Import into a truststore with `keytool` |

So a site can work in a browser and fail from Python or Java on the same laptop, because the browser trusts the company CA and the runtime has never heard of it.

### PEM files and bundles

Certificates usually travel as **PEM** files: base64 text between `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` lines. A **CA bundle** is just several PEM certificates pasted one after another in one file. Most tools take a bundle directly. Java doesn't.

### Building a Java truststore from a bundle

Java wants a truststore, and `keytool` imports one certificate at a time, each under its own name (alias). For a bundle, split it first and import each piece:

```bash
mkdir -p /tmp/certs && cd /tmp/certs
# split the bundle into cert1.pem, cert2.pem, ...
awk 'BEGIN{n=0} /BEGIN CERTIFICATE/{n++} {print > ("cert" n ".pem")}' ~/company-ca-bundle.pem

for f in cert*.pem; do
  grep -q "BEGIN CERTIFICATE" "$f" || continue
  keytool -importcert -noprompt -alias "company-${f%.pem}" -file "$f" \
    -keystore ~/truststore.p12 -storetype PKCS12 -storepass changeit
done

keytool -list -keystore ~/truststore.p12 -storetype PKCS12 -storepass changeit
```

(`changeit` is the traditional default Java truststore password, not a secret [@java-keytool]. Use your own if it matters.)

Then point the Java client at it. A JDBC driver usually takes this as connection properties. The Trino driver, for example, wants `SSL=true`, `SSLTrustStorePath`, `SSLTrustStorePassword`, and, if the file isn't the JVM's default keystore type, `SSLTrustStoreType=PKCS12` [@trino-jdbc]. A Java app in general takes `-Djavax.net.ssl.trustStore=…` and `-Djavax.net.ssl.trustStorePassword=…`.

## Reading the errors

| Error | What it usually means |
|---|---|
| `PKIX path building failed` (Java) | Java couldn't chain the certificate to anything in its truststore. The CA is missing, or the truststore path or password is wrong. |
| `CERTIFICATE_VERIFY_FAILED` (Python) | The same thing in Python: the CA isn't in the bundle it's using. |
| Hostname mismatch / `certificate is not valid for` | The name you connected to isn't on the certificate. Often you connected by IP address or by an internal name instead of the name on the certificate. |
| `certificate has expired` | It has. Check whether something was supposed to renew it. |
| `Connect timed out` | Not a certificate problem. Nothing answered on that address and port: wrong port, a firewall, or a VPN that isn't connected. Internal ports (like `8080` inside a Kubernetes cluster) usually aren't reachable from outside, so connect through the ingress or load balancer on 443 instead. |
| "requires SSL" / "credentials need TLS" | The server refuses to accept passwords over an unencrypted connection. Turn TLS on in the client. |

To see what a server is actually sending, `openssl` will show you the whole chain:

```bash
openssl s_client -connect app.example.com:443 -servername app.example.com -showcerts
```

The `-servername` flag sends SNI, the hostname the client wants, so a server hosting several names returns the right certificate [@openssl-s-client]. Saving one of those certificates to a file and running `openssl x509 -in cert.pem -noout -text` shows its names, issuer, and expiry date.
