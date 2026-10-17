---
title: Giving a machine a name you control
description: A hosts-file line or an SSH config alias can point a name at a machine without touching DNS. How each works, which to use, and how to tell a naming problem from a network one.
order: 6
updated: 2026-10-14
---

You've just built a virtual machine at `10.0.1.23`, and there's no DNS record for it. Typing the address every time gets old, and `ssh app-server` fails with `Could not resolve hostname app-server`, because nothing on your machine knows where `app-server` is. One line in the right file fixes that, without asking anyone to change DNS.

Two files can do it, and they answer slightly different needs. A **hosts file** line makes the name work for every program on your machine. An **SSH config** alias only works for SSH, but it can also fill in the user and key. Common reasons to reach for one:

- a lab machine or test server that never gets a DNS record;
- trying a new server under its real name before the DNS record is switched to it, by pointing the name at it on your machine only;
- several servers you SSH into with different users and keys, which an SSH config keeps track of for you.

This primer follows one example the whole way: a server at `10.0.1.23` that you log into as the user `deploy` with the key `~/.ssh/app-server.pem`, and want to reach as `app-server`.

## A few terms

- **Hostname**: a name for a machine, like `app-server` or `www.example.com`.
- **Resolver**: the part of the operating system that turns a hostname into an IP address when a program asks.
- **DNS**: the shared, network-wide system of names, explained in [DNS resolution](/primers/networking/dns-resolution/). Changing it needs access to the DNS server or zone.
- **Hosts file**: a plain text file on your own machine that maps addresses to names. The resolver reads it alongside DNS.
- **SSH**: the program used to log into another machine's command line. `scp` and `sftp` copy files over the same connection.
- **SSH config**: a file of settings for your SSH client, such as which address, user, and key to use for a given name.
- **Host key**: a key that identifies the server itself. SSH remembers it in `~/.ssh/known_hosts` the first time you connect, and warns if it changes [@openssh-ssh].

## Two questions, two failures

Connecting to a machine by name answers two separate questions, in order:

| Question | Answered by | Failure looks like |
|---|---|---|
| What IP address does this name mean? | An SSH config `HostName`, the hosts file, or DNS | `Could not resolve hostname` |
| Can I reach that address and log in? | Routes, firewalls, security groups, the user, the key | A timeout, `Connection refused`, or `Permission denied` |

Here's where each part happens when you type `ssh app-server`, and where the two options plug in:

<div class="gitops-flow" role="img" aria-label="What happens when you type ssh app-server. First, ssh reads ~/.ssh/config and looks for a matching Host block; an SSH config alias plugs in here and swaps in the HostName, user, and key. Next, the resolver turns the name into an address using the hosts file and DNS; a hosts-file line plugs in here. Those three steps answer the first question, which address. Then ssh connects to 10.0.1.23 on port 22, which depends on routes and firewalls, and logs in as deploy with the key, after checking the server's host key. Those two steps answer the second question, can I reach it and log in.">
<svg viewBox="0 0 400 256" aria-hidden="true" focusable="false">
<defs><marker id="nh-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="go-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="go-box" x="20" y="10" width="200" height="32" rx="3"/>
<text class="go-name" x="120.0" y="24.0">ssh app-server</text>
<text class="go-small" x="120.0" y="35.0">what you type</text>
<line class="go-arrow" x1="120" y1="43" x2="120" y2="56" marker-end="url(#nh-head)"/>
<rect class="go-box" x="20" y="58" width="200" height="32" rx="3"/>
<text class="go-name" x="120.0" y="72.0">ssh reads ~/.ssh/config</text>
<text class="go-small" x="120.0" y="83.0">is there a matching Host block?</text>
<line class="go-arrow" x1="120" y1="91" x2="120" y2="104" marker-end="url(#nh-head)"/>
<rect class="go-box" x="20" y="106" width="200" height="32" rx="3"/>
<text class="go-name" x="120.0" y="120.0">resolver: name to address</text>
<text class="go-small" x="120.0" y="131.0">hosts file and DNS</text>
<line class="go-arrow" x1="120" y1="139" x2="120" y2="168" marker-end="url(#nh-head)"/>
<rect class="go-box" x="20" y="170" width="200" height="32" rx="3"/>
<text class="go-name" x="120.0" y="184.0">connect to 10.0.1.23, port 22</text>
<text class="go-small" x="120.0" y="195.0">routes and firewalls</text>
<line class="go-arrow" x1="120" y1="203" x2="120" y2="216" marker-end="url(#nh-head)"/>
<rect class="go-box" x="20" y="218" width="200" height="32" rx="3"/>
<text class="go-name" x="120.0" y="232.0">log in as deploy</text>
<text class="go-small" x="120.0" y="243.0">key, then host key check</text>
<rect class="go-box go-agent" x="250" y="54" width="146" height="40" rx="3"/>
<text class="go-name" x="323.0" y="66.5">Option 2: SSH config</text>
<text class="go-small" x="323.0" y="77.5">swaps in HostName,</text>
<text class="go-small" x="323.0" y="88.5">user, and key</text>
<rect class="go-box go-agent" x="250" y="102" width="146" height="40" rx="3"/>
<text class="go-name" x="323.0" y="114.5">Option 1: hosts file</text>
<text class="go-small" x="323.0" y="125.5">a line mapping the</text>
<text class="go-small" x="323.0" y="136.5">name to 10.0.1.23</text>
<line class="go-arrow go-hot" x1="249" y1="74" x2="222" y2="74" marker-end="url(#nh-head)"/>
<line class="go-arrow go-hot" x1="249" y1="122" x2="222" y2="122" marker-end="url(#nh-head)"/>
<line class="go-divider" x1="8" y1="156" x2="396" y2="156"/>
<text class="go-small go-start" x="250" y="30">question 1:</text><text class="go-small go-start" x="250" y="41">which address?</text>
<text class="go-small go-start" x="250" y="196">question 2:</text><text class="go-small go-start" x="250" y="207">can I reach it</text><text class="go-small go-start" x="250" y="218">and log in?</text>
</svg>
</div>

