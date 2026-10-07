---
title: EBS vs EFS, and choosing storage on AWS
description: What an EBS volume is, why it lives in one availability zone, how to grow it, and when a shared filesystem like EFS is the wrong choice, using a Prometheus database as the worked example.
order: 0
updated: 2026-10-07
---

A server needs somewhere to keep data that outlives a restart. On AWS the two common answers are EBS and EFS, and they behave very differently. The easiest way to see the difference is a concrete case: a Prometheus server (a metrics database) that needs a disk.

## The worked example

Prometheus writes its time series database to a local directory. Its documentation says that storage is "not clustered or replicated" and should be managed like any other single-node database [@prometheus-storage]. It also says NFS filesystems, "including AWS's EFS", are not supported for that directory, because non-POSIX-compliant filesystems risk unrecoverable corruption [@prometheus-storage].

So the guidance is EBS, and EFS is ruled out. The rest of this note explains why that follows from how each service works.

## EBS: a disk that plugs into one instance

An EBS (Elastic Block Store) volume is a virtual hard drive. You attach it to an EC2 instance, format it with a filesystem, and the instance treats it as a local disk. Three properties matter:

- **One availability zone.** A volume attaches only to an instance in the same availability zone as the volume [@aws-ebs-volume-lifecycle]. A replacement volume restored from a snapshot must also be created in the same zone as the instance [@aws-ebs-restore-volume]. To move data to another zone, take a snapshot and restore it there.
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

That sharing is the point of EFS, and it is also why it suits a different set of jobs. Every read and write crosses the network, and NFS semantics differ from a local disk. Software that assumes a local POSIX disk, such as a database engine, can misbehave. Prometheus documents exactly that risk [@prometheus-storage].

## Choosing between them

| Need | Pick | Why |
|---|---|---|
| Database or any single-writer app that assumes a local disk | EBS | Low latency, full POSIX behavior |
| Files shared by many instances or pods at once | EFS | Multi-mount, multi-zone |
| Scratch data that can vanish with the instance | Instance store | Fastest, but lost when the instance stops |
| Backups, archives, long-term data | S3 | Cheap, durable object storage |

Instance store and S3 rows are general AWS knowledge and were not checked against the docs for this note.

## Surviving the one-zone limit

Because a single EBS volume is bound to one zone, a Prometheus server on EBS is exactly as available as that zone and that volume. Three common mitigations:

1. **Accept it.** If losing recent history is fine, a new server in the same zone starts empty or from a snapshot.
2. **Snapshot regularly.** Prometheus recommends its snapshot API for backups, because a plain file copy can miss data still in the write-ahead log [@prometheus-storage].
3. **Ship data elsewhere.** Prometheus supports remote write to external storage for durability beyond one node [@prometheus-storage].

## Sizing the disk

Prometheus gives a planning formula [@prometheus-storage]:

```
needed_disk_space = retention_time_seconds * ingested_samples_per_second * bytes_per_sample
```

At roughly 1 to 2 bytes per sample, retention defaults to 15 days. Set the size-based retention limit to at most 80 to 85 percent of the disk, since compaction temporarily needs extra room [@prometheus-storage]. Because the volume can grow later, starting smaller and resizing is a safe approach.

## Summary

| Question | Answer |
|---|---|
| Is EBS tied to one availability zone? | Yes |
| Can an EBS volume be enlarged? | Yes, online. It cannot be shrunk. |
| Does Prometheus support EFS? | No, it documents NFS (including EFS) as unsupported |
| Where does shared storage belong? | EFS, for workloads built for network filesystems |
