---
title: The OSI model
description: The seven layers networking gets described in, the four-layer model the internet actually uses, what happens to one request on its way down and back up, and how to use the layers to troubleshoot.
order: 0
updated: 2026-10-05
---

Networking people describe almost everything by layer. A Network Load Balancer is "layer 4," an Application Load Balancer is "layer 7," a router is "layer 3," and a problem gets narrowed down by asking which layer it's at. Those numbers come from the **OSI model** (Open Systems Interconnection), a reference model that splits the job of getting data from one program to another into seven layers [@itu-x200]. Every other primer in this topic uses its vocabulary, so it's the place to start.

## Why layers

Getting a web page from a server to your browser involves a lot of separate problems: turning bits into electrical or radio signals, getting data to the next device on the same network, finding a path across many networks, making sure nothing gets lost or arrives out of order, and finally what the data actually means. Layering gives each problem to one layer:

- Each layer **uses the layer below it** without caring how that layer works.
- Each layer **serves the layer above it** without caring what that layer is doing.

So your browser doesn't care whether you're on Wi-Fi or a cable, and the cable doesn't care whether it's carrying a web page or a video call. You can swap out one layer (move from Wi-Fi to Ethernet, or from HTTP/1.1 to HTTP/2) without touching the others.

## The seven layers

Layers are numbered from the bottom up, starting with the physical signal:

| # | Layer | Its job | Examples | Addressed by |
|---|---|---|---|---|
| 7 | **Application** | What the data means to the program | HTTP, DNS, SSH, SMTP | URLs, hostnames |
| 6 | **Presentation** | How data is represented: encoding, compression, encryption | Character encodings, formats like JSON | |
| 5 | **Session** | Setting up and keeping track of an ongoing conversation | Mostly folded into apps today | |
| 4 | **Transport** | Getting data from a program on one machine to a program on another, reliably or not | TCP, UDP (and QUIC, on top of UDP) | Ports |
| 3 | **Network** | Getting data across many networks, hop by hop | IP, ICMP | IP addresses |
| 2 | **Data link** | Getting data to the next device on the same local network | Ethernet, Wi-Fi | MAC addresses |
| 1 | **Physical** | Turning bits into signals on a wire, fiber, or radio | Cables, radio, fiber | |

A couple of names for the unit of data at each layer show up constantly too: a **frame** at layer 2, a **packet** at layer 3, a **segment** (TCP) or **datagram** (UDP) at layer 4.

If you need a way to remember the order from layer 1 up, the classic mnemonic is "Please Do Not Throw Sausage Pizza Away" (Physical, Data link, Network, Transport, Session, Presentation, Application).

## The model the internet actually uses

The OSI model is a way of describing networking, not how the internet's protocols were actually designed. The internet's own model, usually called the TCP/IP model, has four layers [@rfc1122]:

| TCP/IP layer | Roughly OSI layers | Examples |
|---|---|---|
| Application | 5, 6, 7 | HTTP, DNS, TLS, SSH |
| Transport | 4 | TCP, UDP |
| Internet | 3 | IP, ICMP |
| Link | 1, 2 | Ethernet, Wi-Fi |

Layers 5 and 6 never really became separate pieces in practice. Applications and libraries do that work themselves. So in day-to-day use, the numbers people actually say are 1, 2, 3, 4, and 7, and the OSI numbering survives mostly as shared vocabulary. When a product says it works "at layer 7," it means it understands the application protocol, and "layer 4" means it only sees connections and ports.

Real protocols don't always fit neatly anyway [@rfc3439]. TLS is the usual example: it sits on top of TCP and underneath HTTP, encrypting everything above it, so it's described as layer 6, layer 4.5, or "part of the application," depending on who you ask. The model is a map, and maps simplify.

### TLS isn't the transport layer, despite its name

TLS stands for Transport Layer Security, which makes it sound like it belongs at layer 4 or replaced something there. It didn't. TLS replaced **SSL**, an older encryption protocol (TLS 1.0 was built from SSL 3.0 [@rfc2246]), which is why people still say "SSL certificate" for what's now a TLS certificate. It never replaced **TCP**. TLS runs on top of TCP, and the transport layer is still TCP and UDP.

**QUIC** blurs the line more. It's a newer transport protocol that runs on top of UDP and has TLS 1.3 built into it [@rfc9000, @rfc9001], and HTTP/3 uses it instead of TCP [@rfc9114]. So the two stacks for a web request look like this:

| | Application | Encryption | Transport | Network |
|---|---|---|---|---|
| HTTP/1.1 and HTTP/2 | HTTP | TLS | TCP | IP |
| HTTP/3 | HTTP/3 | TLS 1.3, inside QUIC | QUIC over UDP | IP |

## One request, down the stack and back up

Here's what happens when a browser at `192.168.1.20` on a home network fetches `https://www.example.com`, which DNS has already turned into `203.0.113.10` ([How DNS resolution works](/primers/networking/dns-resolution/) covers that lookup step by step).

**On the way down, each layer wraps the data from the layer above** in its own envelope, with its own addresses on the outside. This is called **encapsulation**:

