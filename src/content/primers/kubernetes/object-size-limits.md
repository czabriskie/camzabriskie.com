---
title: Kubernetes object size limits
description: 'Why a ConfigMap, a Secret, or a Helm release record fails with "Too long: may not be more than 1048576 bytes", where the 1 MiB cap comes from, and how to get under it.'
order: 0
updated: 2026-10-09
---

A Helm upgrade fails with this message:

```text
Error: UPGRADE FAILED: cannot patch "app-settings" with kind ConfigMap:
ConfigMap "app-settings" is invalid: []: Too long: may not be more than 1048576 bytes
```

1,048,576 is 1024 × 1024, so the limit is **1 MiB**. Kubernetes refused to store the object because it's too big. Nothing is wrong with Helm, the pod, or the node, and retrying won't help. The object has to get smaller.

## A few terms

- **Object**: a record stored in a Kubernetes cluster that describes something that should exist, such as a running app, a group of settings, or a password. Objects are usually written as YAML files.
- **API server**: the part of Kubernetes that every change goes through [@k8s-components]. It checks each object before saving it, and the error above comes from that check.
- **etcd**: the database where the API server keeps every object [@k8s-components].
- **ConfigMap**: an object that holds settings as keys and values, for an app to read as environment variables or files. It isn't meant for large data, and its data can't exceed 1 MiB [@k8s-configmap].
- **Secret**: the same idea for sensitive values like passwords and keys, with the same 1 MiB limit [@k8s-secret].
- **Helm**: a tool that installs apps into Kubernetes from a **chart**, a package of templates for all the objects an app needs [@helm-intro]. A **values file** (usually `values.yaml`) fills in the templates. A **release** is one installed copy of a chart, and every install, upgrade, or rollback adds a new **revision** of it [@helm-intro, @helm-using].
- **MiB and MB**: a mebibyte (MiB) is 1,048,576 bytes and a megabyte (MB) is 1,000,000. Kubernetes counts in bytes, and 1 MB of data fits under the limit while 1.1 MB doesn't.

## Where the limit is checked

Every object passes the same check on its way into the cluster. During a Helm upgrade, two kinds of object go through it: the ones your chart defines, and a record Helm keeps about the release itself.

<div class="k8s-path" role="img" aria-label="The order of a Helm upgrade. First Helm renders the chart's templates with the values file. Second, Helm saves a release record, a Secret holding the chart and values, compressed. Third, Helm applies the chart's own objects, such as the app-settings ConfigMap. Both the release record and the chart's objects go to the API server, which adds up the bytes in each object's data. If an object's data fits in 1,048,576 bytes, it is stored in etcd. If not, the API server rejects it with 'Too long: may not be more than 1048576 bytes' and nothing is stored.">
<svg viewBox="0 0 400 262" aria-hidden="true" focusable="false">
<defs><marker id="k8p-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="k8p-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="k8p-box" x="10" y="10" width="180" height="40" rx="4"/>
<text class="k8p-name" x="100" y="27">1. Render the templates</text>
<text class="k8p-small" x="100" y="41">chart + values.yaml</text>
<line class="k8p-arrow" x1="100" y1="50" x2="100" y2="68" marker-end="url(#k8p-head)"/>
<rect class="k8p-box" x="10" y="70" width="180" height="50" rx="4"/>
<text class="k8p-name" x="100" y="87">2. Save the release record</text>
<text class="k8p-small" x="100" y="100">a Secret: chart + values,</text>
<text class="k8p-small" x="100" y="111">compressed</text>
<line class="k8p-arrow" x1="100" y1="120" x2="100" y2="138" marker-end="url(#k8p-head)"/>
<rect class="k8p-box" x="10" y="140" width="180" height="40" rx="4"/>
<text class="k8p-name" x="100" y="157">3. Apply the chart's objects</text>
<text class="k8p-small" x="100" y="171">ConfigMap app-settings, …</text>
<line class="k8p-arrow" x1="190" y1="95" x2="228" y2="95" marker-end="url(#k8p-head)"/>
<line class="k8p-arrow" x1="190" y1="160" x2="228" y2="122" marker-end="url(#k8p-head)"/>
<rect class="k8p-box k8p-check" x="230" y="70" width="160" height="60" rx="4"/>
<text class="k8p-name" x="310" y="88">API server</text>
<text class="k8p-small" x="310" y="103">adds up the bytes</text>
<text class="k8p-small" x="310" y="114">in the object's data:</text>
<text class="k8p-small k8p-limit" x="310" y="125">≤ 1,048,576?</text>
<line class="k8p-arrow" x1="355" y1="130" x2="355" y2="168" marker-end="url(#k8p-head)"/>
<text class="k8p-label" x="361" y="153">fits</text>
<rect class="k8p-box" x="300" y="170" width="90" height="36" rx="4"/>
<text class="k8p-name" x="345" y="186">etcd</text>
<text class="k8p-small" x="345" y="199">stored</text>
<line class="k8p-arrow" x1="262" y1="130" x2="262" y2="220" marker-end="url(#k8p-head)"/>
<text class="k8p-label k8p-label-left" x="256" y="185">too big</text>
<rect class="k8p-box k8p-reject" x="10" y="222" width="380" height="32" rx="4"/>
<text class="k8p-small" x="200" y="235">rejected, nothing stored:</text>
<text class="k8p-small k8p-limit" x="200" y="247">Too long: may not be more than 1048576 bytes</text>
</svg>
</div>

