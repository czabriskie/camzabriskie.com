---
title: EBS vs EFS, and choosing storage on AWS
description: What an EBS volume is, why it lives in one availability zone, how to grow it, what EFS does differently, why databases usually want EBS, and which kind of storage fits which job.
order: 0
updated: 2026-10-08
only: AWS
---

A server needs somewhere to keep data that outlives a restart. On AWS the two common answers are EBS and EFS, and they behave very differently. EBS is a disk that plugs into one machine. EFS is a folder that many machines share over the network.

## Three kinds of storage

Storage on AWS comes in three shapes, and each service is one of them.

| Kind | What you get | Who runs the filesystem | On AWS |
|---|---|---|---|
| **Block** | A raw disk. Your operating system formats it with a filesystem and treats it like a drive inside the machine. | Your operating system | EBS, instance store |
| **File** | Folders and files, reached over the network. Many machines can use the same folders at once. | The storage service | EFS |
| **Object** | Whole files stored and fetched by name (a **key**) over HTTP | Nobody, there isn't one | S3 |

Object storage is the odd one out. An S3 bucket has a flat structure instead of a hierarchy of folders, and the "folders" the S3 console shows are just shared prefixes in the key names [@aws-s3-folders]. You don't edit part of an object either. Writing to an existing key replaces that object as a whole [@aws-s3-welcome]. That makes S3 great for backups and archives and a poor fit for anything that expects a disk.

## EBS: a disk that plugs into one instance

An EBS (Elastic Block Store) volume is a virtual hard drive. "Elastic" is AWS's naming for things you can resize and reconfigure on demand, and "volume" is just the word for one of these disks. You attach a volume to an EC2 instance (a virtual server running on AWS), format it with a filesystem, and **mount** it, which means connecting the filesystem to a folder path such as `/data` so its files show up there. From then on the instance treats it as a local disk. Three properties matter:

- **One availability zone.** AWS splits the world into **regions**, which are separate geographic areas, and each region into **availability zones**, which are isolated locations inside that region [@aws-ec2-regions-zones]. A volume attaches only to an instance in the same availability zone as the volume [@aws-ebs-volume-lifecycle]. A replacement volume restored from a snapshot must also be created in the same zone as the instance [@aws-ebs-restore-volume]. A **snapshot** is a point-in-time copy of a volume's blocks, kept by AWS in S3 rather than in the zone, and it can be restored as a new volume in any zone in the region [@aws-ebs-snapshots], which is how data moves between zones.
- **Normally one instance at a time.** Multi-Attach lets one volume attach to up to 16 instances, but only for the Provisioned IOPS SSD types (`io1` and `io2`, where you pay for a set level of performance), only within one zone, and ordinary filesystems such as XFS and ext4 aren't built for it. AWS says to use a clustered filesystem, one designed to coordinate several machines writing to the same disk [@aws-ebs-multi-attach].
- **Block-level.** The instance's operating system runs the filesystem, so the volume behaves like a local disk. That matters because of **POSIX**, the standard that describes how Unix-like systems behave, filesystems included. Databases lean on three parts of it: **file locks**, which let one process claim a file so another can't write to it at the same time; **fsync**, a call that doesn't return until the data has actually reached the disk rather than sitting in memory; and **atomic rename**, where renaming a file happens all at once, so a reader sees either the old file or the new one and never half of each.

## Growing an EBS volume

An EBS volume can be grown in place. Elastic Volumes lets you increase the size, change the volume type, and change IOPS or throughput without detaching the volume [@aws-ebs-modify-volume]. **IOPS** is how many separate reads and writes the disk handles each second, and **throughput** is how many bytes per second it moves. A database doing lots of small random reads cares about the first, and a job streaming big files cares about the second.

| Operation | Allowed? |
|---|---|
| Increase size | Yes, while in use |
| Change type or performance | Yes, within the limits of the target type |
| Decrease size | No. Create a smaller volume and copy the data over (for example with `rsync`) |
| Cancel a modification once submitted | No |
| Modify again right away | Only after the last modification finishes, and at most four times in a rolling 24 hours |

All of those come from AWS's Elastic Volumes documentation [@aws-ebs-modify-volume]. A modification on a large volume can take hours. AWS says a 1 TiB volume typically takes up to six hours, and that a larger volume can sometimes finish faster than a smaller one [@aws-ebs-modify-volume].

### A worked resize

Say a 100 GiB volume mounted at `/data` is filling up and should become 200 GiB. Growing it is two jobs. AWS grows the disk, and then you grow the partition and filesystem on it, because the operating system won't use the new space until you do.

First, ask AWS for the bigger size and watch the modification [@aws-ebs-request-modification] [@aws-ebs-monitor-modification]:

