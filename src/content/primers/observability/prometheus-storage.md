---
title: Where Prometheus keeps its data
description: Prometheus stores its metrics in a single-node database on a local disk. Why that disk should be EBS and not EFS, how big to make it, and what to do about the one-zone limit.
order: 0
updated: 2026-10-07
---

Prometheus collects metrics from the systems it watches and stores them as time series: a value, the time it was recorded, and some labels describing where it came from [@prometheus-overview]. All of that lands in a database on a local disk, and choosing and sizing that disk is one of the first real decisions when running it.

## A single-node database

Prometheus writes its time series database to a local directory. Its documentation says that local storage is "not clustered or replicated", so it isn't durable against a drive or machine failing, and should be managed like any other single-node database [@prometheus-storage]. One server, one disk, and that disk is the data.

## Why EBS and not EFS

Prometheus's documentation rules out NFS filesystems, "including AWS's EFS", for that directory, because filesystems that aren't fully POSIX-compliant can cause unrecoverable corruption, and it recommends a local filesystem [@prometheus-storage]. That's the general [databases and network filesystems](/primers/storage/ebs-vs-efs/#databases-and-network-filesystems) problem applied to one database.

On AWS, that means an EBS volume, which also brings EBS's limits: the volume lives in one availability zone, and it can grow but not shrink ([EBS vs EFS](/primers/storage/ebs-vs-efs/) covers both).

## Sizing the disk

Prometheus gives a planning formula [@prometheus-storage]:

```
needed_disk_space = retention_time_seconds * ingested_samples_per_second * bytes_per_sample
```

Samples take about 1 to 2 bytes each once stored, and data is kept for 15 days by default [@prometheus-storage]. As a worked example, a server taking in 100,000 samples a second, keeping 15 days (1,296,000 seconds) at 2 bytes a sample, needs about 1,296,000 × 100,000 × 2 = 259 billion bytes, roughly 260 GB.

Leave headroom on top of that. Prometheus recommends setting its size-based retention limit to at most 80 to 85 percent of the disk, because compaction temporarily needs extra room [@prometheus-storage]. Since an EBS volume [can grow while in use](/primers/storage/ebs-vs-efs/#growing-an-ebs-volume), starting smaller and resizing later is safe.

## Surviving the one-zone limit

Because the data sits on one EBS volume in one zone, the Prometheus server is only as available as that zone and that volume. Three common ways to handle it:

1. **Accept it.** If losing recent history is fine, a replacement server starts empty or from a snapshot.
2. **Snapshot regularly.** Prometheus recommends its own snapshot API for backups, because a plain copy of the files can miss data still sitting in the write-ahead log [@prometheus-storage].
3. **Ship data elsewhere.** Prometheus can send its data to external storage with remote write, for durability beyond one machine [@prometheus-storage].

## Summary

| Question | Answer |
|---|---|
| Where does Prometheus store data? | In a single-node database on a local disk |
| Can that disk be EFS? | No. Prometheus documents NFS, including EFS, as unsupported. |
| How big should it be? | Retention × samples per second × about 2 bytes, plus 15 to 20 percent headroom |
| How do I protect the data? | Snapshots through Prometheus's API, or remote write to external storage |
