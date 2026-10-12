---
title: Network file shares
description: How machines share folders over a network with SMB and NFS, how a NAS differs from a SAN or a local disk, which ports each one needs and which way the connections go, and why port 445 never belongs on the internet.
order: 11
updated: 2026-10-12
---

A Windows PC exports a report file every night, and another machine needs to read those files. The usual answer is a **network file share**: the PC writes into a shared folder on a storage box on the same network, and the other machine reads from that same folder. Nobody copies files by hand, and each machine's access to the folder is a network connection with a port and a direction.

The example below follows one setup through the whole primer:

- `pc01`, a Windows PC, writes reports to `\\nas01.example.com\reports`.
- `nas01.example.com`, a storage box on the office network, holds the shared folder.
- `pc02`, a Linux machine, reads the new files from the same share.

## A few terms

- **Share**: a folder that one machine makes available to others over the network.
- **Mount**: attach a share so it appears as part of the local file system, as a drive letter like `R:` on Windows or a folder like `/mnt/reports` on Linux.
- **File system**: the part of an operating system that turns raw disk space into files and folders, with names, sizes, and permissions.
- **SMB** (Server Message Block): the file-sharing protocol Windows uses [@ms-smb-overview].
- **NFS** (Network File System): the file-sharing protocol most Linux and Unix machines use [@rfc7530].
- **NAS** (network-attached storage): a storage device that connects to a network and provides file access to clients [@snia-nas], usually over SMB, NFS, or both.
- **Client and server**: the **client** is the machine that opens the connection and asks for files, and the **server** is the one that holds them and answers [@ms-smb-overview]. In the example, `pc01` and `pc02` are both clients, and `nas01` is the server.

## Where the file system lives: NAS, SAN, and local disks

Storage comes in three broad shapes, and the useful difference between them is which machine runs the file system:

| | Local disk (DAS) | SAN | NAS |
|---|---|---|---|
| Stands for | Direct-attached storage | Storage area network | Network-attached storage |
| Connected | Straight to one machine, not to the network | Over a separate storage network | Over the ordinary network |
| What travels between them | Disk blocks, inside the machine | Disk blocks | Whole files and folders |
| Who runs the file system | The machine | Each server using a volume | The NAS |
| Typical protocols | A cable straight to the machine | Fibre Channel, iSCSI | SMB, NFS |
| Typical use | One server's own storage | Databases, virtual machine storage | Shared folders, home drives, team data |

Sources for the table: TechTarget's comparison of the three [@techtarget-nas-san-das] and SNIA's definition of a NAS [@snia-nas].

A SAN hands out raw disk space, called **block storage**, and the server that uses it formats it with its own file system, so to that server it looks like a local disk. A NAS keeps the file system to itself and hands out files. That's why a NAS is the one to reach for when several machines need the same folder: they all send requests like "open `report-0412.csv`" to the NAS, and the NAS sorts out names and permissions in one place. The rest of this primer is about NAS-style sharing, SMB and NFS.

## SMB

SMB is how Windows shares files: when you open `\\server\share` or map a network drive, the machine's SMB client opens a connection to the SMB server on the other end [@ms-smb-overview]. A Windows PC, a Windows server, or a NAS can all be SMB servers, and Linux and macOS machines can be SMB clients or servers too. On Linux that's usually **Samba**, an open-source implementation of SMB [@samba].

- **Port**: modern SMB runs over TCP port 445. Ports 137 to 139 belong to the old NetBIOS transport, which SMB 2 and later don't use, and current Windows versions no longer open them for file sharing by default [@ms-smb-secure-traffic].
- **Versions**: client and server agree on the highest **dialect** both support. SMB 3.1.1 is current on Windows 10 and Windows Server 2016 and later [@ms-smb-overview].
- **Logging in**: the client connects as a user, usually a Windows or domain account, with Kerberos or NTLM [@ms-new-smbmapping].
- **Encryption**: SMB 3.0 and later can encrypt everything on the connection, per share, for a whole server, or when a client maps a drive. It protects data in transit, not on disk [@ms-smb-security].

### Keep port 445 off the internet

In 2017 the WannaCry ransomware spread between machines by connecting to TCP port 445 and exploiting a vulnerability in SMB version 1, and CISA's advice at the time was to block SMB at the network boundary, port 445 and the old NetBIOS ports with it [@cisa-wannacry]. Microsoft gives the same advice today in both directions: block TCP 445 inbound from the internet, and outbound to the internet too, unless a specific cloud service needs it [@ms-smb-secure-traffic]. A file share that has to be reached from somewhere else is reached over a VPN or another private connection ([reaching private resources](/primers/networking/reaching-private-resources/) covers the options), never by opening 445 to the world. Microsoft also says to remove SMB 1.0 wherever it's still installed [@ms-smb-security].