```bash
aws ec2 modify-volume --volume-id vol-0123456789abcdef0 --size 200
aws ec2 describe-volumes-modifications --volume-ids vol-0123456789abcdef0
```

These two run the same from any machine with the AWS CLI set up, Windows included, since they're one line each.

The modification moves through `modifying`, `optimizing`, and `completed` [@aws-ebs-monitor-modification]. The new size is usable once it reaches `optimizing`, which usually takes a few seconds [@aws-ebs-modify-volume], and AWS suggests taking a snapshot first in case you need to roll back [@aws-ebs-extend-filesystem].

Then, on the instance, extend the partition and the filesystem. These are Linux commands, and the device names depend on the instance, so check `lsblk` before running anything:

```bash
sudo lsblk
# NAME          SIZE TYPE MOUNTPOINT
# nvme1n1       200G disk              <- the disk already shows the new size
# └─nvme1n1p1   100G part /data        <- the partition doesn't yet

sudo growpart /dev/nvme1n1 1     # grow partition 1 (note the space before the 1)

df -hT /data                     # shows the filesystem type, ext4 or xfs
sudo resize2fs /dev/nvme1n1p1    # ext4: give it the device
sudo xfs_growfs -d /data         # XFS: give it the mount point instead
```

Run only the filesystem command that matches the type `df -hT` reports. If the volume has no partition (the `lsblk` output shows the filesystem right on the disk, with no `p1` line), skip `growpart` and go straight to the filesystem step. All of this is from AWS's guide to extending the filesystem, which also covers Windows [@aws-ebs-extend-filesystem]. The new size also can't exceed what the filesystem and partitioning scheme support [@aws-ebs-modify-volume].

> **Rule of thumb:** EBS volumes only grow. To shrink one, make a new smaller volume and copy the data over.

## Living with the one-zone limit

Because a volume lives in one availability zone, anything on it is only as available as that zone and that volume. The usual answers:

1. **Accept it,** when losing recent data or a short outage is fine.
2. **Snapshot regularly.** A snapshot is stored separately from the volume and can be restored as a new volume in any zone in the region [@aws-ebs-snapshots].
3. **Copy the data somewhere else,** using the application's own replication or export, so a second copy exists outside that zone.

[Where Prometheus keeps its data](/primers/observability/prometheus-storage/) works through these choices for one real system.

## EFS: a shared network filesystem

EFS (Elastic File System) is NFS as a service. NFS (Network File System) is a long-standing protocol for using a filesystem that lives on another machine, over the network. Many instances mount the same EFS filesystem at the same time, and a Regional filesystem stores data redundantly across multiple availability zones [@aws-efs-how-it-works]. Instances reach it through **mount targets**, network endpoints you create one per zone, and any instance in that zone can use its zone's mount target [@aws-efs-mount-targets]. A One Zone variant keeps data in a single zone, which can lose data if that zone is damaged [@aws-efs-how-it-works], and it gets only one mount target, in its own zone [@aws-efs-mount-targets].

