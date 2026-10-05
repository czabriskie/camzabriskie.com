---
title: The OSI model
description: The seven layers networking gets described in, the four-layer model the internet actually uses, what happens to one request on its way down and back up, and how to use the layers to troubleshoot.
order: 0
updated: 2026-10-05
---

Networking people describe almost everything by layer. A Network Load Balancer is "layer 4," an Application Load Balancer is "layer 7," a router is "layer 3," and a problem gets narrowed down by asking which layer it's at. Those numbers come from the **OSI model** (Open Systems Interconnection), a reference model that splits the job of getting data from one program to another into seven layers [@itu-x200]. Every other primer in this topic uses its vocabulary, so it's the place to start.

## Why layers

Getting a web page from a server to your browser involves a lot of separate problems: turning bits into electrical or radio signals, getting data to the next device on the same network, finding a path across many networks, getting it to the right program on the far end without losing anything, and finally what the data actually means. Layering gives each problem to one layer:

- Each layer **uses the layer below it** without caring how that layer works.
- Each layer **serves the layer above it** without caring what that layer is doing.

So your browser doesn't care whether you're on Wi-Fi or a cable, and the cable doesn't care whether it's carrying a web page or a video call. You can swap out one layer (move from Wi-Fi to Ethernet, or from HTTP/1.1 to HTTP/2) without touching the others.

## The seven layers

Layers are numbered from the bottom up, starting with the physical signal. Each one has its own kind of address and its own name for a chunk of data:

| # | Layer | Its job | Examples | Addressed by | A chunk is called |
|---|---|---|---|---|---|
| 7 | **Application** | What the data means to the program | HTTP, DNS, SSH, SMTP | URLs, hostnames | a message |
| 6 | **Presentation** | How data is represented: encoding, compression, encryption | Character encodings, formats like JSON | | |
| 5 | **Session** | Setting up and keeping track of an ongoing conversation | Mostly folded into apps today | | |
| 4 | **Transport** | Getting data to the right program on a machine, reliably or not | TCP, UDP (and QUIC, on top of UDP) | Ports | a segment (TCP) or datagram (UDP) |
| 3 | **Network** | Getting data across many networks, hop by hop | IP, ICMP | IP addresses | a packet |
| 2 | **Data link** | Getting data to the next device on the same local network | Ethernet, Wi-Fi | MAC addresses | a frame |
| 1 | **Physical** | Turning bits into signals | Copper cable, fiber, radio | | bits |

If you need a way to remember the order from layer 1 up, the classic mnemonic is "Please Do Not Throw Sausage Pizza Away" (Physical, Data link, Network, Transport, Session, Presentation, Application).

### Addresses at layers 2, 3, and 4

Three of those layers have their own kind of address, and each one narrows things down further:

