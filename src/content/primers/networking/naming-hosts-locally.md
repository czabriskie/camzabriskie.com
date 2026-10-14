---
title: Giving a machine a name you control
description: A hosts-file line or an SSH config alias can point a name at a machine without touching DNS, and the two answer different questions.
order: 6
updated: 2026-10-14
---

`ssh app-server` fails with `Could not resolve hostname app-server` when nothing on your machine knows where `app-server` lives. Fixing that takes one line in the right file. Which file depends on what you need: only the name resolved, or the user and key filled in too.

## Two questions, two failures

Connecting to a machine by name answers two separate questions, in order.

| Question | Answered by | Failure looks like |
|---|---|---|
| What IP address does this name mean? | Hosts file, DNS, or an SSH config `HostName` | `Could not resolve hostname` |
| Can I reach that IP and log in? | Routes, firewalls, security groups, user, key | A timeout, or `Permission denied` |

Fixing the first question never fixes the second. A name that resolves to an address your firewall blocks fails with a timeout instead of a resolution error, which is a different problem.

A `known_hosts` entry is a third thing. It records the server's host key so ssh can check it is talking to the machine it expects. It says nothing about where the machine is.

## How a name becomes an address

Programs ask the operating system's resolver, which checks local sources before the network. The hosts file is a plain text table that maps IP addresses to names. Each line holds an address, a name, and optional aliases, separated by any number of spaces or tabs, with `#` starting a comment [@man-hosts]:

```
10.0.1.23   app-server
```

On Linux, `/etc/nsswitch.conf` sets the order. Its `hosts:` line lists the sources to try, such as `files dns`, and the lookup stops at the first source that answers [@man-nsswitch]. Here `files` is the hosts file. macOS and Windows check the hosts file before DNS by default.

| OS | Hosts file |
|---|---|
| macOS, Linux | `/etc/hosts` |
| Windows | `C:\Windows\System32\drivers\etc\hosts` [@ms-hosts-file] |

All three need administrator rights to edit. Changes normally take effect immediately, except for programs that cache the file [@man-hosts].

## Option 1: add a hosts-file line

```bash tab="macOS / Linux"
echo "10.0.1.23   app-server" | sudo tee -a /etc/hosts
```

```powershell tab="Windows (PowerShell)"
# Run PowerShell as Administrator
Add-Content -Path "$env:SystemRoot\System32\drivers\etc\hosts" -Value "10.0.1.23   app-server"
```

If the name still doesn't resolve, clear the resolver cache.

```bash tab="macOS / Linux"
# macOS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
# Linux with systemd-resolved
resolvectl flush-caches
```

```powershell tab="Windows (PowerShell)"
Clear-DnsClientCache
```

`Clear-DnsClientCache` clears the resolver cache [@ms-clear-dnsclientcache]. Check what the system resolver returns, which includes the hosts file:

```bash tab="macOS / Linux"
getent hosts app-server                 # Linux
dscacheutil -q host -a name app-server  # macOS
```

```powershell tab="Windows (PowerShell)"
[System.Net.Dns]::GetHostAddresses("app-server")
```

`Resolve-DnsName` is the usual Windows lookup command, but it queries DNS directly and can skip the hosts file [@ms-resolve-dnsname], so it is the wrong check here.

The hosts file works on one machine at a time and you maintain it by hand. When the address changes, the line goes stale and the name points at the wrong place.

## Option 2: an SSH config alias

The SSH client reads `~/.ssh/config` (on Windows, `%USERPROFILE%\.ssh\config`). A `Host` block applies its settings whenever the name after `Host` is the one you typed [@openssh-ssh-config]:

```
Host app-server
    HostName 10.0.1.23
    User deploy
    IdentityFile ~/.ssh/app-server.pem
    IdentitiesOnly yes
```

`app-server` is now a label. `HostName` is the address or DNS name ssh connects to, so no hosts-file entry is needed. `IdentitiesOnly yes` restricts ssh to the key you named, even if an agent holds others [@openssh-ssh-config]. The block also sets the user, so `ssh app-server` replaces `ssh -i key deploy@10.0.1.23`.

`ssh -G app-server` prints the settings ssh would use without connecting. If it shows `hostname app-server` and your local username, no block matched [@openssh-ssh].

An `Include` line pulls in other config files, so settings kept in `~/.ssh/config_work` apply only if the main file names it [@openssh-ssh-config]:

```
Include ~/.ssh/config_work
```

The config file affects only ssh, scp and sftp. It needs no administrator rights and carries the user and key, which makes it the better choice when ssh is the only thing you use the name for.

## Cloud instances change address

On a cloud VM the address you point at has to stay put, or the name goes stale.

| Address | Changes when |
|---|---|
| Public IPv4 | The instance stops and starts, unless it has an Elastic IP [@aws-ec2-addressing] |
| Private IPv4 | The instance is terminated and replaced. It survives stop and start [@aws-ec2-addressing] |

A private address inside the network is usually stable enough for a hosts line or a `HostName`. If the address moves often, use a DNS record in a private zone, which every machine on the network shares, or skip addresses and reach the instance by ID through [Session Manager](/primers/networking/reaching-private-resources/#through-session-manager-or-ssh).

## Resolving a name does not open the door

After the name resolves, the connection still has to pass the network. A firewall rule that allows port 22 from `10.0.2.0/25` covers only `10.0.2.0` through `10.0.2.127`. A client at `10.0.3.20` falls outside it, and the connection times out even though the name resolves. See [IP addresses and CIDR](/primers/networking/ip-addresses-and-cidr/) for reading a range like this.

## Troubleshooting order

1. `ssh -G app-server`: does the alias say what you expect?
2. Resolve the name with the commands above. No answer means the first question is unsolved.
3. `nc -vz 10.0.1.23 22`: a hang points at routing or a firewall, "refused" means nothing is listening.
4. `ssh -v deploy@app-server`: shows which keys ssh offers and why authentication failed.
5. A "remote host identification has changed" warning means the key stored under that name differs from what the server presented. Rebuild the entry with `ssh-keygen -R app-server` only if you know the server was replaced.

Check them in that order: resolve the name, reach the address, then authenticate.
