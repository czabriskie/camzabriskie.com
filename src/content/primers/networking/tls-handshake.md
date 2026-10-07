---
title: The TLS handshake
description: The first few messages of every HTTPS connection, where the browser checks who it's talking to and the two sides agree on a secret key in public, plus what's different in TLS 1.2, what someone watching can still see, and how to watch it happen.
order: 5
updated: 2026-10-06
---

Every new HTTPS connection starts with a short exchange called the **TLS handshake**, before a single byte of the web page moves. It has two jobs:

1. **Prove who the server is.** The server shows its certificate, and proves it holds the matching private key. [Certificates and Trust](/primers/networking/certificates-and-trust/) covers how the browser decides to believe it.
2. **Agree on encryption keys** that nobody else knows, even though every message of the handshake itself crosses the open internet.

In the [OSI model](/primers/networking/osi-model/), TLS sits on top of TCP (layer 4) and underneath HTTP (layer 7), which is why [it doesn't fit neatly into one layer](/primers/networking/osi-model/#tls-isnt-the-transport-layer-despite-its-name). The TCP connection is set up first, then the TLS handshake runs over it, and only then does HTTP get to speak. So if the handshake fails, the two machines are already connected, but the browser never sends its request and the server never sends the page. One side sends an alert and both close the connection without sending anything else [@rfc9846]. The one exception is [0-RTT](#coming-back-resumption-and-0-rtt), covered below, where a returning client sends its request before the handshake finishes.

## Two kinds of keys

The handshake involves two different kinds of keys, and keeping them apart makes the rest of this page much easier to follow.

| | The certificate's key pair | The session key |
|---|---|---|
| What it is | A public key, in the certificate, and its matching private key, kept on the server | One secret key that both sides end up knowing |
| Kind of encryption | **Asymmetric:** what one key does, only the other can undo | **Symmetric:** the same key locks and unlocks |
| How long it lasts | As long as the certificate, usually months | One connection, then it's thrown away |
| What it's for | Proving who the server is, by signing | Encrypting the actual traffic |

Why not use the certificate's keys for everything? Asymmetric math is much slower than symmetric, so it's kept for small, one-off jobs like signing and never used to encrypt a whole web page [@nist-sp-800-175b]. The handshake uses the slow kind briefly to set up the fast kind, and the fast kind does the rest. [Certificates and Trust](/primers/networking/certificates-and-trust/#keys-and-signatures) covers how key pairs and signatures work.

## Agreeing on a secret in public

The second job sounds impossible. Two computers that have never met need to end up with the same secret key, while anyone in between can read everything they send. They do it with a **key exchange**, and the classic way to picture it is mixing paint:

1. Both sides agree, in public, on a common starting color, say yellow.
2. Each side picks a secret color of its own and never shares it. The client picks red, the server picks blue.
3. Each side mixes its secret color into the yellow and sends the mixture across. The client sends orange (yellow + red), and the server sends green (yellow + blue). That mixture is each side's **key share**.
4. Each side adds its own secret color to the mixture it received. The client adds red to the green, the server adds blue to the orange, and both end up with the same brown (yellow + red + blue).

<div class="paint-mix" role="img" aria-label="The paint example step by step. 1: Both sides agree in public on yellow. 2: The browser secretly picks red and the server secretly picks blue. 3: The browser mixes yellow and red into orange and sends it; the server mixes yellow and blue into green and sends it. Both mixtures cross the wire where anyone can see them. 4: The browser mixes the green it received with its red and gets brown. The server mixes the orange it received with its blue and gets the same brown. 5: Someone watching has only orange and green. Mixing those gives yellow, red, yellow and blue: a brown with twice the yellow, which is the wrong color.">
<svg viewBox="0 0 400 412" aria-hidden="true" focusable="false">
<defs><marker id="pm-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto"><path class="pm-head" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="pm-wire" x="138" y="22" width="124" height="386" rx="8"/>
<text class="pm-actor" x="70" y="16">Browser</text>
<text class="pm-actor" x="200" y="16">On the wire</text>
<text class="pm-actor" x="330" y="16">Server</text>
<text class="pm-sub" x="200" y="36">anyone can see this</text>
<text class="pm-step" x="200" y="58">1. agree on a color</text>
<circle class="pm-sw pm-yellow" cx="200" cy="78" r="10"/>
<text class="pm-step" x="200" y="108">2. pick a secret</text>
<circle class="pm-sw pm-red" cx="70" cy="126" r="10"/>
<text class="pm-note" x="70" y="148">secret</text>
<circle class="pm-sw pm-blue" cx="330" cy="126" r="10"/>
<text class="pm-note" x="330" y="148">secret</text>
<text class="pm-step" x="200" y="176">3. mix your secret in, send it</text>
<circle class="pm-sw pm-yellow" cx="30" cy="196" r="10"/>
<text class="pm-op" x="50" y="200">+</text>
<circle class="pm-sw pm-red" cx="70" cy="196" r="10"/>
<text class="pm-op" x="90" y="200">=</text>
<circle class="pm-sw pm-orange" cx="110" cy="196" r="10"/>
<circle class="pm-sw pm-yellow" cx="290" cy="196" r="10"/>
<text class="pm-op" x="310" y="200">+</text>
<circle class="pm-sw pm-blue" cx="330" cy="196" r="10"/>
<text class="pm-op" x="350" y="200">=</text>
<circle class="pm-sw pm-blue-green" cx="370" cy="196" r="10"/>
<line class="pm-arrow" x1="118" y1="204" x2="176" y2="228" marker-end="url(#pm-head)"/>
<circle class="pm-sw pm-orange" cx="188" cy="232" r="10"/>
<line class="pm-arrow" x1="366" y1="208" x2="224" y2="230" marker-end="url(#pm-head)"/>
<circle class="pm-sw pm-blue-green" cx="212" cy="232" r="10"/>
<text class="pm-note" x="200" y="256">the key shares</text>
<text class="pm-step" x="200" y="284">4. add your secret to theirs</text>
<circle class="pm-sw pm-blue-green" cx="30" cy="304" r="10"/>
<text class="pm-op" x="50" y="308">+</text>
<circle class="pm-sw pm-red" cx="70" cy="304" r="10"/>
<text class="pm-op" x="90" y="308">=</text>
<circle class="pm-sw pm-brown" cx="110" cy="304" r="10"/>
<circle class="pm-sw pm-orange" cx="290" cy="304" r="10"/>
<text class="pm-op" x="310" y="308">+</text>
<circle class="pm-sw pm-blue" cx="330" cy="304" r="10"/>
<text class="pm-op" x="350" y="308">=</text>
<circle class="pm-sw pm-brown" cx="370" cy="304" r="10"/>
<text class="pm-note" x="70" y="328">same brown</text>
<text class="pm-note" x="330" y="328">same brown</text>
<text class="pm-step" x="200" y="354">5. a watcher mixes what it saw</text>
<circle class="pm-sw pm-orange" cx="160" cy="374" r="10"/>
<text class="pm-op" x="180" y="378">+</text>
<circle class="pm-sw pm-blue-green" cx="200" cy="374" r="10"/>
<text class="pm-op" x="220" y="378">=</text>
<circle class="pm-sw pm-muddy" cx="240" cy="374" r="10"/>
<text class="pm-bad" x="200" y="396">two yellows: wrong color</text>
</svg>
</div>

<p class="bitgrid-caption">Each side ends up with brown because it adds its own unmixed secret to the other side's mixture. Someone watching only ever has mixtures.</p>

Making the brown in step 4 takes one mixture plus one *unmixed* secret color, and only the two ends have one of those. Someone watching saw yellow, orange, and green. If they mix the orange and green together, they get yellow + red + yellow + blue: a brown with twice as much yellow, which is the wrong color, and there's no way to take the extra yellow back out. They could get the right brown if they could pull the red back out of the orange, but un-mixing paint is impractical, so they can't.

In the handshake, the client's key share rides in its very first message and the server's in its reply, so both sides can make the brown after one exchange. The brown becomes the session key that encrypts the rest of the conversation [@rfc9846].

Real TLS does this with math instead of paint, where the "un-mixing" step is what's impractical. For years the usual method was an elliptic curve one called X25519 [@rfc7748]. Newer browsers and servers now use **X25519MLKEM768**, which runs X25519 together with ML-KEM, a newer method designed to hold up against future quantum computers, and stays secure as long as either one does [@rfc10024]. Chrome has offered it since version 131 [@google-kyber-blog], and a connection to this site from a current OpenSSL picks it.

<details class="aside">
<summary>The same trick with numbers</summary>

The original version of this, from Diffie and Hellman in 1976, uses ordinary numbers [@diffie-hellman-1976]. The public "yellow" is two numbers, here 5 and 23. "Mixing in" a secret number means multiplying 5 by itself that many times, then keeping only the remainder after dividing by 23.

1. The browser's secret is 6. Its key share is 5⁶ = 15,625, which leaves a remainder of **8** after dividing by 23. It sends 8.
2. The server's secret is 15. Its key share is 5¹⁵, which leaves **19**. It sends 19.
3. The browser takes the server's 19 and mixes in its own 6: 19⁶ leaves **2**.
4. The server takes the browser's 8 and mixes in its own 15: 8¹⁵ leaves **2**.

Both sides get 2. Someone watching saw 5, 23, 8, and 19. To get to 2 they need the 6 or the 15, which means answering "5 to what power leaves 8?" With numbers this small they can just try every power, but real key exchanges use numbers hundreds of digits long, where nobody knows a practical way to answer that question, and the whole method depends on it staying that way [@diffie-hellman-1976]. X25519 does the same thing with a different kind of math (elliptic curves) that gets the same protection from much shorter numbers [@rfc7748].

</details>

### Forward secrecy

The secret colors are made fresh for every connection and thrown away afterward. So even if someone records an encrypted conversation today and steals the server's certificate private key next year, they still can't decrypt the recording, because the certificate key was only ever used to *sign* (prove identity), never to protect the session key. That property is **forward secrecy**, and TLS 1.3 requires it: the older key exchange methods that didn't provide it were removed [@rfc9846].

## The TLS 1.3 handshake, message by message

Here's a browser opening `https://app.example.com` [@rfc9846]:

1. **ClientHello** (client → server, not encrypted). What the client wants and supports:
   - **SNI** (Server Name Indication): the hostname it wants, so a server hosting many sites can pick the right certificate [@rfc6066].
   - **ALPN** (Application-Layer Protocol Negotiation): which protocols it can speak on top, like `h2` (HTTP/2) or `http/1.1` [@rfc7301].
   - The TLS versions and **cipher suites** (sets of encryption algorithms, [covered below](#versions-and-cipher-suites)) it supports.
   - Its **key share**, the orange paint, sent right away for the method it guesses the server will pick. Browsers guess the method nearly every server supports, and Chrome now guesses the post-quantum hybrid [@google-kyber-blog].
2. **ServerHello** (server → client, not encrypted). The server's choices from those lists, and its key share. Both sides can now compute the shared secret, and **everything after this message is encrypted** [@rfc9846].
3. **EncryptedExtensions.** The rest of the server's choices, like which protocol from the ALPN list it picked.
4. **Certificate.** The server's certificate chain.
5. **CertificateVerify.** A signature over the whole handshake so far, made with the certificate's private key [@rfc9846]. This is the proof that the server actually holds that key, and the reason a copied certificate is useless on its own ([what a certificate proves](/primers/networking/certificates-and-trust/#what-a-certificate-proves)).
6. **Finished** (server). A checksum of every handshake message, made with the new session key so only the two real ends could produce it, so both sides can confirm nobody altered anything on the way [@rfc9846].
7. **Finished** (client). The same confirmation from the client's side, and the client can send its HTTP request right behind it.

That's one **round trip**, a message out and the reply back, before the request can go. If the client guessed wrong about the key exchange method, the server sends a **HelloRetryRequest** asking for a different one, which costs an extra round trip [@rfc9846].

The Finished checksums matter because the first two messages aren't encrypted, so someone in the middle could edit them. Picture an attacker deleting the strongest options from the ClientHello on its way past, hoping the two sides settle on something weaker. The server would answer the edited version, but the client still has the original. Their records of the handshake no longer match, so the server's CertificateVerify signature and Finished checksum won't check out on the client's side, and the handshake fails with a `decrypt_error` alert instead of quietly carrying on [@rfc9846].

Step through it here, and switch to TLS 1.2 to compare:

<div class="tls-walk"></div>

## The whole connection, start to finish

The TLS handshake isn't the only setup. TCP has its own handshake first, and the page can't arrive until the HTTP request has gone out and come back [@rfc9293, @rfc9846]:

<div class="conn-timeline" role="img" aria-label="Timeline of a new HTTPS connection. TCP: the browser sends SYN, the server answers SYN-ACK, the browser sends ACK. That is one round trip. TLS 1.3: the browser sends ClientHello with its key share, the server answers ServerHello with its key share, then the encrypted certificate through Finished. That is one round trip. HTTP: the browser sends its Finished and GET request, encrypted, and the server sends the page, encrypted. That is one round trip, three in all.">
<svg viewBox="0 0 400 300" aria-hidden="true" focusable="false">
<defs><marker id="ct-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="ct-head" d="M0,0 L8,4 L0,8 z"/></marker><marker id="ct-head-enc" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="ct-head-enc" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="ct-actor" x="130" y="16">Browser</text>
<text class="ct-actor" x="370" y="16">Server</text>
<line class="ct-life" x1="130" y1="24" x2="130" y2="290"/>
<line class="ct-life" x1="370" y1="24" x2="370" y2="290"/>
<line class="ct-msg" x1="130" y1="46" x2="370" y2="58" marker-end="url(#ct-head)"/>
<text class="ct-label" x="250" y="42">SYN</text>
<line class="ct-msg" x1="370" y1="76" x2="130" y2="88" marker-end="url(#ct-head)"/>
<text class="ct-label" x="250" y="72">SYN-ACK</text>
<line class="ct-msg" x1="130" y1="106" x2="370" y2="118" marker-end="url(#ct-head)"/>
<text class="ct-label" x="250" y="102">ACK</text>
<line class="ct-msg" x1="130" y1="136" x2="370" y2="148" marker-end="url(#ct-head)"/>
<text class="ct-label" x="250" y="132">ClientHello (key share)</text>
<line class="ct-msg" x1="370" y1="166" x2="130" y2="178" marker-end="url(#ct-head)"/>
<text class="ct-label" x="250" y="162">ServerHello (key share)</text>
<line class="ct-msg ct-enc" x1="370" y1="196" x2="130" y2="208" marker-end="url(#ct-head-enc)"/>
<text class="ct-label ct-enc-text" x="250" y="192">certificate … Finished</text>
<line class="ct-msg ct-enc" x1="130" y1="226" x2="370" y2="238" marker-end="url(#ct-head-enc)"/>
<text class="ct-label ct-enc-text" x="250" y="222">Finished + GET /</text>
<line class="ct-msg ct-enc" x1="370" y1="256" x2="130" y2="268" marker-end="url(#ct-head-enc)"/>
<text class="ct-label ct-enc-text" x="250" y="252">the page</text>
<path class="ct-bracket" d="M118,46 H112 V88 H118"/>
<text class="ct-phase" x="106" y="65">TCP</text>
<text class="ct-rtt" x="106" y="77">1 round trip</text>
<path class="ct-bracket" d="M118,136 H112 V178 H118"/>
<text class="ct-phase" x="106" y="155">TLS 1.3</text>
<text class="ct-rtt" x="106" y="167">1 round trip</text>
<path class="ct-bracket" d="M118,226 H112 V268 H118"/>
<text class="ct-phase" x="106" y="245">HTTP</text>
<text class="ct-rtt" x="106" y="257">1 round trip</text>
</svg>
</div>

<p class="bitgrid-caption">Time runs downward. Three round trips pass before the first byte of the page arrives, and everything in teal is encrypted.</p>

Round trips are what make a first connection slow, because each one costs the full travel time to the server and back no matter how small the messages are. If a round trip takes 50 milliseconds, the page starts arriving about 150 milliseconds after the browser starts connecting. TLS 1.2 adds one more round trip, to 200, and a [returning client](#coming-back-resumption-and-0-rtt) can save one.

## TLS 1.2: one more round trip

TLS 1.2 is still widely supported, and its handshake takes two round trips instead of one [@rfc5246]:

- The client's first message doesn't include its half of the key exchange, so the key exchange only finishes on the second trip.
- The certificate travels **unencrypted**, so anyone watching can see exactly which certificate the server sent.
- Older 1.2 setups could use a key exchange without forward secrecy, where stealing the server's key later would unlock recorded traffic. That's the main reason 1.3 removed those options [@rfc9846].

TLS 1.0 and 1.1 are formally deprecated and shouldn't be used at all [@rfc8996].

## Coming back: resumption and 0-RTT

After a full handshake, the server can hand the client a **session ticket**. Next time, the client presents the ticket and the two sides skip the certificate part, because they've already been through it [@rfc9846].

With a ticket, TLS 1.3 also allows **0-RTT** ("zero round trip"): the client sends its request alongside its very first message, before the handshake finishes. It's fast, but it comes with a catch: that early data has no protection against being **replayed**, so someone who captures it can send it again [@rfc9846]. It's only safe for requests where doing the same thing twice is harmless, like loading a page, and never for something like "place an order."

## What someone watching can still see

TLS hides the contents of the conversation, but not everything:

- **The server name.** SNI is in the ClientHello, which goes out before any encryption exists, so anyone on the path can see that you connected to `app.example.com` (just not which page). **Encrypted Client Hello (ECH)** fixes this by encrypting the ClientHello with a public key the server publishes in DNS, but it needs support from both the browser and the server [@rfc9849].
- **The name, a second way.** Before connecting, the browser looked the name up in [DNS](/primers/networking/dns-resolution/), and ordinary DNS isn't encrypted, so anyone on the path can see that lookup too, unless the browser uses encrypted DNS such as DNS over HTTPS [@rfc8484].
- **IP addresses and ports,** from the layers below ([the OSI model](/primers/networking/osi-model/#across-the-internet-hop-by-hop)).
- **Sizes and timing** of the encrypted traffic.
- **In TLS 1.2, the certificate** as well, since it isn't encrypted there.

## When the handshake fails

When something goes wrong, the side that notices sends an **alert**, a short message with a name and number from the TLS standard, and closes the connection [@rfc9846]. Tools print the alert's name, though the wording varies between them, and some still say "SSL" or "sslv3" for historical reasons. The common failures:

| What went wrong | What happens | What a tool like curl shows |
|---|---|---|
| No TLS version in common, like a client that only speaks TLS 1.1 | The server sends a `protocol_version` alert | `tlsv1 alert protocol version` |
| No cipher suite or key exchange method in common | The server sends a `handshake_failure` alert | `alert handshake failure` |
| The certificate doesn't check out: expired, wrong name, or not from a trusted CA | The client refuses it and stops | `certificate has expired`, `no alternative certificate subject name matches target host name`, `self signed certificate in certificate chain` |
| The client didn't send SNI | A server hosting many sites doesn't know which one you want and sends its default certificate, which then fails the name check | A hostname mismatch |

Without SNI, for example, this site's server (GitHub Pages) answers with its default `*.github.io` certificate. [Certificates and Trust](/primers/networking/certificates-and-trust/#reading-the-errors) has more on certificate errors, and [badssl.com](https://badssl.com/) has deliberately broken sites to try them against:

```bash tab="macOS / Linux"
curl --tls-max 1.1 https://camzabriskie.com/   # an old TLS version
curl https://expired.badssl.com/               # an expired certificate
curl https://wrong.host.badssl.com/            # a certificate for a different name
```

```powershell tab="Windows (PowerShell)"
curl.exe --tls-max 1.1 https://camzabriskie.com/   # an old TLS version
curl.exe https://expired.badssl.com/               # an expired certificate
curl.exe https://wrong.host.badssl.com/            # a certificate for a different name
```

## Versions and cipher suites

A **cipher suite** is the set of algorithms a connection uses. In TLS 1.2, a suite's name lists everything at once: the key exchange, how the server proves its identity, the encryption, and the hash, which is why 1.2 suite names get long. TLS 1.3 simplified it. Key exchange and signatures are negotiated separately, and the cipher suite only names the encryption and the hash, so there are just five of them, like `TLS_AES_128_GCM_SHA256` and `TLS_CHACHA20_POLY1305_SHA256` [@rfc9846].

## A variation: mutual TLS

In normal TLS only the server proves who it is. In **mutual TLS (mTLS)** the server also asks the client for a certificate, and the client answers with its own **Certificate** and **CertificateVerify** messages, proving it holds that certificate's private key the same way the server did [@rfc9846]. [Load balancers and TLS termination](/primers/networking/load-balancers-and-tls/#mtls-the-client-proves-who-it-is-too) covers how that interacts with load balancers.

## Watching it happen

`curl -v` prints the result of the handshake (on Windows, type `curl.exe -v`, since in Windows PowerShell 5.1 plain `curl` is an alias for a different command [@ms-curl-windows]). Here's this site, on a Mac, trimmed to the TLS lines:

```
* ALPN: curl offers h2,http/1.1
* SSL connection using TLSv1.3 / AEAD-CHACHA20-POLY1305-SHA256
* ALPN: server accepted h2
* Server certificate:
*  subject: CN=camzabriskie.com
*  issuer: C=US; O=Let's Encrypt; CN=YR1
*  SSL certificate verify ok.
```

That's ALPN choosing HTTP/2, TLS 1.3 with a ChaCha20 cipher suite (the exact naming varies by TLS library), and the certificate chain checking out. curl still says "SSL" because TLS replaced an older protocol called SSL and the name stuck ([more on that](/primers/networking/osi-model/#tls-isnt-the-transport-layer-despite-its-name)). **AEAD** in the cipher's name stands for authenticated encryption with associated data: encryption that also detects any tampering, in one step. Every TLS 1.3 cipher works that way [@rfc9846, @rfc5116]. To see the individual messages, `openssl s_client -connect camzabriskie.com:443 -msg` prints every protocol message as it goes by, and `-trace` decodes them in more detail [@openssl-s-client].

Wireshark can show the handshake too, but only the unencrypted parts, since everything after the ServerHello is encrypted. To see inside, set the `SSLKEYLOGFILE` environment variable before starting a browser, which makes it write out its session keys to a file, and point Wireshark at that file [@wireshark-tls]. Delete the file afterward, since anyone who has it can decrypt that traffic.