- A **MAC address** (layer 2) identifies a network interface on the local network, like `00:00:5e:00:53:01` [@rfc9542]. It only matters for the next device the data is handed to.
- An **IP address** (layer 3) identifies a machine anywhere on the internet, like `203.0.113.10`. It stays on the data the whole trip ([IP addresses and CIDR](/primers/networking/ip-addresses-and-cidr/)).
- A **port** (layer 4) is a number that picks out one program on that machine. The IP address gets data to the right building, and the port is the apartment number inside it. Servers listen on well-known ports, like 443 for HTTPS, 22 for SSH, and 53 for DNS [@iana-ports]. Clients pick a random high port for their end of each connection, called an [ephemeral port](/primers/networking/aws-vpc-subnets/#security-groups-and-network-acls).

## The model the internet actually uses

The OSI model is a way of describing networking, not how the internet's protocols were actually designed. The internet's own model, usually called the TCP/IP model, has four layers [@rfc1122]:

| TCP/IP layer | Roughly OSI layers | Examples |
|---|---|---|
| Application | 5, 6, 7 | HTTP, DNS, TLS, SSH |
| Transport | 4 | TCP, UDP |
| Internet | 3 | IP, ICMP |
| Link | 1, 2 | Ethernet, Wi-Fi |

Layers 5 and 6 never really became separate pieces in practice. Applications and libraries do that work themselves. So in day-to-day use, the numbers people actually say are 1, 2, 3, 4, and 7, and the OSI numbering survives mostly as shared vocabulary. When a product says it works "at layer 7," it means it understands the application protocol, and "layer 4" means it only sees connections and ports.

### TLS isn't the transport layer, despite its name

Real protocols don't always fit the model neatly [@rfc3439], and TLS is the usual example. It sits on top of TCP and underneath HTTP, encrypting everything above it, so it gets described as layer 6, layer 4.5, or "part of the application," depending on who you ask. The model is a map, and maps simplify.

Its name makes it more confusing. TLS stands for Transport Layer Security, which makes it sound like it belongs at layer 4 or replaced something there. It didn't. TLS replaced **SSL**, an older encryption protocol (TLS 1.0 was built from SSL 3.0 [@rfc2246]), which is why people still say "SSL certificate" for what's now a TLS certificate. It never replaced **TCP**. TLS runs on top of TCP, and the transport layer is still TCP and UDP.

**QUIC** blurs the line more. It's a newer transport protocol that runs on top of UDP and has TLS 1.3 built into it [@rfc9000, @rfc9001], and HTTP/3 uses it instead of TCP [@rfc9114]. So the two stacks for a web request look like this:

| | Application | Encryption | Transport | Network |
|---|---|---|---|---|
| HTTP/1.1 and HTTP/2 | HTTP | TLS | TCP | IP |
| HTTP/3 | HTTP/3 | TLS 1.3, inside QUIC | QUIC over UDP | IP |

## One request, from start to finish

Here's a laptop on a home network loading `https://www.example.com`, which lives on a server at `203.0.113.10`.

### Before the first byte of the page

Loading a page takes more than one request. Here's everything that happens, in order, the first time:

1. **Join the network.** When the laptop connects, [DHCP](#dhcp-how-a-device-gets-its-settings) gives it an address (`192.168.1.20`), the home router's address as its default gateway (`192.168.1.1`), and a DNS server to use.
2. **Find the router.** To send anything off the local network, the laptop needs the router's MAC address, so it asks with [ARP](#arp-from-an-ip-address-to-a-mac-address). The answer gets cached and reused for everything after.
3. **Look up the name.** The laptop asks DNS for `www.example.com` and gets `203.0.113.10` ([How DNS resolution works](/primers/networking/dns-resolution/) covers that lookup step by step).
4. **Open a connection.** TCP sets up a connection with the server in a **three-way handshake**: the laptop sends a SYN ("let's talk"), the server answers SYN-ACK ("okay"), and the laptop sends an ACK ("okay, starting") [@rfc9293].
5. **Agree on encryption.** TLS does its own handshake over that connection. The server shows its certificate, the laptop [checks it](/primers/networking/certificates-and-trust/#what-a-certificate-proves), and they agree on keys [@rfc8446].
6. **Send the request.** Now the browser can finally send `GET /`, which is what the next section follows down the stack.

Steps 1 and 2 happen once and get reused. Steps 3 through 5 happen for each new server, which is part of why the first visit to a site feels slower than the second.

### Down the stack: encapsulation

On the way down, each layer wraps the data from the layer above in its own envelope, with its own addresses on the outside. That's called **encapsulation**:

1. **Layer 7:** the browser writes an HTTP request: `GET /` for host `www.example.com` [@rfc9110].
2. **TLS** encrypts it, so nothing below it can read the request.
3. **Layer 4:** TCP puts the encrypted data in a segment from the laptop's ephemeral port (say `51544`) to port `443` on the server. TCP numbers what it sends and resends anything that doesn't get acknowledged [@rfc9293].
4. **Layer 3:** IP puts the segment in a packet from `192.168.1.20` to `203.0.113.10` [@rfc791].
5. **Layer 2:** Wi-Fi puts the packet in a frame addressed to the **home router's** MAC address, not the server's, because layer 2 only ever reaches the next device on the local network.
6. **Layer 1:** the frame goes out as radio signals.

Read the result from the outside in, and each layer's header only holds what that layer needs:

<div class="encap" role="img" aria-label="Encapsulation: an HTTP request inside a TLS record, inside a TCP segment from port 51544 to 443, inside an IP packet from 192.168.1.20 to 203.0.113.10, inside a Wi-Fi frame from the laptop's MAC address to the router's MAC address.">
<div class="encap-layer"><div class="encap-head"><span class="encap-tag">Layer 2 · Wi-Fi frame</span><span class="encap-fields">to <code>00:00:5e:00:53:01</code> (router) · from <code>00:00:5e:00:53:02</code> (laptop)</span></div>
<div class="encap-layer"><div class="encap-head"><span class="encap-tag">Layer 3 · IP packet</span><span class="encap-fields">to <code>203.0.113.10</code> · from <code>192.168.1.20</code></span></div>
<div class="encap-layer"><div class="encap-head"><span class="encap-tag">Layer 4 · TCP segment</span><span class="encap-fields">to port <code>443</code> · from port <code>51544</code></span></div>
<div class="encap-layer"><div class="encap-head"><span class="encap-tag">TLS record</span><span class="encap-fields">encrypted: only the server can read what's inside</span></div>
<div class="encap-payload"><span class="encap-tag">Layer 7 · HTTP request</span><code>GET / HTTP/1.1</code><br><code>Host: www.example.com</code></div>
</div></div></div></div>
</div>

<p class="bitgrid-caption">Each layer wraps the one above it. A router only opens the outer two boxes, a load balancer at layer 4 opens three, and only the server (or something terminating TLS) can see the request itself.</p>

### Across the internet: hop by hop

A **hop** is one trip between two devices on the same local network, like the laptop to the home router, or one router to the next. At each router, only the bottom layers get unwrapped: the router strips off the layer 2 frame, reads the layer 3 destination address, looks it up in its route table to pick the next hop, and wraps the packet in a fresh layer 2 frame addressed to that next device. That's the same idea as a route table's [target being the next hop](/primers/networking/aws-vpc-subnets/#destination-and-target): the packet carries its final destination, and each router just picks the next step.

So the layer 2 addresses change on every hop, and the layer 3 addresses stay the same, with one exception: the home router does **NAT** (network address translation). Private addresses like `192.168.1.20` can't be used on the internet, so as the packet leaves the home network, the router swaps the private source address for the home's one public address and remembers the swap so it can undo it on the reply [@rfc3022].

| Hop | Layer 2: from → to | Layer 3: from → to |
|---|---|---|
| Laptop → home router | laptop's MAC → home router's MAC | `192.168.1.20` → `203.0.113.10` |
| Home router → ISP's router | home router's MAC → ISP router's MAC | **`198.51.100.7`** → `203.0.113.10` (NAT swapped the source) |
| More routers across the internet | each router's MAC → the next one's | `198.51.100.7` → `203.0.113.10` |
| Last router → server | last router's MAC → server's MAC | `198.51.100.7` → `203.0.113.10` |

The reply makes the same trip backwards, from `203.0.113.10` to `198.51.100.7`, and the home router swaps the destination back to `192.168.1.20` before handing it to the laptop.

### Back up the stack at the server

At the server it goes back up: layer 2 checks the frame was for it, layer 3 checks the packet was for its address, layer 4 hands the data to whatever program is listening on port 443, TLS decrypts it, and the web server reads the HTTP request. The response goes through the same process in reverse.

### ARP: from an IP address to a MAC address

A frame needs a MAC address and a packet needs an IP address, and something has to connect the two. That something is **ARP**, the Address Resolution Protocol [@rfc826]. It answers one question on the local network: "which MAC address has this IP address?" It's a lot like DNS, just lower down: DNS turns a name into an IP address, and ARP turns an IP address into a MAC address.

Here's step 2 of the timeline above, the first time the laptop needs to send something off the local network:

1. **The laptop decides who's next.** `203.0.113.10` isn't in the laptop's own subnet, `192.168.1.0/24` ([what a subnet is](/primers/networking/ip-addresses-and-cidr/#subnets)), so the packet has to go through the **default gateway**, the home router at `192.168.1.1`, which DHCP told it about.
2. **It checks its ARP cache** for `192.168.1.1`. If it's there from a recent conversation, it's done.
3. **If not, it broadcasts an ARP request,** sent to the special broadcast address `ff:ff:ff:ff:ff:ff` so every device on the local network hears it: "Who has `192.168.1.1`? Tell `192.168.1.20`."
4. **The router replies directly to the laptop:** "`192.168.1.1` is at `00:00:5e:00:53:01`."
5. **The laptop caches the answer** and addresses its frames to that MAC address.

A few things follow from how that works:

- **The laptop never ARPs for the server.** It only needs the MAC address of the next device, and the server isn't on its network. If the destination were in the same subnet (a printer at `192.168.1.40`, say), the laptop would ARP for the printer directly and skip the router.
- **ARP stops at the router.** Broadcasts don't cross routers, so each router along the path does its own ARP on its own network to find the next hop's MAC address.
- **You can see the cache.** `arp -a` on macOS and Windows, or `ip neigh` on Linux, lists the IP-to-MAC pairs the machine currently knows.
- **IPv6 doesn't use ARP.** It does the same job with Neighbor Discovery [@rfc4861].

### DHCP: how a device gets its settings

A device joining a network needs a few settings before it can do anything: its own IP address, the size of the subnet it's on, the default gateway's address, and which DNS servers to use. Typing those in by hand on every phone and laptop would be miserable, so almost every network hands them out automatically with **DHCP**, the Dynamic Host Configuration Protocol [@rfc2131]. On a home network the router is usually the DHCP server too.

When the laptop joins, it has no address yet, so the exchange starts with a broadcast [@rfc2131]:

1. **Discover.** The laptop broadcasts "is there a DHCP server out there?"
2. **Offer.** The router offers an address (`192.168.1.20`) along with the other settings.
3. **Request.** The laptop asks to use that offer. (This step exists because more than one server might have answered.)
4. **Acknowledge.** The router confirms, and the laptop configures itself.

The other settings travel as numbered DHCP **options**: one for the subnet mask, one for the default gateway (DHCP calls it the "router" option), one for the DNS servers, and so on [@rfc2132]. That's also how the laptop knows which [recursive resolver](/primers/networking/dns-resolution/#which-resolver-your-machine-uses) to ask.

The address is a **lease**, not a permanent assignment. The laptop has to renew it before it runs out, and if it leaves the network the address eventually goes back into the pool. That's why a device's IP address on a home network can change from one day to the next, and why servers usually get a fixed address or a reservation instead.

## Where the things in the other primers sit

| Thing | Layer | What it can see |
|---|---|---|
| Switch | 2 | MAC addresses |
| Router, [route table](/primers/networking/aws-vpc-subnets/#route-tables) | 3 | IP addresses |
| NAT gateway, home router doing NAT | 3–4 | Addresses and ports, which it rewrites |
| [Security group, NACL](/primers/networking/aws-vpc-subnets/#security-groups-and-network-acls) | 3–4 | Addresses, protocols, ports |
| Site-to-site VPN (IPsec) | 3 | Whole packets, which it encrypts |
| AWS Gateway Load Balancer | 3 | Packets [@aws-gwlb-intro] |
| [Network Load Balancer](/primers/networking/load-balancers-and-tls/#nlbs-and-albs) | 4 | Connections and ports [@aws-nlb-intro] |
| [Application Load Balancer](/primers/networking/load-balancers-and-tls/#nlbs-and-albs), WAF, CDN | 7 | Full HTTP requests: paths, headers, cookies [@aws-alb-intro] |
| [DNS](/primers/networking/dns-resolution/) | 7 | An application protocol, carried over UDP or TCP port 53 |

The higher a device works, the more of the [envelope](#down-the-stack-encapsulation) it opens, so the more it can see and the smarter its decisions can be. It also has to understand the protocol, which is why a layer 7 load balancer can route by URL path but only for HTTP, and a layer 4 one can carry anything but can't look inside.

## Using the layers to troubleshoot

When something can't connect, working through the same order as the timeline keeps you from guessing. Each step has its own check:

| Layer | Question | Check |
|---|---|---|
| 1–2 | Is the machine connected to its network, with an address? | Is the link up, `ip addr` or `ifconfig` |
| Name | Does the name resolve, to the right address? | `dig <name>` ([watching DNS](/primers/networking/dns-resolution/#watching-it-happen)) |
| 3 | Can packets reach the other address? | `ping`, `traceroute`, the [route tables](/primers/networking/aws-vpc-subnets/#when-traffic-doesnt-get-through) |
| 4 | Is anything listening on the port, and does the firewall allow it? | `nc -vz <host> <port>`, security groups, NACLs |
| TLS | Does the certificate check out? | `openssl s_client` ([Certificates and trust](/primers/networking/certificates-and-trust/#reading-the-errors)) |
| 7 | Does the application answer correctly? | `curl -v`, the HTTP status code, the app's logs |

Two catches:

- **`ping` failing doesn't mean the host is down.** Ping uses ICMP [@rfc792], which a lot of firewalls and security groups don't allow, so a host can block ping and still serve web traffic fine. Check the port directly with `nc` before concluding anything.
- **A timeout and a refusal are different layers.** "Connection timed out" usually means nothing came back at all, so a firewall dropped the traffic or there's no route (layers 3–4). "Connection refused" means the machine answered and said nothing is listening on that port, so the network is fine and the problem is the service.

UDP gets less of this help, since it has no connection to set up and no delivery checks [@rfc768]. A UDP request that gets no answer looks the same whether it was blocked, lost, or ignored.