## NFS

NFS is the Unix side's equivalent. A Linux machine **mounts** an **export**, a folder the NFS server shares, into a local folder, and from then on programs use it like any other directory. The line in `/etc/fstab` that mounts one at boot looks like this [@linux-nfs-man]:

```text
nas01.example.com:/exports/reports  /mnt/reports  nfs  defaults  0 0
```

- **Port**: NFS uses TCP port 2049. With NFS version 4 on that standard port, the client doesn't need a separate lookup service to find the server's NFS port, which is what lets it pass through a firewall with a single rule [@rfc7530].
- **Who is the user**: the default security setting, `sec=sys`, sends the user's Unix user and group numbers, and the server trusts the client machine to have checked them [@linux-nfs-man]. That's only reasonable on a network where every machine that can reach the server is trusted.
- **Kerberos**: `sec=krb5` proves each user's identity with Kerberos, `krb5i` also protects every request from tampering, and `krb5p` encrypts the traffic as well [@linux-nfs-man, @rfc7530].

## Which way the connections go

<div class="share-flow" role="img" aria-label="The example's connections. pc01, a Windows PC, opens an SMB connection on TCP port 445 to nas01 and writes report files. pc02, a Linux machine, also opens a connection to nas01, on TCP 445 for SMB or TCP 2049 for NFS, and reads the files. nas01 never opens a connection to either of them.">
<svg viewBox="0 0 400 150" aria-hidden="true" focusable="false">
<defs><marker id="sf-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="sf-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="sf-box" x="30" y="16" width="110" height="40" rx="4"/>
<text class="sf-name" x="85" y="33">pc01</text>
<text class="sf-small" x="85" y="46">Windows, writes</text>
<rect class="sf-box" x="30" y="94" width="110" height="40" rx="4"/>
<text class="sf-name" x="85" y="111">pc02</text>
<text class="sf-small" x="85" y="124">Linux, reads</text>
<rect class="sf-box sf-nas" x="260" y="53" width="110" height="44" rx="4"/>
<text class="sf-name" x="315" y="71">nas01</text>
<text class="sf-small" x="315" y="85">the share</text>
<line class="sf-arrow" x1="141" y1="40" x2="258" y2="68" marker-end="url(#sf-head)"/>
<text class="sf-label" x="200" y="42">SMB 445</text>
<line class="sf-arrow" x1="141" y1="110" x2="258" y2="82" marker-end="url(#sf-head)"/>
<text class="sf-label" x="200" y="114">SMB 445 or</text>
<text class="sf-label" x="200" y="124">NFS 2049</text>
</svg>
</div>

<p class="bitgrid-caption">Arrows point from the machine that opens each connection. Both PCs connect to the NAS, and the NAS never connects to either of them.</p>

Each arrow is one connection, opened by the machine at its tail to a port on the machine at its head, and the replies come back over that same connection. Written out one row per connection:

| From | To | Port | Why |
|---|---|---|---|
| `pc01` | `nas01` | TCP 445 | Write reports over SMB |
| `pc02` | `nas01` | TCP 445, or TCP 2049 for NFS | Read the reports |

The NAS only ever answers. If anything sits between these machines that filters traffic, those two rows are all it needs to allow.

## Checking it from a client

First check that the port is reachable at all, before worrying about permissions. On `pc02`, `nc -z` tries to connect without sending anything [@openbsd-nc]. On Windows, `Test-NetConnection` has a shortcut for the SMB port [@ms-test-netconnection]:

```bash tab="macOS / Linux"
nc -vz nas01.example.com 445
```

```powershell tab="Windows (PowerShell)"
Test-NetConnection nas01.example.com -CommonTCPPort SMB
```

Then mount the share. On Linux, `mount -t cifs` mounts an SMB share and `username=` sets the account [@linux-mount-cifs]. On Windows, `New-SmbMapping` maps it to a drive letter, and `-RequirePrivacy $true` insists on SMB encryption [@ms-new-smbmapping, @ms-smb-security]:

```bash tab="Linux"
sudo mount -t cifs //nas01.example.com/reports /mnt/reports -o username=reader
```

```powershell tab="Windows (PowerShell)"
New-SmbMapping -LocalPath R: -RemotePath \\nas01.example.com\reports -RequirePrivacy $true
```

To see which shares a server offers before mounting anything, `smbclient -L` lists them, with `-U` for the account to ask as [@smbclient-man]:

```bash
smbclient -L nas01.example.com -U reader
```

If the port check fails, the problem is the network path, or something on it blocking the port. If it succeeds and mounting fails, the problem is the account, its permissions on the share, or an encryption or version setting the two ends can't agree on.