<div class="stg-zones" role="img" aria-label="One region with two availability zones, a and b. In zone a, instance A has an EBS volume attached. Instance B in zone b can't attach that volume, shown by a crossed-out dashed line. The volume's snapshot sits outside both zones and is restored as a new EBS volume in zone b, which instance B attaches. Below, both instances mount the same Regional EFS file system, each through the mount target in its own zone.">
<svg viewBox="0 0 400 292" aria-hidden="true" focusable="false">
<rect class="stg-region" x="2" y="2" width="396" height="288" rx="8"/>
<text class="stg-label" x="12" y="16">region</text>
<rect class="stg-zone" x="10" y="22" width="160" height="190" rx="6"/>
<rect class="stg-zone" x="230" y="22" width="160" height="190" rx="6"/>
<text class="stg-label stg-mid" x="90" y="36">availability zone a</text>
<text class="stg-label stg-mid" x="310" y="36">availability zone b</text>
<line class="stg-attach" x1="105" y1="78" x2="105" y2="104"/>
<line class="stg-attach" x1="295" y1="78" x2="295" y2="104"/>
<line class="stg-mount" x1="35" y1="78" x2="35" y2="168"/>
<line class="stg-mount" x1="365" y1="78" x2="365" y2="168"/>
<line class="stg-mount" x1="85" y1="196" x2="85" y2="236"/>
<line class="stg-mount" x1="315" y1="196" x2="315" y2="236"/>
<line class="stg-no" x1="250" y1="72" x2="150" y2="104"/>
<circle class="stg-x-ring" cx="200" cy="88" r="7"/>
<path class="stg-x" d="M196 84 L204 92 M204 84 L196 92"/>
<line class="stg-copy" x1="150" y1="121" x2="168" y2="121"/>
<polygon class="stg-arrow" points="172,121 166,118 166,124"/>
<line class="stg-copy" x1="228" y1="121" x2="246" y2="121"/>
<polygon class="stg-arrow" points="250,121 244,118 244,124"/>
<g class="stg-box"><rect x="20" y="44" width="130" height="34" rx="6"/><text class="stg-kind" x="85" y="58">EC2 instance</text><text class="stg-name" x="85" y="71">A</text></g>
<g class="stg-box"><rect x="250" y="44" width="130" height="34" rx="6"/><text class="stg-kind" x="315" y="58">EC2 instance</text><text class="stg-name" x="315" y="71">B</text></g>
<g class="stg-box stg-ebs"><rect x="60" y="104" width="90" height="34" rx="6"/><text class="stg-kind" x="105" y="118">EBS volume</text><text class="stg-name" x="105" y="131">attached to A</text></g>
<g class="stg-box stg-ebs"><rect x="250" y="104" width="90" height="34" rx="6"/><text class="stg-kind" x="295" y="118">EBS volume</text><text class="stg-name" x="295" y="131">restored</text></g>
<g class="stg-box stg-snap"><rect x="172" y="104" width="56" height="34" rx="6"/><text class="stg-kind" x="200" y="118">EBS</text><text class="stg-name" x="200" y="131">snapshot</text></g>
<text class="stg-label" x="40" y="128">NFS</text>
<text class="stg-label stg-end" x="360" y="160">NFS</text>
<g class="stg-box stg-efs"><rect x="20" y="168" width="130" height="28" rx="6"/><text class="stg-name" x="85" y="186">EFS mount target</text></g>
<g class="stg-box stg-efs"><rect x="250" y="168" width="130" height="28" rx="6"/><text class="stg-name" x="315" y="186">EFS mount target</text></g>
<g class="stg-box stg-efs"><rect x="20" y="236" width="360" height="40" rx="6"/><text class="stg-kind" x="200" y="252">EFS file system (Regional)</text><text class="stg-name" x="200" y="267">one copy of the files, stored across zones</text></g>
</svg>
</div>

<p class="bitgrid-caption">An EBS volume belongs to one zone, so instance B can't attach the volume in zone a. Its snapshot lives outside the zone and comes back as a new volume in zone b. EFS is one file system both instances mount at the same time, each through its own zone's mount target.</p>

That sharing is the point of EFS. It also means every read and write crosses the network, and a network filesystem doesn't always behave exactly like a local disk.

## Databases and network filesystems

Databases are where that difference matters most. A database counts on the filesystem to lock files properly and to really have saved data when it says it has, and network filesystems don't always deliver either one the way a local disk does:

- SQLite's documentation warns that file locking on network filesystems, NFS in particular, doesn't always work as advertised, and that broken locking can corrupt a database [@sqlite-howtocorrupt].
- PostgreSQL can keep its data on NFS, but only with specific mount and export settings, and it points out that storage that appears as a block device avoids NFS's quirks altogether [@postgresql-nfs].
- Some software rules NFS out completely. [Prometheus](/primers/observability/prometheus-storage/) is one example.

So for a database, the default is EBS, and EFS is for files that several machines genuinely need to share.

## Choosing between them

| Need | Pick | Why |
|---|---|---|
| A database or any single-writer app that assumes a local disk | EBS | A real block device, so locking and saving behave like a local disk |
| Files shared by many instances or pods at once | EFS | Many machines mount it at once, and a Regional filesystem spans several zones [@aws-efs-how-it-works] |
| Scratch data that can vanish with the instance | Instance store | Disks physically attached to the host. Fast, but the data is gone once the instance stops, hibernates, or terminates [@aws-ec2-instance-store] |
| Backups, archives, long-term data | S3 | Object storage rather than a disk, designed for 99.999999999% durability [@aws-s3-durability] |

## On Kubernetes

The same choices show up in Kubernetes under different names.

- A **PersistentVolumeClaim** is a pod's request for storage, with a size and an access mode, which Kubernetes fills with a volume such as an EBS disk [@k8s-persistent-volumes].
- A **StorageClass** describes a kind of storage the cluster offers, and setting its `allowVolumeExpansion` to `true` lets you grow a volume by editing the claim to ask for more, though never to shrink it [@k8s-storage-classes].
- `volumeBindingMode: WaitForFirstConsumer` on the StorageClass holds off creating the volume until a pod using the claim exists, so the volume is made in the zone where that pod is scheduled instead of a zone the pod can't reach [@k8s-storage-classes].

## Summary

| Question | Answer |
|---|---|
| Is EBS tied to one availability zone? | Yes, though its snapshots can be restored in any zone in the region |
| Can an EBS volume be enlarged? | Yes, online. It can't be shrunk. |
| Should a database go on EFS? | Usually not. Check the database's own documentation first. |
| Where does shared storage belong? | EFS, for workloads built for a network filesystem |
