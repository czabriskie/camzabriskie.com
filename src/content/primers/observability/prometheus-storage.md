---
title: Where Prometheus keeps its data
description: Prometheus stores its metrics in a single-node database on a local disk. What's in that database, why the disk should be EBS and not EFS, how big to make it, and what to do about the one-zone limit.
order: 0
updated: 2026-10-08
---

Metrics are numbers that systems report about themselves over time, like how many requests a server has handled or how full a disk is, and observability is the practice of collecting them so you can see what a system is doing and get alerted when it goes wrong. Prometheus collects metrics from the systems it watches and stores them as time series: a value, the time it was recorded, and some labels describing where it came from [@prometheus-overview]. All of that lands in a database on a local disk, and choosing and sizing that disk is one of the first real decisions when running it.

## What's on the disk

Prometheus gets its data by **scraping**: on a fixed interval it fetches a page of current numbers over HTTP from each system it watches [@prometheus-overview]. The interval is yours to set. The default is one minute [@prometheus-configuration], and Prometheus's own getting-started guide uses 15 seconds [@prometheus-getting-started]. Each thing it scrapes is a **target**, and every scrape brings back the current value of every series that target exposes.

One series looks like this:

```
http_requests_total{job="api", method="GET"}   1027 @ 2026-10-07T12:00:00Z
```

- `http_requests_total` is the **metric name**, which says what is being measured [@prometheus-data-model].
- `job="api"` and `method="GET"` are **labels**, key-value pairs that tell one series of a metric apart from another. The same metric with `method="POST"` is a different series [@prometheus-data-model].
- A **time series** (or just **series**) is one metric name plus one exact set of labels, tracked over time [@prometheus-data-model].
- `1027 @ 2026-10-07T12:00:00Z` is one **sample**: a value and a millisecond-precision timestamp [@prometheus-data-model]. Fifteen seconds later the next scrape adds another sample to the same series, maybe `1034`.