<p class="bitgrid-caption">Both options plug into the top half, which only finds an address. Nothing in the top half can fix a problem in the bottom half.</p>

Fixing the first question never fixes the second. A name that resolves to an address a firewall blocks still times out, just with a different error than before.

`known_hosts` belongs to neither question in the way people often expect. It records each server's host key so SSH can tell it's talking to the same machine as last time. It says nothing about where the machine is [@openssh-ssh].

## How a name becomes an address

Programs ask the operating system's resolver, and the resolver reads the hosts file as well as asking DNS. Each line of the hosts file holds an address, a name, and optional extra names, separated by any number of spaces or tabs, with `#` starting a comment [@man-hosts]:

```text
10.0.1.23   app-server
```

Each system decides the order in its own way:

- **Linux**: `/etc/nsswitch.conf` sets it. Its `hosts:` line lists the sources to try, such as `files dns`, and they're queried in that order until one finds an answer [@man-nsswitch]. `files` means the hosts file.
- **macOS**: the system resolver reads the hosts file and uses it alongside answers from DNS [@macos-hosts].
- **Windows**: the resolver uses the hosts file too. Even `Resolve-DnsName`, the usual lookup command, only leaves it out when you pass `-NoHostsFile` [@ms-resolve-dnsname].

| System | Hosts file |
|---|---|
| macOS, Linux | `/etc/hosts` [@man-hosts] |
| Windows | `C:\Windows\System32\drivers\etc\hosts` [@ms-hosts-file] |

Editing it needs administrator rights on all three. Changes normally take effect immediately, except in programs that keep their own copy of the file [@man-hosts].

## Option 1: a hosts-file line

Add the line, as an administrator:

```bash tab="macOS / Linux"
echo "10.0.1.23   app-server" | sudo tee -a /etc/hosts
```

```powershell tab="Windows (PowerShell)"
# Run PowerShell as Administrator
Add-Content -Path "$env:SystemRoot\System32\drivers\etc\hosts" -Value "10.0.1.23   app-server"
```

Then check what the resolver now returns for the name. These go through the same lookup programs use, hosts file included [@man-getent, @macos-dscacheutil, @ms-resolve-dnsname]:

```bash tab="macOS / Linux"
getent hosts app-server                  # Linux
dscacheutil -q host -a name app-server   # macOS
```

```powershell tab="Windows (PowerShell)"
Resolve-DnsName app-server
```

On Linux, a working entry prints the address and the name:

```text
10.0.1.23       app-server
```

If an old answer seems stuck, clear the resolver's cache [@macos-dscacheutil, @systemd-resolvectl, @ms-clear-dnsclientcache]:

```bash tab="macOS / Linux"
sudo dscacheutil -flushcache   # macOS
resolvectl flush-caches        # Linux with systemd-resolved
```

```powershell tab="Windows (PowerShell)"
Clear-DnsClientCache
```

