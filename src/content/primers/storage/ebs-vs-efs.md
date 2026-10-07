---
title: EBS vs EFS, and choosing storage on AWS
description: What an EBS volume is, why it lives in one availability zone, how to grow it, what EFS does differently, why databases usually want EBS, and which kind of storage fits which job.
order: 0
updated: 2026-10-07
---

A server needs somewhere to keep data that outlives a restart. On AWS the two common answers are EBS and EFS, and they behave very differently. EBS is a disk that plugs into one machine. EFS is a folder that many machines share over the network.

## EBS: a disk that plugs into one instance

An EBS (Elastic Block Store) volume is a virtual hard drive. You attach it to an EC2 instance, format it with a filesystem, and the instance treats it as a local disk. Three properties matter:

- **One availability zone.** A volume attaches only to an instance in the same availability zone as the volume [@aws-ebs-volume-lifecycle]. A replacement volume restored from a snapshot must also be created in the same zone as the instance [@aws-ebs-restore-volume]. To move data to another zone, take a snapshot and restore it there, since a snapshot can be restored as a new volume in any zone in the region [@aws-ebs-snapshots].
- **Normally one instance at a time.** Multi-Attach exists for `io1` and `io2` volumes, but it is a specialist feature with extra rules.
- **Block-level.** The operating system owns the filesystem, so ordinary POSIX behavior (locking, fsync, atomic renames) works the way databases expect.

## Growing an EBS volume

An EBS volume can be grown in place. Elastic Volumes lets you increase the size, change the volume type, and change IOPS or throughput without detaching the volume [@aws-ebs-modify-volume].

| Operation | Allowed? |
|---|---|
| Increase size | Yes, while in use |
| Change type or performance | Yes, within the limits of the target type |
| Decrease size | No. Create a smaller volume and copy the data over (for example with `rsync`) |
| Cancel a modification once submitted | No |

After the volume grows, the partition and filesystem still have to be extended, and the new size cannot exceed what the filesystem supports [@aws-ebs-modify-volume]. A modification can take hours on a large volume, because the time does not scale linearly with size [@aws-ebs-modify-volume].

> **Rule of thumb:** EBS volumes only grow. If a database needs more space, resize the volume and the filesystem. Swapping the database out is only needed to shrink one.

On Kubernetes, the same idea appears as a PersistentVolumeClaim whose StorageClass allows expansion, plus volume binding that waits for the pod to be scheduled so the volume is created in the zone where the pod lands.

## EFS: a shared network filesystem

EFS (Elastic File System) is NFS as a service. Many instances mount the same filesystem at the same time, and a Regional filesystem stores data redundantly across multiple availability zones [@aws-efs-how-it-works]. A One Zone variant keeps data in a single zone, which can lose data if that zone is damaged [@aws-efs-how-it-works].

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

## Living with the one-zone limit

Because a volume lives in one availability zone, anything on it is only as available as that zone and that volume. The usual answers:

1. **Accept it,** when losing recent data or a short outage is fine.
2. **Snapshot regularly.** A snapshot is stored separately from the volume and can be restored as a new volume in any zone in the region [@aws-ebs-snapshots].
3. **Copy the data somewhere else,** using the application's own replication or export, so a second copy exists outside that zone.

[Where Prometheus keeps its data](/primers/observability/prometheus-storage/) works through these choices for one real system.

## Summary

| Question | Answer |
|---|---|
| Is EBS tied to one availability zone? | Yes, though its snapshots can be restored in any zone in the region |
| Can an EBS volume be enlarged? | Yes, online. It can't be shrunk. |
| Should a database go on EFS? | Usually not. Check the database's own documentation first. |
| Where does shared storage belong? | EFS, for workloads built for a network filesystem |