Prometheus stores all of this in its **TSDB** (time series database), a database built into Prometheus that keeps its files in a local data directory [@prometheus-storage]. The directory looks something like this (trimmed from Prometheus's documentation) [@prometheus-storage]:

```
./data
├── 01BKGTZQ1SYQJTR4PB43C8PD98     <- a block: two hours (or more) of samples
│   ├── chunks
│   │   └── 000001                 <- the samples themselves
│   ├── tombstones                 <- records of deleted series, applied later
│   ├── index                      <- maps metric names and labels to series in chunks
│   └── meta.json                  <- metadata about the block
├── 01BKGV7JC0RY8A6MACW02A2PJD     <- another block
│   └── ...
├── chunks_head                    <- head chunks already written out to disk
│   └── 000001
└── wal                            <- the write-ahead log
    ├── 000000002
    └── checkpoint.00000001
        └── 00000000
```

New samples land in the **head**, the current block, which Prometheus keeps in memory [@prometheus-storage]. Memory is lost in a crash, so each sample is also written to the **write-ahead log** (WAL), a file on disk that records changes before they're stored for good. If the server restarts, Prometheus replays the WAL to rebuild the head [@prometheus-storage]. Samples are grouped into two-hour blocks, so about every two hours the head is written out as a new block directory [@prometheus-storage].

In the background, **compaction** merges those two-hour blocks into longer ones, spanning up to 10% of the retention time or 31 days, whichever is smaller. The old blocks and the new merged block have to sit on disk side by side until the old ones are removed, so disk use briefly goes up during each compaction [@prometheus-storage]. That brief bump sets how much room to leave free when sizing the disk.

```
scrape ──▶ head (in memory) ──── every sample also written to ───▶ wal/
               │
               │ about every 2 hours
               ▼
          2-hour block ─┐
          2-hour block ─┼──▶ compaction ──▶ one longer block
          2-hour block ─┘     (old and new on disk at once, briefly)
```

## A single-node database

Prometheus runs on one machine, with no built-in copy of its data anywhere else. Its documentation says that local storage is "not clustered or replicated", so it isn't durable against a drive or machine failing, and should be managed like any other single-node database [@prometheus-storage]. One server, one disk, and that disk is the data.

## Why EBS and not EFS {only: AWS}

Prometheus's documentation rules out NFS filesystems, "including AWS's EFS", for that directory, because filesystems that aren't fully POSIX-compliant can cause unrecoverable corruption, and it recommends a local filesystem [@prometheus-storage]. That's the general [databases and network filesystems](/primers/storage/ebs-vs-efs/#databases-and-network-filesystems) problem applied to one database.

On AWS, that means an EBS volume, which also brings EBS's limits: the volume lives in one availability zone, and it can grow but not shrink ([EBS vs EFS](/primers/storage/ebs-vs-efs/) covers both).

## Sizing the disk

Prometheus gives a planning formula [@prometheus-storage]:

```
needed_disk_space = retention_time_seconds * ingested_samples_per_second * bytes_per_sample
```

Samples take about 1 to 2 bytes each once stored, and data is kept for 15 days by default [@prometheus-storage].

### Samples per second

Every series gets one new sample per scrape, so the ingest rate is the number of series divided by the scrape interval. A server scraping 500 targets that expose 3,000 series each, every 15 seconds, is tracking 500 × 3,000 = 1,500,000 series and taking in 1,500,000 ÷ 15 = 100,000 samples a second.

On a server that's already running, you can measure it instead of estimating. Prometheus counts every sample it appends in a metric called `prometheus_tsdb_head_samples_appended_total` [@prometheus-tsdb-head-source], and if Prometheus scrapes itself, as the getting-started setup does [@prometheus-getting-started], this query gives the current rate:

```
sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))
```

`rate()` turns a counter that only goes up into a per-second average over the window, here the last five minutes [@prometheus-functions], and `sum` adds up the counter's separate series (the counter is split by a `type` label).

### Putting it together

At 100,000 samples a second, keeping 15 days (1,296,000 seconds) at 2 bytes a sample, the data needs about 1,296,000 × 100,000 × 2 = 259 billion bytes, roughly 260 GB.

The disk has to be bigger than that. Prometheus recommends setting its size-based retention limit to at most 80 to 85 percent of the disk, leaving the rest for compaction's temporary extra room [@prometheus-storage]. Working backward, if the data fills 80% of the disk, the disk is 260 ÷ 0.8 ≈ 325 GB, so about **a 330 GB volume**. Keeping retention at 80 to 85 percent means the disk is roughly 18 to 25 percent bigger than the data, not 15 to 20.

Prometheus has two retention limits. **Time-based retention** deletes data older than a set age, and **size-based retention** deletes the oldest blocks once the stored data passes a set size. If both are set, whichever triggers first wins [@prometheus-storage]. Set the time limit to what you want and the size limit as a backstop, so a sudden jump in series can't fill the disk:

```yaml
# prometheus.yml
storage:
  tsdb:
    retention:
      time: 15d
      size: 260GB
```

Recent versions of Prometheus take these from the configuration file [@prometheus-configuration] and mark the older command-line flags, `--storage.tsdb.retention.time=15d` and `--storage.tsdb.retention.size=260GB`, as deprecated [@prometheus-cli]. Older versions only have the flags. Either way, Prometheus counts sizes in powers of two, so `260GB` means 260 × 1024³ bytes [@prometheus-storage], and EBS sizes are in GiB too, so 260 out of a 330 GiB volume is about 79%. The size limit counts the WAL and `chunks_head` as well as the blocks, but only blocks get deleted to stay under it [@prometheus-storage].

Since an EBS volume [can grow while in use](/primers/storage/ebs-vs-efs/#growing-an-ebs-volume), starting smaller and resizing later is safe. Raise the size limit after you grow the disk.

## Surviving the one-zone limit

Because the data sits on one EBS volume in one zone, the Prometheus server is only as available as that zone and that volume. [Living with the one-zone limit](/primers/storage/ebs-vs-efs/#living-with-the-one-zone-limit) covers the general options. Three parts are specific to Prometheus.

### TSDB snapshots, then copy them off

Two different things get called a snapshot here. An **EBS snapshot** is AWS's copy of the whole volume. A **TSDB snapshot** is Prometheus's own copy of its data, and Prometheus recommends it for backups because a plain copy of the files can miss data still sitting in the WAL [@prometheus-storage]. You ask for one over Prometheus's admin API, which is off unless Prometheus was started with `--web.enable-admin-api` [@prometheus-http-api]:

```bash tab="macOS / Linux"
curl -XPOST http://localhost:9090/api/v1/admin/tsdb/snapshot
```

```powershell tab="Windows (PowerShell)"
curl.exe -XPOST http://localhost:9090/api/v1/admin/tsdb/snapshot
```

Prometheus answers with a name such as `20171210T211224Z-2be650b6d019eb54` and writes the snapshot to `snapshots/<that name>` inside its data directory [@prometheus-http-api]. That's on the same EBS volume, so on its own it doesn't survive losing the zone or the volume. It has to leave the box, either in an EBS snapshot of the volume or copied somewhere like S3, for example from the Prometheus server:

```bash
aws s3 sync ./data/snapshots/20171210T211224Z-2be650b6d019eb54 \
  s3://amzn-s3-demo-bucket/prometheus/20171210T211224Z-2be650b6d019eb54
```

### What starting empty costs

If you accept the risk and a replacement server starts with an empty disk, it scrapes normally from the first minute, but everything that looks back in time is short of history:

- Dashboards show a gap for everything before the new server started.
- A `rate()` over a long window, like `[1h]`, works from however many minutes of data exist, so for the first hour it's averaging a much shorter stretch than it says [@prometheus-functions].
- An alert with a `for:` clause only fires once its condition has held for that long [@prometheus-alerting-rules]. Prometheus records alert state as series in its own database [@prometheus-alerting-rules], so on an empty server every alert starts that wait from zero, and alerts built on long windows can fire or stay quiet for the wrong reasons until enough data builds up.

### Remote write

Remote write has Prometheus stream every sample it takes in to another system as well as storing it locally [@prometheus-storage]. That other system can be long-term storage such as Thanos or Grafana Mimir [@prometheus-integrations], or a managed service like Amazon Managed Service for Prometheus, which replicates the data it receives across three availability zones [@aws-amp-what-is]. The samples are read from the WAL and sent from there [@prometheus-remote-write-tuning], so the local disk still matters, and it still holds the WAL and recent data. History lives in the remote system, though, so the local disk can be sized for hours or days of retention instead of weeks. If the remote end stays down for more than two hours, samples it never received are lost once the WAL is compacted [@prometheus-remote-write-tuning].

## Summary

| Question | Answer |
|---|---|
| Where does Prometheus store data? | In a single-node database on a local disk: blocks, the in-memory head, and the WAL |
| Can that disk be EFS? | No. Prometheus documents NFS, including EFS, as unsupported. |
| How big should it be? | Retention × samples per second × about 2 bytes, with that data filling at most 80 to 85 percent of the disk (so the disk is about 18 to 25 percent bigger than the data) |
| How do I protect the data? | TSDB snapshots copied off the volume, EBS snapshots, or remote write to external storage |
