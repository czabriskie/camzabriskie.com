---
title: Certificates and Trust
description: What a TLS certificate is, how keys and signatures make it trustworthy, what root, intermediate, and leaf certificates are for, how you get one, and what to do when a client refuses to trust it.
order: 6
updated: 2026-10-08
---

When you open `https://app.example.com`, your browser needs answers to two questions before it sends anything: is this really `app.example.com`, and not someone sitting in the middle pretending to be it? And can anyone else read what we're about to say to each other? A **TLS certificate** answers the first question, and the same exchange sets up the encryption that answers the second.

That exchange is the **TLS handshake**: the first few messages of every HTTPS connection, before any page is sent, where the server shows its certificate and the two sides agree on encryption keys [@rfc9846]. [The TLS handshake](/primers/networking/tls-handshake/) walks through that exchange message by message. This primer is about the certificate part: what it is, why browsers believe it, how you get one, and what to do when something refuses to trust yours.

## Keys and signatures

Certificates are built on signatures, and signatures are built on key pairs. A **key pair** is two keys that only work together:

- The **private key** is kept secret by its owner. It's used to **sign** things.
- The **public key** is handed out to anyone. It's used to **check** signatures.

A signature made with the private key can be checked by anyone holding the matching public key, and the check proves two things: the signature was made by whoever has the private key, and the thing signed hasn't been changed since. Nobody can make a valid signature without the private key, even with the public key in hand.

A wax seal is a decent way to picture it. Only one signet ring can press that seal (the private key), but anyone who knows what the seal looks like (the public key) can tell whether a letter carries it and whether it's been opened.

## What's inside a certificate

A certificate is a small file that says, in effect, "this public key belongs to this name, until this date," with a signature from someone vouching for it [@rfc5280]. Here are the main fields of the certificate this site, `camzabriskie.com`, was using when this primer was written:

| Field | Value | What it means |
|---|---|---|
| **Subject** | `camzabriskie.com` | Who the certificate is about. |
| **Subject Alternative Names** | `camzabriskie.com`, `www.camzabriskie.com` | Every name the certificate is valid for. This is the list browsers actually check. |
| **Issuer** | `Let's Encrypt YR1` | Who signed it. |
| **Valid from / to** | Aug 18, 2026 to Nov 16, 2026 | It's rejected outside these dates. |
| **Public key** | RSA, 2048 bits | The site's public key. The matching private key stays on the server. |
| **Signature** | Made with Let's Encrypt YR1's private key | The issuer vouching for everything above. |

You can look at any site's certificate the same way. Type a site into the box and the command fills itself in:

<div class="cmd-builder" data-default="camzabriskie.com" data-label="Site"></div>

```bash tab="macOS / Linux"
openssl s_client -connect camzabriskie.com:443 -servername camzabriskie.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

```powershell tab="Windows (PowerShell)"
$null | openssl s_client -connect camzabriskie.com:443 -servername camzabriskie.com 2>$null |
  openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

Windows doesn't include OpenSSL, but Git for Windows comes with it [@git-for-windows-release-notes], so if you have Git installed the macOS / Linux version works in Git Bash.

The **subject** says who a certificate is about, and the **issuer** says who signed it. One certificate's issuer is the next one's subject, and following those links from the site's certificate up to one your device already trusts is [the chain of trust](#the-chain-of-trust), which gets its own section further down.

### SANs and wildcards

One certificate can cover several names, listed as **Subject Alternative Names (SANs)**, so one certificate might cover `example.com`, `app.example.com`, and `api.example.com` at once [@rfc5280].

A **wildcard** like `*.example.com` covers any single name in that position, so `app.example.com` and `new-thing.example.com` both match and new subdomains don't need a new certificate. It only covers one level, so `a.b.example.com` doesn't match, and it doesn't cover `example.com` itself [@rfc9525]. Certificates often list both `example.com` and `*.example.com` for that reason.

## Certificate authorities

Anyone can make a key pair and write a certificate claiming to be `google.com`. A certificate is only as believable as whoever signed it. A **certificate authority (CA)** is an organization whose job is to check that you really control a domain before signing a certificate for it. Let's Encrypt, DigiCert, Sectigo, and Amazon (through AWS Certificate Manager) are all CAs.