<p class="bitgrid-caption">Both kinds of object pass the same check. Helm saves its release record before it applies the chart's objects, so a release record that's too big fails the upgrade before any of them change.</p>

The check adds up the values under `data` (and `binaryData`, for a ConfigMap), not the keys or the YAML around them, and compares the total with 1,048,576 bytes [@k8s-validation-size]. etcd has limits of its own, which the 1 MiB check stays safely under: by default it accepts requests up to 1.5 MiB and stores up to 2 GiB in total, with 8 GiB as the suggested maximum [@etcd-limits]. That total is why lots of objects that each fit can still cause trouble together.

## The rendered size is the size that counts

The object Kubernetes checks is the one Helm produces from the templates, not any file you edited. Templates can repeat their input, so a modest values file can render into an object far bigger than anything in the repo:

<div class="k8s-size" role="img" aria-label="A bar showing how a template that repeats a 60 KB block 20 times renders a 1,200,000-byte ConfigMap. The bar is made of 20 equal blocks of 60,000 bytes. A dashed line marks the 1 MiB limit at 1,048,576 bytes, a little before the end of the 18th block. The part of the bar past the line, 151,424 bytes, is shaded as over the limit.">
<svg viewBox="0 0 400 128" aria-hidden="true" focusable="false">
<defs><pattern id="k8b-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="k8b-hatch-line" x1="0" y1="0" x2="0" y2="5"/></pattern></defs>
<rect class="k8b-seg" x="20" y="12" width="18" height="18"/>
<text class="k8b-text" x="44" y="25" text-anchor="start">one 60 KB block in values.yaml, repeated 20 times by a loop</text>
<g class="k8b-bar">
<rect class="k8b-seg" x="20" y="56" width="18" height="22"/><rect class="k8b-seg" x="38" y="56" width="18" height="22"/><rect class="k8b-seg" x="56" y="56" width="18" height="22"/><rect class="k8b-seg" x="74" y="56" width="18" height="22"/><rect class="k8b-seg" x="92" y="56" width="18" height="22"/><rect class="k8b-seg" x="110" y="56" width="18" height="22"/><rect class="k8b-seg" x="128" y="56" width="18" height="22"/><rect class="k8b-seg" x="146" y="56" width="18" height="22"/><rect class="k8b-seg" x="164" y="56" width="18" height="22"/><rect class="k8b-seg" x="182" y="56" width="18" height="22"/><rect class="k8b-seg" x="200" y="56" width="18" height="22"/><rect class="k8b-seg" x="218" y="56" width="18" height="22"/><rect class="k8b-seg" x="236" y="56" width="18" height="22"/><rect class="k8b-seg" x="254" y="56" width="18" height="22"/><rect class="k8b-seg" x="272" y="56" width="18" height="22"/><rect class="k8b-seg" x="290" y="56" width="18" height="22"/><rect class="k8b-seg" x="308" y="56" width="18" height="22"/><rect class="k8b-seg" x="326" y="56" width="18" height="22"/><rect class="k8b-seg" x="344" y="56" width="18" height="22"/><rect class="k8b-seg" x="362" y="56" width="18" height="22"/>
</g>
<rect class="k8b-over" x="334.6" y="56" width="45.4" height="22" fill="url(#k8b-hatch)"/>
<line class="k8b-limit" x1="334.6" y1="44" x2="334.6" y2="90"/>
<text class="k8b-text k8b-limit-text" x="330" y="50" text-anchor="end">1 MiB limit: 1,048,576 bytes</text>
<text class="k8b-text" x="20" y="102" text-anchor="start">0</text>
<text class="k8b-text" x="380" y="102" text-anchor="end">1,200,000 bytes rendered</text>
<text class="k8b-text k8b-limit-text" x="380" y="118" text-anchor="end">151,424 over</text>
</svg>
</div>