The hosts file only affects the one machine it's on, and you keep it up to date by hand. When the server's address changes, the line goes stale and the name quietly points at the wrong place.

## Option 2: an SSH config alias

The SSH client reads `~/.ssh/config`, or `%userprofile%\.ssh\config` on Windows [@openssh-ssh-config, @ms-openssh-config]. A `Host` block applies its settings when the name you typed matches the name after `Host` [@openssh-ssh-config]:

```text
Host app-server
    HostName 10.0.1.23
    User deploy
    IdentityFile ~/.ssh/app-server.pem
    IdentitiesOnly yes
```

`app-server` is now only a label. `HostName` is the real address or DNS name SSH connects to, so the hosts file isn't involved. `IdentitiesOnly yes` makes SSH offer only the key named here, even when an SSH agent holds others [@openssh-ssh-config]. With the user and key set too, `ssh app-server` now does what `ssh -i ~/.ssh/app-server.pem deploy@10.0.1.23` did.

`ssh -G` prints the settings SSH would use for a name, after reading every `Host` block, without connecting [@openssh-ssh]. For `app-server` it shows the block took effect:

```bash
ssh -G app-server
```

```text
user deploy
hostname 10.0.1.23
port 22
identitiesonly yes
identityfile ~/.ssh/app-server.pem
```

If it shows `hostname` as the name you typed and `user` as your own username, no block matched. A typo like `ssh -G app-sever` looks like that.

An `Include` line pulls settings in from other files, so a separate file such as `~/.ssh/config_lab` only takes effect if the main config names it [@openssh-ssh-config]:

```text
Include ~/.ssh/config_lab
```

## Which one to use

| | Hosts file | SSH config |
|---|---|---|
| Works for | Every program on the machine: browsers, `curl`, SSH | SSH, and the tools that run over it, like `scp` and `sftp` |
| Needs administrator rights | Yes | No, it's in your home folder |
| Can set the user and key | No | Yes |
| Good for | A name that has to work everywhere, like trying a website on a new server | Logging into servers |

When SSH is the only thing that needs the name, the SSH config is usually the better choice. Both live on one machine only. A name everyone on the network should share belongs in DNS.

## When an EC2 instance's address changes {only: AWS}

Both options point at a fixed address, so on a cloud server the address has to stay put, or the name goes stale. On EC2:

| Address | Changes when |
|---|---|
| Public IPv4 | The instance is stopped and started again. It gets a new one each time, unless it has an Elastic IP [@aws-ec2-addressing] |
| Private IPv4 | The instance is terminated and replaced. It survives a stop and start [@aws-ec2-addressing] |

A private address inside the VPC is usually stable enough for a hosts line or a `HostName`. If it moves often, use a DNS record in a private zone that every machine on the network shares, or skip addresses and reach the instance by its ID through [Session Manager](/primers/networking/reaching-private-resources/#through-session-manager-or-ssh).

## Resolving a name doesn't open the door

After the name resolves, the connection still has to get through the network. A firewall rule that allows port 22 from `10.0.2.0/25` covers only `10.0.2.0` through `10.0.2.127`. A laptop at `10.0.3.20` falls outside it, so its connection times out even though the name resolves fine. [IP addresses and CIDR](/primers/networking/ip-addresses-and-cidr/) explains how to read a range like that.

## Troubleshooting in order

Work down the diagram: find the address, reach it, then log in.

1. **Does the alias say what you expect?** `ssh -G app-server` [@openssh-ssh].
2. **Does the name resolve?** Use the resolver checks under Option 1. No answer means the first question is still unsolved.
3. **Can you reach the address?** Try the port directly. A hang points at routing or a firewall, and "refused" means the machine answered but nothing is listening on that port [@openbsd-nc, @ms-test-netconnection]:

   ```bash tab="macOS / Linux"
   nc -vz 10.0.1.23 22
   ```

   ```powershell tab="Windows (PowerShell)"
   Test-NetConnection 10.0.1.23 -Port 22
   ```

4. **Why did login fail?** `ssh -v app-server` prints each step, including which keys SSH offered [@openssh-ssh].
5. **A warning that the host key changed** means the server's key no longer matches the one `known_hosts` remembers for that name. SSH warns, and turns off password logins for it, because that's also what an impostor would look like [@openssh-ssh]. If you know the server was rebuilt, `ssh-keygen -R app-server` removes the old key so SSH can learn the new one [@openssh-ssh-keygen].
