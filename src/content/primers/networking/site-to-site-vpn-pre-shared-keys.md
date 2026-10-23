---
title: Site-to-site VPN pre-shared keys and rotating them without downtime
description: What a pre-shared key is on an AWS site-to-site VPN, why changing it through infrastructure as code looks like it could rebuild the VPN, and how to change one tunnel at a time so the link stays up.
order: 14
only: AWS
updated: 2026-10-23
---

A company runs its app in AWS, and a partner office needs to reach it over a private link. The partner's firewall, at the public address `198.51.100.25`, connects to AWS over the internet through an encrypted site-to-site VPN. Before any traffic flows, each end proves it's the right peer by showing it knows the same long random string. That string is the **pre-shared key**, or PSK. Every so often someone decides the key should be changed, and that change is where links go down. This primer covers what the key is, why changing it through a template can look riskier than it is, and how to change it without dropping the link.

This builds on [Reaching private resources](/primers/networking/reaching-private-resources/#site-to-site-vpn), which covers what a site-to-site VPN is and where it fits next to the other ways into a VPC.

## A few terms

- **Customer gateway**: the device at your end of the VPN, usually a firewall or router [@aws-cfn-vpnconnection]. "Customer" means "not AWS's side", not a paying customer. In the running example the customer gateway is the partner's firewall.
- **Tunnel**: one encrypted path between the customer gateway and AWS. Each AWS endpoint of a tunnel has its own public address, called its **outside IP address** [@aws-s2s-vpn-tunnels].
- **IKE** (Internet Key Exchange): the handshake that sets up a tunnel. The PSK is what the two ends use to authenticate each other in that handshake [@aws-s2s-vpn-tunnel-options].
- **Rotation**: replacing a secret with a new one. Nothing turns. The old key stops working and a new key takes its place.
- **Infrastructure as code**: describing resources in a template file and letting a tool create or update them to match. AWS's tool for this is CloudFormation, and the running set of resources it manages from one template is a **stack**.

## One VPN, two tunnels, two keys

Every AWS site-to-site VPN connection has two tunnels, each with its own outside IP address, and AWS says to configure both for redundancy. When one tunnel is unavailable, traffic moves to the other one automatically. The two tunnels end in different Availability Zones, for higher availability [@aws-s2s-vpn-tunnels].

The PSK is a tunnel option, so each tunnel has its own key [@aws-cfn-vpn-tunnel-options]. In the running example:

| | AWS outside IP | Key |
|---|---|---|
| Tunnel 1 | `192.0.2.10` | key A |
| Tunnel 2 | `192.0.2.20` | key B |

The partner's firewall holds both keys, one per tunnel. Nobody generates them in the middle of a handshake, which is what "pre-shared" means: the key is shared ahead of time, out of band, usually by someone on your side sending it to someone on theirs, who types it into the firewall. "Shared" doesn't mean public. It's shared between exactly two parties, like a Wi-Fi password, and anyone who holds it can pass the check, so it belongs in a secret store.

AWS's rules for a PSK [@aws-s2s-vpn-tunnel-options, @aws-cfn-vpn-tunnel-options]:

- 8 to 64 characters.
- Letters, digits, periods (`.`), and underscores (`_`) only.
- Can't start with a zero.
- If you don't set one, AWS generates a 32-character alphanumeric key for you.

AWS can keep the key in one of two places, set by **pre-shared key storage**: `Standard`, inside the VPN service, or `SecretsManager`, in AWS Secrets Manager [@aws-s2s-vpn-tunnel-options].

## Why a template change could look like a rebuild

Say the keys live in a CloudFormation template as tunnel options, and someone changes key A in the template and deploys. Does CloudFormation adjust the existing VPN, or tear it down and build a new one?

CloudFormation documents three ways it can update a resource [@aws-cfn-update-behaviors]:

| Update behavior | What CloudFormation does |
|---|---|
| No interruption | Updates the resource without disrupting it and without changing its ID |
| Some interruption | Updates it in place, with some interruption while it's reconfigured |
| Replacement | Creates a new resource with a new ID, points the things that depend on it at the new one, then deletes the old one |

A replaced VPN is a new VPN. It would get new tunnel addresses, and the partner would have to reconfigure their firewall for a link nobody meant to change. The reference page for each resource lists which behavior each property triggers. For a VPN connection [@aws-cfn-vpnconnection, @aws-cfn-vpn-tunnel-options]:

| Property | Update behavior |
|---|---|
| `VpnTunnelOptionsSpecifications` (the tunnel options, as a whole) | No interruption |
| `PreSharedKey` (inside one tunnel's options) | No interruption |
| `PreSharedKeyStorage` (`Standard` or `SecretsManager`) | Replacement |

So changing a key in the template is documented as an in-place update, while changing *where* the key is stored replaces the VPN. Adding or removing a property that requires replacement also triggers the update, even if the value it ends up with is the same [@aws-cfn-update-behaviors]. Adding `PreSharedKeyStorage: Standard` to a template that never mentioned it, to spell out the default, could replace the VPN.

### "No interruption" doesn't mean the traffic keeps flowing

CloudFormation's "no interruption" is about the *resource*: same VPN, same ID [@aws-cfn-update-behaviors]. It says nothing about packets. The VPN user guide is blunt about the tunnel itself: when you modify a VPN tunnel, connectivity over it is interrupted for up to several minutes [@aws-s2s-vpn-modify-tunnel]. Changing the storage mode on a tunnel interrupts it for up to several minutes too [@aws-s2s-vpn-psk-storage].

A new key also isn't usable until the partner has typed it in. After the AWS end changes key A, tunnel 1 stays down until the partner's firewall has the new key, whether that takes five minutes or a day. If one deploy changed both keys, both tunnels could sit down together for that whole wait, and the second tunnel exists to prevent exactly that.

## Change one tunnel at a time

AWS's own API already works per tunnel. `ModifyVpnTunnelOptions` changes the options of one tunnel per call, picked by its outside IP address, and the PSK is one of the options it can change [@aws-ec2-modify-vpn-tunnel-options, @aws-s2s-vpn-modify-tunnel]. Setting a new key on tunnel 1 by hand looks like this [@aws-cli-modify-vpn-tunnel-options]:

```bash tab="macOS / Linux"
aws ec2 modify-vpn-tunnel-options \
    --vpn-connection-id vpn-12345678901234567 \
    --vpn-tunnel-outside-ip-address 192.0.2.10 \
    --tunnel-options PreSharedKey=NEW_KEY_FOR_TUNNEL_1
```

```powershell tab="Windows (PowerShell)"
aws ec2 modify-vpn-tunnel-options `
    --vpn-connection-id vpn-12345678901234567 `
    --vpn-tunnel-outside-ip-address 192.0.2.10 `
    --tunnel-options PreSharedKey=NEW_KEY_FOR_TUNNEL_1
```

The commands differ only in the line-continuation character. A key typed on the command line ends up in your shell history, so for a real key read it from your secret store into a variable instead. The reply describes the whole VPN. Trimmed, and with the addresses swapped for the running example's, AWS's sample looks like this [@aws-cli-modify-vpn-tunnel-options]:

```json
{
    "VpnConnection": {
        "VpnConnectionId": "vpn-12345678901234567",
        "State": "available",
        "VgwTelemetry": [
            {
                "OutsideIpAddress": "192.0.2.10",
                "Status": "DOWN",
                "StatusMessage": "IPSEC IS DOWN"
            },
            {
                "OutsideIpAddress": "192.0.2.20",
                "Status": "DOWN",
                "StatusMessage": "IPSEC IS DOWN"
            }
        ]
    }
}
```

`VgwTelemetry` has one entry per tunnel, named by outside IP, with that tunnel's status. In AWS's sample both tunnels read `DOWN`, which says nothing about yours: in a working VPN you'd want `192.0.2.20` still up while `192.0.2.10` renegotiates. `State` is the VPN connection as a whole, and `available` means it still exists.

The rotation, written out for the running example:

1. **Check both tunnels are up.** If tunnel 2 is already down, changing tunnel 1 would take the whole link down. Stop and alert instead.
2. **Make the new key for tunnel 1 and get it to the partner.** Give them notice and a time.
3. **Change tunnel 1 only.** Tunnel 2 keeps carrying traffic on key B.
4. **Wait for the partner to enter the new key, then verify.** Tunnel 1 counts as done only once AWS reports it up again.
5. **If it doesn't come up in time, roll back.** Put the old key A back on tunnel 1. The partner never changed theirs, so the tunnel comes back on the old key without anyone on their side doing anything. That's another modify call, so another short interruption on tunnel 1 [@aws-s2s-vpn-modify-tunnel].
6. **Only then repeat steps 1 to 5 for tunnel 2.**

If tunnel 2's rotation fails and rolls back, tunnel 1 ends on its new key and tunnel 2 on its old one. Both are up, and the keys being different is fine, because each tunnel has its own.

<div class="relay-path" role="img" aria-label="Two timelines of a key change, each with a bar for tunnel 1 and a bar for tunnel 2. Top, one deploy changes both keys: both tunnels go down at the same moment and stay down until the partner enters both new keys, so for that stretch no tunnel is up. Bottom, one tunnel at a time: tunnel 1 goes down and comes back up on its new key before tunnel 2 is touched, then tunnel 2 goes down and comes back, so at every moment at least one tunnel is up.">
<svg viewBox="0 0 400 178" aria-hidden="true" focusable="false">
<text class="rp-title" x="2" y="12">One deploy changes both keys</text>
<text class="rp-sub" x="2" y="37">tunnel 1</text>
<text class="rp-sub" x="2" y="57">tunnel 2</text>
<line class="rp-msg rp-enc" x1="70" y1="34" x2="170" y2="34"/>
<line class="rp-msg" x1="170" y1="34" x2="300" y2="34"/>
<line class="rp-msg rp-enc" x1="300" y1="34" x2="396" y2="34"/>
<line class="rp-msg rp-enc" x1="70" y1="54" x2="170" y2="54"/>
<line class="rp-msg" x1="170" y1="54" x2="300" y2="54"/>
<line class="rp-msg rp-enc" x1="300" y1="54" x2="396" y2="54"/>
<text class="rp-hop rp-mid" x="235" y="30">down</text>
<text class="rp-hop rp-mid" x="235" y="50">down</text>
<text class="rp-hop rp-mid" x="235" y="74">no tunnel up until the partner</text>
<text class="rp-hop rp-mid" x="235" y="85">enters both new keys</text>
<text class="rp-title" x="2" y="112">One tunnel at a time</text>
<text class="rp-sub" x="2" y="137">tunnel 1</text>
<text class="rp-sub" x="2" y="157">tunnel 2</text>
<line class="rp-msg rp-enc" x1="70" y1="134" x2="130" y2="134"/>
<line class="rp-msg" x1="130" y1="134" x2="210" y2="134"/>
<line class="rp-msg rp-enc" x1="210" y1="134" x2="396" y2="134"/>
<line class="rp-msg rp-enc" x1="70" y1="154" x2="250" y2="154"/>
<line class="rp-msg" x1="250" y1="154" x2="330" y2="154"/>
<line class="rp-msg rp-enc" x1="330" y1="154" x2="396" y2="154"/>
<text class="rp-hop rp-mid" x="170" y="130">down</text>
<text class="rp-hop rp-mid" x="290" y="150">down</text>
<text class="rp-hop rp-mid rp-enc-text" x="233" y="174">at least one tunnel up the whole time</text>
</svg>
</div>

<p class="bitgrid-caption">Thick teal is a tunnel that's up, thin grey is one that's down. Changing both keys at once leaves a stretch with nothing up. Changing one, waiting for it to come back, then changing the other never does.</p>

## Knowing a tunnel is back up

Step 4 needs a signal a program can read. AWS publishes a CloudWatch metric, `TunnelState`, that can be filtered by `VpnId` and by `TunnelIpAddress`, the tunnel's outside IP [@aws-s2s-vpn-cloudwatch]:

| VPN uses | `TunnelState` = 1 | `TunnelState` = 0 |
|---|---|---|
| Static routes | UP | DOWN |
| BGP (dynamic routes) | ESTABLISHED | any other state |

A value between 0 and 1 means at least one tunnel is not up [@aws-s2s-vpn-cloudwatch]. Filtering by `TunnelIpAddress = 192.0.2.10` gives tunnel 1 on its own, which is how a rotation can watch tunnel 1 while ignoring tunnel 2. The tunnel coming back up is also the only proof that the partner entered the right key. An email that says "done" doesn't prove it.

## Automating it: why the wait needs a workflow

Secrets Manager can rotate a secret on a schedule. You write a Lambda function, and Secrets Manager calls it once per step, four steps in order: `createSecret` makes the new value, `setSecret` puts it on the service (here, the AWS end of the tunnel), `testSecret` checks it works, and `finishSecret` marks it as the current one [@aws-sm-rotation-lambda, @aws-sm-rotation-functions]. Versions carry labels: the new value waits as `AWSPENDING`, `finishSecret` moves `AWSCURRENT` to it, and the old value is labeled `AWSPREVIOUS`, so the last known good key is still there for a rollback [@aws-sm-rotation-functions].

That fits a database password, where the program changes both ends itself. It doesn't fit a VPN key on its own, because one end belongs to someone else:

- Each step is one call to the Lambda function [@aws-sm-rotation-lambda], and a Lambda function can run for at most 15 minutes [@aws-lambda-timeout]. A step can't sit and wait a day for the partner.
- If any step fails, Secrets Manager retries the *entire* rotation, more than once, during the secret's rotation window [@aws-sm-rotation-lambda]. A `testSecret` that fails because the partner hasn't typed the key yet would start the rotation over rather than wait.
- If `AWSPENDING` is left on a different version from `AWSCURRENT`, the next rotation assumes one is still in progress and returns an error [@aws-sm-rotation-functions]. A half-finished rotation has to be cleaned up deliberately.

So the waiting goes somewhere built to wait. AWS Step Functions runs a workflow (a **state machine**) as a series of steps, and a Standard workflow can run for up to a year [@aws-sfn-quotas]. Its callback pattern pauses a step until something outside hands back a token by calling `SendTaskSuccess` or `SendTaskFailure`, for example a person confirming the partner is ready. Setting `HeartbeatSeconds` makes the step fail with `States.Timeout` if nothing checks in within that time, so a forgotten rotation doesn't wait for the whole year [@aws-sfn-callback].

One way to put the pieces together, per tunnel: the workflow checks `TunnelState` is 1 on both tunnels, starts the rotation that creates the new key, notifies someone to send it to the partner (the notice carries no key), waits for the agreed time or a callback, sets the key on that one tunnel, then checks `TunnelState` for that tunnel's IP every few minutes. At 1, it moves on to the other tunnel. If the tunnel isn't back within the time limit, it puts the `AWSPREVIOUS` key back and alerts someone. The key still reaches the partner through a person, and the partner still types it, so the workflow can wait for that step and check that it happened, but it can't do it for them.

## What's verified and what isn't

Each claim above is checked against the AWS page it cites. A few things these pages don't settle, and nothing here was tried on a real VPN:

| Claim | Status |
|---|---|
| `PreSharedKey` and `VpnTunnelOptionsSpecifications` update with no interruption to the resource | Verified in the CloudFormation reference |
| Changing `PreSharedKeyStorage` replaces the VPN | Verified in the CloudFormation reference |
| Modifying a tunnel interrupts it for up to several minutes | Verified in the VPN user guide |
| The API changes one tunnel per call | Verified in the EC2 API reference |
| PSK rules (8 to 64 characters, no leading zero, 32-character default) | Verified in the VPN user guide and CloudFormation reference |
| `TunnelState` can be read per tunnel by outside IP | Verified in the VPN user guide |
| Lambda's 15-minute limit, Secrets Manager restarting a failed rotation, Step Functions waiting up to a year with a heartbeat | Verified in each service's guide |
| A CloudFormation deploy that changes both keys applies them one tunnel after the other, or both at once | **Unverified.** The docs don't say. |
| Tunnel 2 stays up while tunnel 1's key changes | **Unverified.** AWS says traffic moves to the available tunnel when one is down, but nothing says a key change on one tunnel leaves the other untouched. |
| Describe calls return the key when it's stored in Secrets Manager | **Unverified** |
| A key change through CloudFormation leaves the VPN in place in practice | **Unverified until deployed.** The docs say no interruption, and nobody has changed a key on a test VPN to watch it. |

The cheapest way to settle the last three rows is a throwaway VPN in a test account: change one tunnel's key, watch `TunnelState` for both outside IPs, and check the VPN ID and outside addresses are the same afterward.

## The formula

**One tunnel, one key, one change at a time.** Change the key on one tunnel, wait until that tunnel is up again on the new key, and only then touch the other one, with the old key kept until the new one is proven.