1. **Layer 7:** the browser writes an HTTP request: `GET /` for host `www.example.com` [@rfc9110].
2. **TLS** encrypts that request so nothing below it can read it [@rfc8446].
3. **Layer 4:** TCP puts the encrypted data in a segment addressed from a random high port on the laptop (an [ephemeral port](/primers/networking/aws-vpc-subnets/#security-groups-and-network-acls), say `51544`) to port `443` on the server. TCP keeps track of what's been received and resends anything that gets lost [@rfc9293].
4. **Layer 3:** IP puts the segment in a packet addressed from `192.168.1.20` to `203.0.113.10` [@rfc791]. These are the addresses from [IP addresses and CIDR](/primers/networking/ip-addresses-and-cidr/).
5. **Layer 2:** Wi-Fi puts the packet in a frame addressed to the **home router's** MAC address, not the server's. Layer 2 only ever reaches the next device on the local network. The laptop looks up the router's MAC address with **ARP**, explained [just below](#arp-from-an-ip-address-to-a-mac-address).
6. **Layer 1:** the frame goes out as radio signals.

**At each router along the way, only the bottom layers get unwrapped.** The router strips off the layer 2 frame, reads the layer 3 destination address, looks it up in its route table to pick the next hop, and wraps the packet in a fresh layer 2 frame addressed to that next device. So the MAC addresses change at every hop, while the IP addresses stay the same the whole way. That's the same idea as a route table's [target being the next hop](/primers/networking/aws-vpc-subnets/#destination-and-target): the packet carries its final destination, and each router just picks the next step. (One exception: when the packet leaves a home or private network, a NAT device swaps the private source address for a public one, and swaps it back on replies.)

**At the server, it goes back up:** layer 2 checks the frame was for it, layer 3 checks the packet was for its address, layer 4 hands the data to whatever program is listening on port 443, TLS decrypts it, and the web server reads the HTTP request. The response goes through the same process in reverse.

### ARP: from an IP address to a MAC address

A **MAC address** is the hardware address of a network interface: a 48-bit number written as six pairs of hex digits, like `00:00:5e:00:53:01` (that one is from a range set aside for documentation [@rfc9542]). Layer 2 frames are addressed by MAC address, layer 3 packets by IP address, and something has to connect the two.

That something is **ARP**, the Address Resolution Protocol [@rfc826]. It answers one question on the local network: "which MAC address has this IP address?" It's the same kind of job [DNS](/primers/networking/dns-resolution/) does one layer up, where DNS turns a name into an IP address and ARP turns an IP address into a MAC address.

Here's what happens in step 5 above, before the laptop can send its first frame:

1. **The laptop decides who's next.** `203.0.113.10` isn't in the laptop's own subnet, `192.168.1.0/24` ([what a subnet is](/primers/networking/ip-addresses-and-cidr/#subnets)), so the packet has to go through the **default gateway**, the home router at `192.168.1.1`. The laptop learned that address when it joined the network, from [DHCP](#dhcp-how-a-device-gets-its-settings).
2. **It checks its ARP cache** for `192.168.1.1`. If it's there from a recent conversation, it's done.
3. **If not, it broadcasts an ARP request** to every device on the local network: "Who has `192.168.1.1`? Tell `192.168.1.20`."
4. **The router replies directly to the laptop:** "`192.168.1.1` is at `00:00:5e:00:53:01`."
5. **The laptop caches the answer** and addresses the frame to that MAC address.

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
| [Security group, NACL](/primers/networking/aws-vpc-subnets/#security-groups-and-network-acls) | 3–4 | Addresses, protocols, ports |
| Site-to-site VPN (IPsec) | 3 | Whole packets, which it encrypts |
| AWS Gateway Load Balancer | 3 | Packets [@aws-gwlb-intro] |
| [Network Load Balancer](/primers/networking/load-balancers-and-tls/#nlbs-and-albs) | 4 | Connections and ports [@aws-nlb-intro] |
| [Application Load Balancer](/primers/networking/load-balancers-and-tls/#nlbs-and-albs), WAF, CDN | 7 | Full HTTP requests: paths, headers, cookies [@aws-alb-intro] |
| [DNS](/primers/networking/dns-resolution/) | 7 | An application protocol, carried over UDP or TCP port 53 |

The higher a device works, the more it can see and the smarter its decisions can be. It also has to understand the protocol, which is why a layer 7 load balancer can route by URL path but only for HTTP, and a layer 4 one can carry anything but can't look inside.

## Using the layers to troubleshoot

When something can't connect, working up from the bottom keeps you from guessing. Each layer has its own check:

| Layer | Question | Check |
|---|---|---|
| 1–2 | Is the machine connected to its network at all? | Is the link up, does it have an address (`ip addr`, `ifconfig`) |
| 3 | Can packets reach the other address? | `ping`, `traceroute`, the [route tables](/primers/networking/aws-vpc-subnets/#when-traffic-doesnt-get-through) |
| 4 | Is anything listening on the port, and does the firewall allow it? | `nc -vz <host> <port>`, security groups, NACLs |
| TLS | Does the certificate check out? | `openssl s_client` ([Certificates and trust](/primers/networking/certificates-and-trust/#reading-the-errors)) |
| 7 | Does the application answer correctly? | `curl -v`, the HTTP status code, the app's logs |

Two catches:

- **`ping` failing doesn't mean the host is down.** Ping uses ICMP [@rfc792], which a lot of firewalls and security groups don't allow, so a host can block ping and still serve web traffic fine. Check the port directly with `nc` before concluding anything.
- **A timeout and a refusal are different layers.** "Connection timed out" usually means nothing came back at all, so a firewall dropped the traffic or there's no route (layers 3–4). "Connection refused" means the machine answered and said nothing is listening on that port, so the network is fine and the problem is the service.

UDP gets less of this help, since it has no connection to set up and no delivery checks [@rfc768]. A UDP request that gets no answer looks the same whether it was blocked, lost, or ignored.