Your browser believes a CA's signatures because the CA's **root certificate** came preinstalled on your device. The built-in list of root certificates your device trusts is its **trust store**. Operating systems and browsers each keep one, and the companies behind them decide which CAs get in [@mozilla-root-store]. Some programming languages bring their own too, which matters when [trusting a private CA](#trusting-a-private-ca). How CAs check that you control a domain is covered under [Getting a certificate](#getting-a-certificate).

## The chain of trust

A website's certificate isn't signed directly by the root. There's at least one certificate in between, so a typical chain has three links: root, intermediate, and leaf.

| | Root | Intermediate | Leaf |
|---|---|---|---|
| What it's for | The ultimate source of trust | The CA's day-to-day signing | Identifying one website |
| Signed by | Itself | A root | An intermediate |
| Who holds its private key | The CA, kept offline | The CA, in its signing systems | The website's server |
| How your device gets it | Already installed, in the trust store | The server sends it | The server sends it |
| Typical lifetime | Decades | A few years | Months |

The names come from picturing a tree upside down, with the root at the top. A leaf certificate is also called the **end-entity** certificate.

<div class="cert-tree" role="img" aria-label="The certificate tree drawn upside down. Example Root CA is at the top. Two intermediates branch off it, Example Intermediate CA and Other Intermediate CA. Four website certificates hang off them as leaves. The path from Example Root CA through Example Intermediate CA to app.example.com is highlighted as that site's chain of trust.">
<svg viewBox="0 0 380 194" aria-hidden="true" focusable="false">
<line class="ct-on" x1="190" y1="42" x2="95" y2="78"/>
<line class="ct-off" x1="190" y1="42" x2="285" y2="78"/>
<line class="ct-off" x1="95" y1="116" x2="47.5" y2="152"/>
<line class="ct-on" x1="95" y1="116" x2="142.5" y2="152"/>
<line class="ct-off" x1="285" y1="116" x2="237.5" y2="152"/>
<line class="ct-off" x1="285" y1="116" x2="332.5" y2="152"/>
<g class="ct-root ct-on"><rect x="135" y="4" width="120" height="38" rx="6"/><text class="ct-kind" x="195" y="19">root</text><text class="ct-name" x="195" y="34">Example Root CA</text></g>
<g class="ct-mid ct-on"><rect x="29" y="78" width="132" height="38" rx="6"/><text class="ct-kind" x="95" y="93">intermediate</text><text class="ct-name" x="95" y="108">Example Intermediate CA</text></g>
<g class="ct-mid ct-off"><rect x="219" y="78" width="132" height="38" rx="6"/><text class="ct-kind" x="285" y="93">intermediate</text><text class="ct-name" x="285" y="108">Other Intermediate CA</text></g>
<g class="ct-leaf ct-off"><rect x="3.5" y="152" width="88" height="38" rx="6"/><text class="ct-kind" x="47.5" y="167">leaf</text><text class="ct-name" x="47.5" y="182">example.com</text></g>
<g class="ct-leaf ct-on"><rect x="98.5" y="152" width="88" height="38" rx="6"/><text class="ct-kind" x="142.5" y="167">leaf</text><text class="ct-name" x="142.5" y="182">app.example.com</text></g>
<g class="ct-leaf ct-off"><rect x="193.5" y="152" width="88" height="38" rx="6"/><text class="ct-kind" x="237.5" y="167">leaf</text><text class="ct-name" x="237.5" y="182">example.org</text></g>
<g class="ct-leaf ct-off"><rect x="288.5" y="152" width="88" height="38" rx="6"/><text class="ct-kind" x="332.5" y="167">leaf</text><text class="ct-name" x="332.5" y="182">example.net</text></g>
</svg>
</div>

<p class="bitgrid-caption">The highlighted branch is the chain of trust for app.example.com. Other sites hang off the same root through their own branches.</p>

- **Root certificate** (Example Root CA): signs itself. It's already on your device, in the trust store, and that's the only reason it's trusted.
- **Intermediate certificate** (Example Intermediate CA): signed with the root's private key, and sent by the server. It does the CA's day-to-day signing, so the root's key can stay offline.
- **Leaf certificate** (app.example.com): signed with the intermediate's private key, and sent by the server. It names the site and holds the site's public key.

Trust flows down from the root, but checking goes the other way. The client starts at the leaf and works its way up, checking each signature with the public key of the certificate above, until it reaches a root it already has.

A passport is a useful comparison. A country's national seal is the root: every border agent has been taught to recognize it in advance. The passport office is the intermediate, authorized under that seal to issue passports every day. Your passport is the leaf, issued by that office and naming you. The border agent has never seen your passport before, but can trace its authority back to a seal they already trust.

### Why there's a middle step

The root's private key is the most valuable thing a CA has. If it ever leaked, anyone could sign a certificate for any website, and the only fix would be removing that root from every trust store in the world, which takes years of software updates. So the root key is kept offline and used rarely, mostly to sign intermediates. Let's Encrypt puts it plainly: its root keys are "kept safely offline," and it issues website certificates from its intermediates [@letsencrypt-chains]. The industry rules go further: a root's private key isn't allowed to sign website certificates directly at all, only intermediates and a few special cases [@cabf-baseline-requirements].

The intermediates do the daily signing. If one is ever compromised, the CA can **revoke** it, which means publishing a signed notice that the certificate shouldn't be trusted anymore even though it hasn't expired [@rfc5280], and then issue a new one, and nobody's trust store has to change.

A root also signs its own certificate, which sounds circular, because it is. A root's self-signature proves nothing. A root is trusted for exactly one reason: it's already in your trust store.

### A real chain: this site's

Here's the chain `camzabriskie.com` sent when this primer was written, from `openssl s_client -showcerts`. Each certificate's **issuer** matches the **subject** of the next row down, which is how the client links them up:

| Depth | Subject (who it's about) | Issuer (who signed it) | Valid |
|---|---|---|---|
| 0 (leaf) | `camzabriskie.com` | Let's Encrypt YR1 | 90 days, Aug 2026 to Nov 2026 |
| 1 (intermediate) | Let's Encrypt YR1 | ISRG Root YR | 3 years, 2025 to 2028 |
| 2 (cross-sign) | ISRG Root YR | ISRG Root X1 | 2026 to 2032 |
| (in your trust store) | ISRG Root X1 | itself | 20 years, 2015 to 2035 |

That's one more link than the textbook three, and it's a common real-world wrinkle called **cross-signing**. ISRG Root YR is a newer Let's Encrypt root, and new roots take years to reach every device's trust store. So the older, widely trusted ISRG Root X1 has signed a certificate for Root YR, and the server sends that along. A device that already trusts Root YR can stop there. One that only knows X1 follows the chain one step further. Let's Encrypt lists this exact chain as its default [@letsencrypt-chains].

You can see the same chain in a browser by clicking the icon to the left of the address and opening the certificate details. Chrome and Safari draw it as a small tree with the root at the top. Firefox opens a page with one tab per certificate instead, starting with the site's certificate, then the intermediate, then the root.

### When the server leaves out the intermediate

The server is supposed to send its leaf certificate plus the intermediates, so the client can connect them up to a root in its trust store. If the server forgets the intermediates, some clients cope (browsers often fetch or cache them) and others fail, which is one way a site can work in a browser and fail from a script.

## What a certificate proves

When the server shows its certificate during the handshake, the client checks four things, and all of them have to pass:

1. **The name matches.** The hostname the client asked for is one of the certificate's SANs [@rfc9525].
2. **It's in date.** An expired certificate is rejected even if nothing else changed.
3. **It chains to a trusted root.** Each signature checks out with the public key of the certificate above it, up to a root in the trust store [@rfc5280].
4. **The server holds the private key.** Certificates are public, so anyone can send a copy of yours. During the handshake the server also signs the conversation with the certificate's private key (the [CertificateVerify](/primers/networking/tls-handshake/#the-tls-13-handshake-message-by-message) message), which an impostor can't do [@rfc9846].

Clients can also check whether a certificate has been [revoked](#why-theres-a-middle-step), but that check is patchy. Let's Encrypt says plainly that revocation "doesn't work very well," so a certificate with a leaked key can keep being accepted until it expires [@letsencrypt-short-lived]. That's part of why [certificate lifetimes keep getting shorter](#certificates-keep-getting-shorter-lived).

### Watching a browser check a certificate

Step through what a browser does with the certificates a server sends, or pick a scenario to see where each kind of problem gets caught. Real clients don't always run the checks in this order, but every one of them has to pass. The error messages are the ones OpenSSL reports [@openssl-verify-errors], with the browser's or Java's wording in parentheses where it's different, and a copied certificate without its key gets the handshake aborted with a `decrypt_error` alert [@rfc9846].

<div class="cert-walk"></div>

## Getting a certificate

Before a public CA issues a certificate, it checks that you control the domain. The automated way is the **ACME** protocol, which Let's Encrypt made popular and tools like Caddy and certbot speak. ACME gives you a few ways to prove control [@rfc8555, @rfc8737, @letsencrypt-challenges]:

| Challenge | How you prove control | Needs |
|---|---|---|
| **HTTP-01** | Serve a token the CA gives you at `http://<your domain>/.well-known/acme-challenge/…` | The server reachable from the internet on port 80 |
| **DNS-01** | Create a TXT record (a DNS record that just holds text) at `_acme-challenge.<your domain>` with a value derived from the token | API access to your DNS, but no inbound access to the server at all |
| **TLS-ALPN-01** | Answer a special TLS handshake on port 443 | The server reachable from the internet on port 443 |

HTTP-01 is the simplest, but it can't work for a server that's only reachable over a VPN, because the CA has to reach it from the public internet. DNS-01 works for completely private servers, since the CA only ever looks at public DNS, and it's also the only challenge that can issue wildcard certificates [@letsencrypt-challenges]. ([How DNS resolution works](/primers/networking/dns-resolution/#record-types) covers TXT and the other record types.)

### Certificates keep getting shorter-lived

The rules every public CA follows cap how long a website's certificate can last, and the cap is shrinking on a schedule [@cabf-baseline-requirements]:

| From | Maximum lifetime |
|---|---|
| March 15, 2026 | 200 days |
| March 15, 2027 | 100 days |
| March 15, 2029 | 47 days |

Let's Encrypt's certificates are already well under that (this site's lasts 90 days). Shorter lifetimes limit the damage if a private key leaks, since an expiry date works even when revocation doesn't [@letsencrypt-short-lived], but they mean renewal has to be automatic. A certificate that someone renews by hand eventually gets forgotten.

### Every certificate is public: Certificate Transparency

Public CAs record the certificates they issue in public, append-only **Certificate Transparency** logs that anyone can search [@rfc9162]. Chrome won't accept a public certificate that hasn't been logged [@chrome-ct-policy], so in practice every publicly trusted certificate ends up in them. Two things follow from that:

- **You can see every certificate ever issued for your domain,** with search tools like crt.sh, which is how domain owners spot a certificate they didn't ask for.
- **Every name on a public certificate is public too.** Putting an internal hostname like `db-primary.internal.example.com` on a certificate from a public CA publishes that name to the world. Internal names usually belong on certificates from a private CA instead.

### CAA records can block a CA entirely

**CAA** stands for **Certification Authority Authorization**. It's a type of DNS record, published alongside a domain's other records like its addresses and mail servers ([more on record types](/primers/networking/dns-resolution/#record-types)), and it lists which CAs are allowed to issue certificates for that domain [@rfc8659]:

```
example.com.  CAA  0 issue "letsencrypt.org"
```

Left to right, that's the domain, the record type, a flags field (`0` is the normal value), the tag `issue`, meaning "this CA may issue certificates for this domain," and the CA, named by its own domain. A domain that uses more than one CA lists each in its own `issue` record, and the `issuewild` tag does the same just for wildcard certificates [@rfc8659].

CAs are required to check it before issuing [@rfc8659, @cabf-baseline-requirements]. If the domain's CAA record only lists Amazon's CAs, for example, Let's Encrypt will refuse with a CAA error no matter how the challenge is set up, and retrying won't help. The only ways around it are changing the CAA record (a policy decision for the whole domain) or using a CA that's on the list. If a domain has no CAA record, any CA can issue.

### AWS Certificate Manager {only: AWS}

**ACM** is AWS's certificate service. Its public certificates are free to use with AWS's own services (load balancers, CloudFront, API Gateway). They can be validated through DNS, and ACM renews a DNS-validated certificate automatically as long as it's in use and the validation record stays in place [@aws-acm-faq, @aws-acm-dns-renewal]. ACM keeps the private key itself [@aws-acm-faq]: you never see it, and ACM attaches the certificate to the load balancer for you.

ACM checks CAA records too. If a domain has one, it has to list `amazon.com`, `amazontrust.com`, `awstrust.com`, or `amazonaws.com` [@aws-acm-caa].

<details class="aside">
<summary>Using an ACM certificate outside AWS's own services</summary>

To use an ACM certificate somewhere ACM can't attach it, like a reverse proxy on an EC2 instance, there are two options. The first is an **exportable** certificate:

- Export has to be turned on when the certificate is requested. It can't be added later, and older certificates can't be exported [@aws-acm-exportable-blog].
- Exportable certificates cost a fee per name when they're issued and again at each renewal, unlike the free non-exportable ones [@aws-acm-pricing].
- ACM renews the certificate on its side, but the copy you exported to a server doesn't update itself [@aws-acm-exportable]. Something has to re-export it and reload the server on a schedule, and that job is the first thing to check if HTTPS stops working months later.

The second is ACM's **ACME** support: an ACME client such as certbot runs on the server and requests and renews certificates from ACM itself, the same way it would with Let's Encrypt. Those certificates last at most 45 days and are also charged per name [@aws-acm-acme, @aws-acm-pricing].

</details>

## Self-signed certificates and your own CA

A **self-signed certificate** is one whose issuer is its own subject: it's signed with its own private key instead of a CA's. Every root certificate is self-signed, including the public ones in your trust store, so being self-signed isn't a problem by itself. The trouble starts when a *website's* certificate is self-signed, because then there's no chain to check. Nothing vouches for it, and a client can only trust it by having that exact certificate in its trust store.

There are three ways to get a certificate for a server, and they differ in who has to trust what:

| | Who signs the server's certificate | What each client needs | Good for |
|---|---|---|---|
| **A public CA** (Let's Encrypt, ACM) | A CA already in every trust store | Nothing | Anything with a public domain name |
| **Your own CA** | Your own root, through the same kind of chain a public CA uses | Your root, installed once | Internal services, several machines, a team |
| **Self-signed** | The certificate itself | That exact certificate, installed wherever it's used | One machine, quick local testing |

Public CAs aren't allowed to issue certificates for names that don't end in a real public top-level domain, like `db.internal` or `server01`, or for private addresses like `10.0.1.5` [@cabf-baseline-requirements]. Internal-only names are where your own CA or a self-signed certificate come in.

### When to use which

- **A public CA** for anything with a real domain name, which can include internal services if their names live under a domain you own, since [DNS-01](#getting-a-certificate) works for servers the CA can't reach. It's free with Let's Encrypt, and nobody has to install anything.
- **Your own CA** once more than one machine or person is involved. Clients trust the root once, every certificate it signs works after that, and replacing a server's certificate doesn't mean touching every client. In exchange, you have to guard the root's private key, because anyone who has it can make a certificate for any name, and your clients will believe it.
- **Self-signed** for a quick test on your own machine, where you're the only client. Don't make it work by clicking through the browser warning or turning checking off (`curl -k`, `verify=False` in Python), because that accepts *any* certificate, including an attacker's. Trust that specific certificate instead, by adding it to the trust store or pointing the client at it (`curl --cacert localhost.crt`).

### Making a self-signed certificate

One command makes a private key and a certificate signed with it:

```bash tab="macOS / Linux"
openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
  -keyout localhost.key -out localhost.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

```powershell tab="Windows (PowerShell)"
openssl req -x509 -newkey rsa:2048 -nodes -days 30 `
  -keyout localhost.key -out localhost.crt `
  -subj "/CN=localhost" `
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

`-x509` makes a finished certificate instead of a request for a CA, `-nodes` leaves the private key unencrypted on disk, and `-addext` puts the names in the SANs, the list clients actually check. A name that's only in the subject (`CN`) isn't enough. The result is two files: `localhost.crt`, which is safe to hand out, and `localhost.key`, which isn't.

On Windows, `New-SelfSignedCertificate` makes one without OpenSSL, though it puts the certificate in the Windows certificate store rather than in files [@ms-new-selfsignedcertificate].

### Making your own CA

Three steps: make the CA, make a key and a request for the server, then have the CA sign the request. The request is a **certificate signing request (CSR)**, which holds the server's public key and the name it wants, and it's the same thing you'd send to a public CA.

```bash tab="macOS / Linux"
# 1. the CA: a private key and a self-signed root certificate, marked as a CA
cat > ca.cnf <<'EOF'
[req]
distinguished_name = dn
x509_extensions = ca_ext
prompt = no

[dn]
CN = Example Dev Root CA

[ca_ext]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
EOF
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -config ca.cnf \
  -keyout ca.key -out ca.crt

# 2. the server: a private key and a certificate signing request
openssl req -newkey rsa:2048 -nodes \
  -keyout app.key -out app.csr -subj "/CN=app.example.com"

# 3. the CA signs the request, adding the name the server answers to
printf 'subjectAltName=DNS:app.example.com\n' > app.ext
openssl x509 -req -in app.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 30 -extfile app.ext -out app.crt

openssl verify -CAfile ca.crt app.crt
```

```powershell tab="Windows (PowerShell)"
# 1. the CA: a private key and a self-signed root certificate, marked as a CA
@'
[req]
distinguished_name = dn
x509_extensions = ca_ext
prompt = no

[dn]
CN = Example Dev Root CA

[ca_ext]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
'@ | Set-Content ca.cnf
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -config ca.cnf `
  -keyout ca.key -out ca.crt

# 2. the server: a private key and a certificate signing request
openssl req -newkey rsa:2048 -nodes `
  -keyout app.key -out app.csr -subj "/CN=app.example.com"

# 3. the CA signs the request, adding the name the server answers to
Set-Content app.ext 'subjectAltName=DNS:app.example.com'
openssl x509 -req -in app.csr -CA ca.crt -CAkey ca.key -CAcreateserial `
  -days 30 -extfile app.ext -out app.crt

openssl verify -CAfile ca.crt app.crt
```

The `ca.cnf` file marks the root as a CA (`CA:TRUE`) that's allowed to sign certificates (`keyCertSign`) [@rfc5280]. Some versions of OpenSSL add that on their own, but the LibreSSL that macOS ships as `openssl` doesn't, and a root without it can fail to verify in stricter clients, so it's spelled out here. The last command should print `app.crt: OK`.

The server gets `app.crt` and `app.key`. Clients get `ca.crt`, installed the way the next section describes. `ca.key` goes nowhere: it can sign a certificate for any name, so it belongs offline, or at least somewhere much safer than the server.

## Trusting a private CA

Companies often run their own internal CA for internal services, and corporate networks sometimes inspect TLS traffic with a [proxy](/primers/networking/proxies-and-bastions/#forward-proxies) that re-signs every certificate with a company CA. Either way, it's the same chain of trust with a different root: clients only trust those certificates if the company's root certificate is in their trust store.

Certificates usually travel as **PEM** files. PEM is a format, not a count: each certificate is its binary data written out in base64 (a way of turning binary data into plain letters and digits) between a `-----BEGIN CERTIFICATE-----` and an `-----END CERTIFICATE-----` line, and one file can hold one of those blocks or many. A **CA bundle** is a PEM file holding several CA certificates one after another, such as a company's root and its intermediates, so that one file can be handed to a tool as everything it should trust. Most tools take a bundle directly. Java doesn't.

Different tools look in different trust stores, though:

| Client | Where it looks | How to add a CA |
|---|---|---|
| Browsers, most system tools | The operating system's store | Install it in the OS keychain or certificate store |
| `curl` | The system store, usually | `--cacert bundle.pem` |
| Python (`requests`) | Its own bundle (`certifi`), not the OS store | `REQUESTS_CA_BUNDLE=/path/bundle.pem`, which replaces its list, so the bundle needs the public CAs too [@python-requests-advanced] |
| Node.js | Its own built-in list | `NODE_EXTRA_CA_CERTS=/path/bundle.pem` [@node-cli] |
| Java (and JDBC drivers) | A Java truststore file (JKS or PKCS12) | Import into a truststore with `keytool` |

So a site can work in a browser and fail from Python or Java on the same laptop, because the browser trusts the company CA and the runtime has never heard of it.

### Building a Java truststore from a bundle

Java keeps two kinds of file that are easy to mix up. A **keystore** holds your own private key and certificate, the credentials Java sends when it has to prove who *it* is. A **truststore** holds the CA certificates Java believes, the ones it uses to decide whether to trust the *other* side [@oracle-jsse]. Trusting a private CA means adding its root to the truststore. `keytool` does the importing, one certificate at a time, so a bundle has to be split into its separate certificates first.

<details class="aside">
<summary>Splitting a bundle and importing each certificate</summary>

Both versions name the pieces `company-cert1`, `company-cert2`, and so on:

```bash tab="macOS / Linux"
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

```powershell tab="Windows (PowerShell)"
New-Item -ItemType Directory -Force "$env:TEMP\certs" | Out-Null
Set-Location "$env:TEMP\certs"
# split the bundle into cert1.pem, cert2.pem, ... and import each one
$bundle = Get-Content -Raw "$HOME\company-ca-bundle.pem"
$certs = [regex]::Matches($bundle, '-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----')
$n = 0
foreach ($cert in $certs) {
  $n++
  Set-Content -Path "cert$n.pem" -Value $cert.Value
  keytool -importcert -noprompt -alias "company-cert$n" -file "cert$n.pem" `
    -keystore "$HOME\truststore.p12" -storetype PKCS12 -storepass changeit
}

keytool -list -keystore "$HOME\truststore.p12" -storetype PKCS12 -storepass changeit
```

(`changeit` is the starting password of the truststore that ships with Java, `cacerts`, so it's the usual choice for these files and not a secret [@java-keytool]. Use your own if it matters. And yes, `keytool` calls the file a `-keystore` even when you're using it as a truststore, which doesn't help with the confusion.)

</details>

Then point Java at the truststore. The standard way is three system properties, set with `-D` when starting the program, for the truststore's path, its password, and its type [@oracle-jsse]:

```bash tab="macOS / Linux"
java -Djavax.net.ssl.trustStore=$HOME/truststore.p12 \
  -Djavax.net.ssl.trustStorePassword=changeit \
  -Djavax.net.ssl.trustStoreType=PKCS12 \
  -jar app.jar
```

```powershell tab="Windows (PowerShell)"
java "-Djavax.net.ssl.trustStore=$HOME\truststore.p12" `
  "-Djavax.net.ssl.trustStorePassword=changeit" `
  "-Djavax.net.ssl.trustStoreType=PKCS12" `
  -jar app.jar
```

Some libraries, database drivers especially, have their own settings for a truststore path and password instead, so check the documentation for the one you're using.

<details class="aside">
<summary>Why the PowerShell version needs quotes</summary>

Without the quotes, PowerShell splits each `-D` argument at the first dot, and Java gets `-Djavax` and `.net.ssl…` as two separate arguments.

</details>

## Reading the errors

| Error | What it usually means |
|---|---|
| `PKIX path building failed` (Java) | Java couldn't chain the certificate to anything in its truststore. The CA is missing, or the truststore path or password is wrong. |
| `CERTIFICATE_VERIFY_FAILED` (Python) | The same thing in Python: the CA isn't in the bundle it's using. |
| `unable to get local issuer certificate` | The client couldn't find the certificate that signed one in the chain, either among what the server sent or in its own trust store [@openssl-verify-errors]. Either the server left out its intermediate, or the root at the top, often a company's own CA, isn't in the trust store this client uses [@curl-ssl-certs]. |
| `self signed certificate in certificate chain` | The server sent a complete chain, root included, but that root isn't in the client's trust store [@openssl-verify-errors]. It's how a missing company CA shows up when the server sends its root along. |
| Hostname mismatch / `certificate is not valid for` | The name you connected to isn't on the certificate. Often you connected by IP address or by an internal name instead of the name on the certificate. |
| `certificate has expired` | It has. Check whether something was supposed to renew it. |

A timeout, or a server saying it requires TLS, isn't a certificate problem at all. Those are connection problems: nothing answered on that address and port, or the client connected without turning TLS on.

To see what a server is actually sending, `openssl` will show you the whole chain:

```bash tab="macOS / Linux"
openssl s_client -connect app.example.com:443 -servername app.example.com -showcerts </dev/null
```

```powershell tab="Windows (PowerShell)"
$null | openssl s_client -connect app.example.com:443 -servername app.example.com -showcerts
```

The `</dev/null` (or `$null |` in PowerShell) gives `openssl` nothing to send, so it prints the certificates and closes the connection instead of waiting for you to type.

The `-servername` flag sends **SNI**, the hostname you want, so a server hosting several sites returns the right certificate [@openssl-s-client] ([more on SNI](/primers/networking/load-balancers-and-tls/#sni-many-certificates-on-one-address)). Saving one of those certificates to a file and running `openssl x509 -in cert.pem -noout -text` shows its names, issuer, and expiry date.
