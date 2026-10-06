---
title: The TLS handshake
description: The first few messages of every HTTPS connection, where the browser checks who it's talking to and the two sides agree on a secret key in public, plus what's different in TLS 1.2, what someone watching can still see, and how to watch it happen.
order: 5
updated: 2026-10-06
---

Every new HTTPS connection starts with a short exchange called the **TLS handshake**, before a single byte of the web page moves. It has two jobs:

1. **Prove who the server is.** The server shows its certificate, and proves it holds the matching private key. [Certificates and Trust](/primers/networking/certificates-and-trust/) covers how the browser decides to believe it.
2. **Agree on encryption keys** that nobody else knows, even though every message of the handshake itself crosses the open internet.

In the [OSI model](/primers/networking/osi-model/), TLS sits on top of TCP and underneath HTTP: the TCP connection is set up first, then the TLS handshake runs over it, and only then does HTTP get to speak.

## Agreeing on a secret in public

The second job sounds impossible. Two computers that have never met need to end up with the same secret key, while anyone in between can read everything they send. They do it with a **key exchange**, and the classic way to picture it is mixing paint:

1. Both sides agree, in public, on a common starting color, say yellow.
2. Each side picks a secret color of its own and never shares it. The client picks red, the server picks blue.
3. Each side mixes its secret color into the yellow and sends the mixture across. The client sends orange (yellow + red), and the server sends green (yellow + blue).
4. Each side adds its own secret color to the mixture it received. The client adds red to the green, the server adds blue to the orange, and both end up with the same brown (yellow + red + blue).

Someone watching saw yellow, orange, and green, but un-mixing paint to get the red or the blue back out is impractical, so they can't make the brown. Real TLS does this with math instead of paint (usually an elliptic curve method called X25519 [@rfc7748]), where the "un-mixing" step is what's impractical, and the shared brown becomes the key that encrypts the rest of the conversation [@rfc9846].

### Forward secrecy

The secret colors are made fresh for every connection and thrown away afterward. So even if someone records an encrypted conversation today and steals the server's certificate private key next year, they still can't decrypt the recording, because the certificate key was only ever used to *sign* (prove identity), never to protect the session key. That property is **forward secrecy**, and TLS 1.3 requires it: the older key exchange methods that didn't provide it were removed [@rfc9846].

## The TLS 1.3 handshake, message by message

Here's a browser opening `https://app.example.com` [@rfc9846]:

1. **ClientHello** (client → server, not encrypted). What the client wants and supports:
   - **SNI** (Server Name Indication): the hostname it wants, so a server hosting many sites can pick the right certificate [@rfc6066].
   - **ALPN** (Application-Layer Protocol Negotiation): which protocols it can speak on top, like `h2` (HTTP/2) or `http/1.1` [@rfc7301].
   - The TLS versions and cipher suites it supports.
   - Its half of the key exchange, sent right away on a guess about which method the server will pick.
2. **ServerHello** (server → client, not encrypted). The server's choices from those lists, and its half of the key exchange. Both sides can now compute the shared secret, and **everything after this message is encrypted** [@rfc9846].
3. **EncryptedExtensions.** The rest of the server's choices, like which protocol from the ALPN list it picked.
4. **Certificate.** The server's certificate chain.
5. **CertificateVerify.** A signature over the whole handshake so far, made with the certificate's private key [@rfc9846]. This is the proof that the server actually holds that key, and the reason a copied certificate is useless on its own ([what a certificate proves](/primers/networking/certificates-and-trust/#what-a-certificate-proves)).
6. **Finished** (server). A checksum of every handshake message, so both sides can confirm nobody altered anything on the way.
7. **Finished** (client). The same confirmation from the client's side, and the client can send its HTTP request right behind it.

That's one round trip (the client's hello out, the server's reply back) before the request can go. If the client guessed wrong about the key exchange method, the server sends a **HelloRetryRequest** asking for a different one, which costs an extra round trip [@rfc9846].

Step through it here, and switch to TLS 1.2 to compare:

<div class="tls-walk"></div>

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
- **IP addresses and ports,** from the layers below ([the OSI model](/primers/networking/osi-model/#across-the-internet-hop-by-hop)).
- **Sizes and timing** of the encrypted traffic.
- **In TLS 1.2, the certificate** as well, since it isn't encrypted there.

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

That's ALPN choosing HTTP/2, TLS 1.3 with a ChaCha20 cipher suite (the exact naming varies by TLS library), and the certificate chain checking out. To see the individual messages, `openssl s_client -connect camzabriskie.com:443 -msg` prints every protocol message as it goes by, and `-trace` decodes them in more detail [@openssl-s-client].

Wireshark can show the handshake too, but only the unencrypted parts, since everything after the ServerHello is encrypted. To see inside, set the `SSLKEYLOGFILE` environment variable before starting a browser, which makes it write out its session keys to a file, and point Wireshark at that file [@wireshark-tls]. Delete the file afterward, since anyone who has it can decrypt that traffic.
