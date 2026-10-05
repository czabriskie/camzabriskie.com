---
title: Reaching private resources
description: The ways into a private network, from connecting whole networks with VPNs and Transit Gateway to forwarding one port for an afternoon, and what to check when you're connected but still can't reach anything.
order: 5
updated: 2026-10-05
---

Databases, internal tools, and Kubernetes nodes live in private subnets on purpose, so nothing on the internet can reach them. People still need to, though, and so do other networks. The options run from permanent links between whole networks down to a tunnel to one port that lasts as long as a terminal window.

This leans on [AWS VPCs, subnets, and routing](/primers/networking/aws-vpc-subnets/), especially route tables and the [checklist for when traffic doesn't get through](/primers/networking/aws-vpc-subnets/#when-traffic-doesnt-get-through).

## Connecting whole networks

These connect one network to another, so everything on one side can reach (whatever the firewalls allow on) the other side.

### VPC peering

A **peering connection** links two VPCs directly, and each side adds a route for the other's range pointing at the peering connection. It's simple, with two limits that shape bigger designs:

- **No overlapping ranges.** Two VPCs whose CIDR blocks overlap can't be peered at all [@aws-vpc-peering], which is why [giving every VPC its own range](/primers/networking/aws-vpc-subnets/#dont-overlap-with-networks-youll-connect-to) matters.
- **Not transitive.** If A is peered with B and B with C, A still can't reach C through B [@aws-vpc-peering]. Connecting a lot of VPCs means a peering connection for every pair.

### Transit Gateway

A **Transit Gateway** is a hub that VPCs, VPNs, and Direct Connect links all attach to, so instead of wiring every pair together, each network connects once to the hub. It has its own route tables deciding which attachments can reach which.

Two details catch people out:

- **A VPC attachment needs a subnet in each availability zone.** The Transit Gateway puts a network interface in that subnet, and resources in a zone with no attachment subnet can't reach the Transit Gateway at all [@aws-tgw-how-it-works, @aws-tgw-vpc-attachments].
- **Return routes live in the VPC.** Each subnet with resources that should be reachable needs a route back to the far side's range pointing at the Transit Gateway. Without it, requests arrive and replies go nowhere [@aws-tgw-vpc-attachments].

### Site-to-site VPN

A **site-to-site VPN** is an encrypted tunnel between two whole networks, usually an office or data center and AWS. It uses **IPsec** [@aws-s2s-vpn-what-is], which encrypts the packets themselves, so any protocol can ride inside: HTTP, database connections, anything.

In AWS, the far end is described by a **customer gateway** (the office's VPN device), and the AWS end is a **virtual private gateway** on one VPC or a Transit Gateway. Each VPN connection comes with two tunnels that end in different availability zones, and the office device should have both up, because AWS takes one down from time to time for maintenance [@aws-s2s-vpn-what-is, @aws-s2s-vpn-resilience].

### Direct Connect

**Direct Connect** is a dedicated physical connection into AWS instead of a tunnel over the internet. It costs more and takes longer to set up, and in return you get more bandwidth and much steadier latency. It isn't encrypted by default. The traffic is private, but if it needs to be encrypted you add MACsec (on supported connections) or run a site-to-site VPN over the Direct Connect link [@aws-dx-encryption-in-transit]. Large setups often use Direct Connect as the main path with a VPN as the backup.

## Connecting people: client VPN

A **client VPN** connects one person's laptop to a network instead of connecting two networks. AWS has its own (AWS Client VPN), and plenty of teams run their own VPN server (OpenVPN, WireGuard, and so on) in a VPC instead.

Either way, the laptop gets an address from the VPN's own **client range**, like `10.250.0.0/22`, which can't overlap with the networks it connects to. The source address the destination sees depends on the VPN:

- **AWS Client VPN translates the address.** Traffic leaves the VPN endpoint's network interface in the VPC with that interface's address as the source, not the laptop's client address [@aws-client-vpn-access]. Inside that VPC no extra return route is needed, because the `local` route covers the endpoint's address. AWS Client VPN also has its own **authorization rules** (which client groups may reach which ranges) and its own route table, and both have to allow a destination before traffic even leaves the VPN [@aws-client-vpn-auth-rules, @aws-client-vpn-access].
- **Many self-run VPNs pass the client address through.** The destination sees the laptop's address from the client range. Then every subnet the client needs to reach has to have a route back to the client range, and every security group has to allow the client range.

That difference explains a lot of "I'm connected but can't reach anything." The right return route and security group rule depend on which address the destination actually sees.

### Connected but can't reach it

Work through the path in order, from the laptop to the resource and back:

1. **The VPN allows it.** For AWS Client VPN, an authorization rule covers the destination range, and the endpoint's route table has a route for it.
2. **A route toward it.** From the VPN's network to the destination, through the peering connection or Transit Gateway if it's in another VPC.
3. **The Transit Gateway path, if there is one.** The destination VPC's attachment has a subnet in the destination's availability zone, and the Transit Gateway's route tables route both directions.
4. **A route back.** Every subnet the destination lives in has a route for the source range (the client range or the VPN's own range, depending on the VPN) pointing back the way it came. This one is easy to miss, especially when an environment has more subnets than the ones you checked.
5. **The NACLs, both ways.** Including ephemeral ports on the way back.
6. **The security group on the destination.** It allows the source the destination actually sees, on the right port.
7. **The name resolves to the private address.** If the hostname only resolves inside the VPC (a [private hosted zone](/primers/networking/dns-resolution/#private-hosted-zones)), the laptop needs to use the VPC's DNS over the VPN, or it'll resolve the name somewhere else or not at all.
8. **Something is listening.** On that address and port, not just on `localhost`.

## One port, for now: port forwarding

Sometimes you only need to reach one database for an afternoon, and a VPN is more than the job needs. Port forwarding makes a port on your laptop connect through something that's already inside the network.

### Through a Kubernetes cluster

If you can already reach a Kubernetes cluster inside the VPC with `kubectl`, the cluster can act as the way in. Run a tiny relay pod that forwards to the database, then forward a local port to that pod:

```bash
# a throwaway pod that relays port 5432 to the database
kubectl run pg-proxy --rm -i --restart=Never --image=alpine/socat -- \
  TCP-LISTEN:5432,fork,reuseaddr \
  TCP:my-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com:5432 &

# connect local port 5433 to the pod's port 5432
sleep 3 && kubectl port-forward pod/pg-proxy 5433:5432
```

Then the database client connects to `localhost` on port `5433`.

The pieces:

- **socat** (SOcket CAT) connects two streams of bytes. Here it listens on 5432 inside the pod and passes every byte to the database's 5432, and `fork` lets it handle more than one connection [@socat-manual].
- **The pod is inside the VPC,** so it can reach the database even though your laptop can't.
- **`kubectl port-forward`** connects your local 5433 to the pod's 5432. The traffic travels through the encrypted connection to the Kubernetes API that `kubectl` already has, so the database never has to be exposed anywhere [@k8s-port-forward, @k8s-control-plane-comms].
- **Local port 5433** instead of 5432, so it doesn't clash with a Postgres you might have running locally.

It only lasts as long as the terminal is open. Close it and the forward stops, and `--rm` deletes the pod once it exits. The database's security group still has to allow traffic from the pod, which usually means allowing the cluster nodes' security group.

### Through Session Manager or SSH

The same idea works with other ways in:

- **AWS Systems Manager Session Manager** can forward a local port through an EC2 instance to another host in the VPC, with no SSH keys and no inbound ports open on the instance [@aws-ssm-session-manager, @aws-ssm-start-session]:

  ```bash
  aws ssm start-session --target i-xxxxxxxxxxxxxxxxx \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters '{"host":["my-db.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5433"]}'
  ```

- **An SSH [bastion host](/primers/networking/proxies-and-bastions/#bastion-hosts)** (a small instance whose only job is to be SSH'd into) does the same with `ssh -L 5433:<database host>:5432 user@bastion`, at the cost of keeping an SSH port open and managing keys.

| Option | Good for | Lasts |
|---|---|---|
| Peering / Transit Gateway | Connecting VPCs to each other | Permanent |
| Site-to-site VPN / Direct Connect | Connecting an office or data center | Permanent |
| Client VPN | People who need regular access | While connected |
| Port forwarding | One person, one port, right now | While the terminal is open |
