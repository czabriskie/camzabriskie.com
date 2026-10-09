---
title: Kubernetes object size limits
description: 'Why a ConfigMap, a Secret, or a Helm release record fails with "Too long: may not be more than 1048576 bytes", where the 1 MiB cap comes from, and how to get under it.'
order: 0
updated: 2026-10-09
---

A Helm upgrade fails with this message:

```
Error: UPGRADE FAILED: cannot patch "app-settings" with kind ConfigMap:
ConfigMap "app-settings" is invalid: []: Too long: may not be more than 1048576 bytes
```

The number is 1024 x 1024, so the limit is **1 MiB**. The API server rejected the object during validation, which means the problem is the size of the object and not Helm, the pod, or the node.

## The rendered size is the size that counts

Take a chart with a 60 KB values file. A template that loops over 20 entries and embeds a 60 KB block in each one renders to about 1.2 MB, which is over the limit even though nobody edited a large file. Templates multiply their input, so measure the rendered object. This renders only the suspect template to a file you can size:

```sh
helm template ./chart -f values.yaml --show-only templates/settings-configmap.yaml > out.yaml
```

Then compare the size of `out.yaml` with 1,048,576 bytes.

## Which objects share the limit

| Object | Limit | Note |
|---|---|---|
| ConfigMap | 1 MiB of data [@k8s-configmap] | The docs suggest a mounted volume, a database, or a file service for larger settings [@k8s-configmap] |
| Secret | 1 MiB each [@k8s-secret] | Moving a big blob from a ConfigMap to a Secret changes nothing |
| Helm release record | Stored in a Secret by default [@helm-storage-backends] | Holds chart and values content, so it shares the 1 MiB cap |
| etcd request | 1.5 MiB by default [@etcd-limits] | The ceiling the 1 MiB API limit sits under |
| etcd storage | 2 GiB by default, 8 GiB suggested maximum [@etcd-limits] | Many medium objects can still fill it |

> **Formula:** 1 MiB = 1,048,576 bytes = 2^20. ConfigMap, Secret, and the Helm release record share it, so a rendered object near that size needs a different shape and not a different kind of object.

## The same limit, a second way

Helm saves a record of every release, and by default that record is a Secret holding the chart and values content [@helm-storage-backends]. A chart can therefore render fine and still fail at the end when Helm tries to store its own record. The error then names a Secret instead of a ConfigMap. Helm documents a beta `sql` storage backend for release information that weighs more than 1 MB [@helm-storage-backends].

## Ways to get under the limit

| Option | Fits when | Cost |
|---|---|---|
| Split into several ConfigMaps | The content separates cleanly, such as per component | More objects, each mounted separately |
| Mount a volume or object store | The data is large reference data and not configuration | A storage dependency and a loading step |
| Fetch at startup | The data changes independently of deploys | Pods depend on that source to start |
| Shrink the template | A loop repeats a large block | Often the cheapest fix, so look here first |
| Move to a Secret | Never, for size | Same cap |

Start with the template. If the rendered output holds the same block many times, include it once and reference it, and the object may drop well under the limit with no architecture change.