<p class="bitgrid-caption">Nobody edited a file anywhere near 1 MiB. The loop did the multiplying, and only the rendered object shows it.</p>

To see the real size, render just the suspect template and count its bytes:

```sh tab="macOS / Linux"
helm template ./chart -f values.yaml --show-only templates/settings-configmap.yaml | wc -c
```

```powershell tab="Windows (PowerShell)"
$out = helm template ./chart -f values.yaml --show-only templates/settings-configmap.yaml | Out-String
[Text.Encoding]::UTF8.GetByteCount($out)
```

`helm template` renders the chart locally without touching the cluster, and `--show-only` keeps just the one file [@helm-template]. `wc -c` counts bytes. In PowerShell, `Out-String` joins the output into one string [@ms-out-string] and `GetByteCount` counts the bytes it takes as UTF-8 [@dotnet-getbytecount]. Either way the count includes the YAML around the data, so it reads a little high, and a number under 1,048,576 is safely under the limit.

## Helm's release record hits the same limit

Helm keeps a record of every release revision, and by default that record is a Secret in the release's namespace, holding the contents of the chart and the values [@helm-storage-backends]. Its name follows the pattern `sh.helm.release.v1.<release>.v<revision>` [@helm-source-storage]. Being a Secret, it gets the same 1 MiB check, and the error names that Secret instead of your ConfigMap.

Two details change how this one behaves:

- **It fails first.** During an upgrade, Helm saves the new release record before it applies any of the chart's objects [@helm-source-upgrade]. A record that's too big stops the upgrade before anything in the cluster changes.
- **It's compressed.** Helm gzips the record and then base64-encodes it [@helm-source-encode]. Compression usually makes the record much smaller than the chart, but base64 adds about a third back, so a chart whose contents are large even after compression hits the limit this way.

For release records that really are that large, Helm documents a beta `sql` storage backend that keeps them in a database instead of the cluster [@helm-storage-backends].

## Ways to get under the limit

| Option | Fits when | Cost |
|---|---|---|
| Shrink the template | A loop repeats a large block | Often the cheapest fix, so look here first |
| Split into several ConfigMaps | The content separates cleanly, such as per component | More objects, each mounted separately |
| Mount a volume or use an object store | The data is large reference data, not settings | A storage dependency and a loading step |
| Fetch at startup | The data changes independently of deploys | Pods depend on that source to start |
| Move to a Secret | Never, for size | Same 1 MiB limit |

The Kubernetes docs point the same way for settings larger than the limit: a mounted volume, a database, or a file service [@k8s-configmap]. Start with the template, though. If the rendered output holds the same block many times, include it once and reference it, and the object may drop well under the limit with no change to how the app works.
