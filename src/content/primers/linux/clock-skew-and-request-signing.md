---
title: Clock skew and signed AWS requests
description: Why a server whose clock is a few minutes off gets its AWS requests rejected, how chrony keeps a Linux clock right, and three commands that tell you which part broke.
order: 1
updated: 2026-10-19
---

A Linux server runs a job every hour that uploads the last hour's files to an S3 bucket with the AWS CLI. It has worked for months. One morning every upload fails with `Signature not yet current`. The access keys haven't changed, the bucket policy hasn't changed, and the same command works from your laptop. The server's clock is 8 minutes fast.

Every request the AWS CLI or an SDK sends is signed, and the signature includes the time on the machine that sent it. AWS compares that time to its own clock and rejects requests that are too far off. Anything that talks to AWS from a server runs into this sooner or later: backup scripts, log shippers, build agents, an application reading files from S3. The fix is almost never in the credentials. It's in the background service that's supposed to keep the server's clock right.

This primer follows that one upload server the whole way.

## A few terms

- **Clock skew**: how far one machine's clock is from another's. Here, the difference between the server's clock and AWS's. (chrony prints a line called `Skew` too, but that's a different measurement, given in ppm, and not what this primer means.)
- **UTC**: Coordinated Universal Time, the time standard servers and AWS share. AWS's request timestamps use it, which is why they end in `Z`.
- **Signed request**: a request that carries a **signature**, a value computed from the request's details and your secret key. The receiver repeats the calculation to check the request came from you and wasn't changed on the way [@aws-sigv].
- **SigV4**: Signature Version 4, the signing method AWS uses for its APIs [@aws-sigv].
- **NTP**: Network Time Protocol, the way a machine asks a **time source** (a server that knows the time accurately) what time it is.
- **chrony**: the NTP software most Linux distributions use. It has two parts: **chronyd**, the background service (a *daemon*) that keeps the clock right, and **chronyc**, the command you run to ask chronyd questions or give it instructions [@chronyc].
- **Slew** and **step**: the two ways to correct a clock. Slewing runs the clock slightly fast or slow until it catches up. Stepping jumps it straight to the right time [@chronyc].
- **ppm**: parts per million, how clock rates are measured. A clock that's 1 ppm fast gains one second every million seconds.

## How AWS uses the time on a request {only: AWS}

Signing happens inside the CLI, and it goes roughly like this [@aws-sigv]:

1. The CLI builds a standard text form of the request: the method, the path, the headers, and a hash of the body.
2. It calculates a signature from that text and your credentials, and adds the signature to the request in an `Authorization` header.
3. AWS receives the request, repeats the same calculation, and only processes the request if the two signatures match.

The request's date and time go into that calculation, in either the HTTP `Date` header or an `x-amz-date` header [@aws-sigv-troubleshooting]. The CLI reads that time from the server's own clock. If the clock is wrong, the timestamp is wrong, and AWS rejects the request [@aws-ec2-set-time].

AWS checks the timestamp to protect against replay attacks, where someone captures a valid signed request and sends it again later. In most cases a request has to reach AWS within five minutes of its timestamp, or AWS denies it [@aws-sigv]. The error tells you which way the clock is off [@aws-sigv-troubleshooting]:

| Server clock | Timestamp looks | Error |
|---|---|---|
| Ahead of AWS | In the future | `Signature not yet current: <date> is still later than <date>` |
| Behind AWS | Too old | `Signature expired: <date> is now earlier than <date>` |

On the upload server, the real time is 14:00 UTC but the server thinks it's 14:08. The CLI stamps the upload `20261019T140800Z`. AWS reads that as 8 minutes in the future, which is past the five minutes it allows, so the upload fails with `Signature not yet current`. If the clock had been 8 minutes slow instead, the same upload would have been stamped 13:52 and failed with `Signature expired`.

<div class="skew-window" role="img" aria-label="A number line of the server's clock minus AWS's clock, in minutes, from minus 10 to plus 10. The middle band, from minus 5 to plus 5, is accepted. Outside it on both sides, requests are rejected. A server 8 minutes behind stamps its request 13:52 when the real time is 14:00, lands in the left rejected zone, and gets Signature expired. A server 8 minutes ahead stamps 14:08, lands in the right rejected zone, and gets Signature not yet current.">
<svg viewBox="0 0 420 156" aria-hidden="true" focusable="false">
<text class="sk-name" x="74" y="24">8 min behind</text>
<text class="sk-small" x="74" y="36">stamps 13:52</text>
<text class="sk-name sk-hot" x="210" y="24">AWS's clock</text>
<text class="sk-small" x="210" y="36">14:00</text>
<text class="sk-name" x="346" y="24">8 min ahead</text>
<text class="sk-small" x="346" y="36">stamps 14:08</text>
<rect class="sk-no" x="40" y="48" width="85" height="28"/>
<rect class="sk-ok" x="125" y="48" width="170" height="28"/>
<rect class="sk-no" x="295" y="48" width="85" height="28"/>
<text class="sk-name" x="210" y="60">accepted</text>
<text class="sk-small" x="210" y="71">within 5 min either side</text>
<circle class="sk-dot" cx="74" cy="62" r="4"/>
<circle class="sk-dot" cx="346" cy="62" r="4"/>
<line class="sk-axis" x1="40" y1="90" x2="380" y2="90"/>
<line class="sk-tick" x1="40" y1="87" x2="40" y2="93"/>
<line class="sk-tick" x1="125" y1="87" x2="125" y2="93"/>
<line class="sk-tick" x1="210" y1="87" x2="210" y2="93"/>
<line class="sk-tick" x1="295" y1="87" x2="295" y2="93"/>
<line class="sk-tick" x1="380" y1="87" x2="380" y2="93"/>
<text class="sk-small" x="40" y="104">-10</text>
<text class="sk-small" x="125" y="104">-5</text>
<text class="sk-small" x="210" y="104">0</text>
<text class="sk-small" x="295" y="104">+5</text>
<text class="sk-small" x="380" y="104">+10</text>
<text class="sk-small" x="210" y="118">server clock minus AWS's clock (minutes)</text>
<text class="sk-small" x="74" y="136">rejected:</text>
<text class="sk-small" x="74" y="147">Signature expired</text>
<text class="sk-small" x="346" y="136">rejected:</text>
<text class="sk-small" x="346" y="147">Signature not yet current</text>
</svg>
</div>

<p class="bitgrid-caption">The window is the same width on both sides of AWS's clock. Which side the server lands on decides which error you get.</p>

None of this involves the credentials, which is why the same keys still work from your laptop. A signature error that only happens on one machine points at that machine's clock first.

## How a Linux server keeps its clock right

A computer's clock runs a little fast or a little slow, and the error adds up. A clock that's 20 ppm fast gains 20 × 86,400 / 1,000,000 ≈ 1.7 seconds a day. chronyd fixes that by asking one or more time sources what time it is, working out how far off the local clock is, and correcting it, over and over for as long as the machine runs [@chronyc].

It finds its sources in its configuration file, as `server` or `pool` lines. The file is `/etc/chrony.conf` on Amazon Linux, Red Hat, and SUSE, and `/etc/chrony/chrony.conf` on Ubuntu [@aws-ec2-ntp].

### Slewing and stepping

Normally chronyd slews: it speeds the clock up or slows it down a little until the offset is gone, so time never jumps. Some software is seriously affected by jumps in the system time, which is why slewing is the default [@chronyc].

Slewing has a cost. If the clock is far off, the correction takes a very long time [@chronyc], and the server keeps signing requests with the wrong time while it happens. For a clock 8 minutes out, you'll want to step it instead, with `chronyc makestep`, which cancels the slow correction and jumps the clock to the right time at once [@chronyc].

### When no source answers

chronyd can only correct the clock against a source it can reach. If every source it's configured with is unreachable, because a firewall blocks it, the address is wrong, or the server listed only exists on some other network, chronyd keeps running and the clock keeps drifting at its own rate. No service fails and no job stops. The first sign can be the AWS error, days or months later, when the drift finally passes five minutes.

## Amazon Time Sync Service {only: AWS}

AWS runs a time service reachable from every EC2 instance, backed by satellite-connected and atomic reference clocks in each Region [@aws-ec2-set-time]. Instances reach it at a link-local address, an address that only works from the instance itself, so the traffic stays inside your VPC and needs no VPC configuration changes [@aws-ec2-ntp]:

| | Address |
|---|---|
| IPv4 | `169.254.169.123` |
| IPv6 | `fd00:ec2::123` (Nitro-based instances only) |

Many AMIs already use it. Amazon Linux 2023 and recent versions of Amazon Linux 2 are set up for it by default, and so are Windows AMIs from the August 2018 release on [@aws-ec2-ntp]. On other images, AWS's instructions add this line to the chrony configuration file, before any other `server` or `pool` lines [@aws-ec2-ntp]:

```text
server 169.254.169.123 prefer iburst minpoll 4 maxpoll 4
```

Then restart chronyd so it reads the file again. The service is `chronyd` on Amazon Linux and Red Hat and `chrony` on Ubuntu [@aws-ec2-ntp]:

```bash
sudo systemctl restart chronyd
```

Machines outside EC2, like an on-premises server that uploads to S3, can't reach the link-local address. AWS also runs a public version of the service at `time.aws.com` for those, and as a backup for instances [@aws-ec2-set-time].

<details class="aside">
<summary>Leap seconds and mixing sources</summary>

Every so often a leap second is added to UTC. The Amazon Time Sync Service spreads it out over a longer period instead of adding it all at once, which AWS calls smearing. Sources that smear and sources that don't disagree during a leap second, so AWS recommends against configuring both kinds on one machine at that time [@aws-ec2-set-time].

</details>

## Changing the running service vs. the file

chronyc can add a source to chronyd while it runs [@chronyc]:

```bash
sudo chronyc add server 169.254.169.123 iburst
```

The words after `add server` use the same syntax as a `server` line in the configuration file [@chronyc]. The command changes the running chronyd, though, not the file, and chronyd reads its sources from the file when it starts, which is why AWS's setup steps edit the file and then restart chronyd [@aws-ec2-ntp]. A source added with `chronyc add server` is gone after the next restart or reboot.

| | `chronyc add server` | A `server` line in the config file |
|---|---|---|
| Takes effect | Immediately | When chronyd next starts or restarts |
| Survives a reboot | No | Yes |
| Good for | Testing whether a source works before you commit to it | The permanent fix |

The tempting move on the upload server is to run `chronyc add server`, see the uploads work again, and stop there. The clock is right until the next reboot, and then it drifts again, often weeks later when nobody remembers the fix. Use `add server` to prove the source works, then put the line in the file.

## Diagnosing it in three commands

Work from the symptom back to the cause: how far off is the clock, can chronyd reach a source, and is it in sync.

### 1. How far off is the clock?

```bash
date -u
```

```text
Mon Oct 19 14:08:03 UTC 2026
```

Compare that with a clock you trust, like `date -u` on your laptop. The upload server is 8 minutes ahead. More than five minutes either way explains the AWS error by itself.

### 2. Can chronyd reach a source?

```bash
chronyc sources -v
```

The `-v` adds a few caption lines explaining the columns [@chronyc], left out here. A healthy server using the Amazon Time Sync Service shows one line like this [@aws-ec2-ntp]:

```text
MS Name/IP address         Stratum Poll Reach LastRx Last sample
===============================================================================
^* 169.254.169.123               3   6    17    43    -30us[ -226us] +/-  287us
```

The broken upload server shows something like this instead, with a time server it can't reach (made up for this example):

```text
MS Name/IP address         Stratum Poll Reach LastRx Last sample
===============================================================================
^? ntp.example.com               2  10     0    41d   -201ms[ -201ms] +/-   38ms
```

Each part means [@chronyc]:

| Part | Meaning |
|---|---|
| `^` | The source is a server. |
| `*` | The source chronyd is using right now. `+` means it's being combined with the best one, `-` that it could be used but isn't. |
| `?` | Not usable, often because it isn't answering. |
| `Stratum` | How many hops the source is from a reference clock, like an atomic clock. Lower is closer. |
| `Reach` | The last eight tries, in octal. `377` means all eight got an answer, `0` means none did. |
| `LastRx` | How long ago the last good answer arrived, in seconds unless it ends in `m`, `h`, `d`, or `y`. |
| `Last sample` | How far off the local clock was at the last measurement. Positive means the local clock was ahead. |

`^?`, `Reach 0`, and `41d` together say chronyd hasn't heard from its only source in 41 days, so nothing has corrected the clock since.

### 3. Is the clock in sync?

```bash
chronyc tracking
```

On a healthy instance the top lines look like this [@aws-ec2-ntp]:

```text
Reference ID    : A9FEA97B (169.254.169.123)
Stratum         : 4
System time     : 0.000002191 seconds fast of NTP time
Last offset     : +0.000002164 seconds
Leap status     : Normal
```

`Reference ID` names the server the machine is synchronized to. `System time` is how far the system clock is from the time chronyd thinks is right, and `Last offset` is how far off it was at the last update, positive meaning ahead. `Leap status` reads `Not synchronised` when chronyd isn't in sync with anything [@chronyc]. On the upload server it does.

### Putting it together

| You see | It means | Fix |
|---|---|---|
| `date -u` off by more than 5 minutes, `Reach 0` | chronyd has no source it can reach | Add a reachable `server` line to the config file and restart chronyd |
| A good source with `*`, but the clock still minutes off | chronyd is slewing a large offset | `sudo chronyc makestep` |
| Fixed after `chronyc add server`, broken again after a reboot | The fix only lived in the running service | Put the line in the config file |

On the upload server it's the first row and then the second: add the Time Sync Service line, restart chronyd, step the clock, and run the next upload by hand to watch it go through. If anything else on the server cares about time jumping, stop it before the step [@chronyc].
