---
title: GitOps, Argo CD and Flux
description: What GitOps means, how a commit in git turns into a change in a Kubernetes cluster, and how Argo CD and Flux differ in doing it.
order: 1
updated: 2026-10-14
---

A team runs a small web shop on Kubernetes. One afternoon the site is slow, and someone runs `helm upgrade` by hand to raise the number of copies of the app from 2 to 3. It works. Three months later nobody remembers that the cluster no longer matches what's in the team's repository, and the next deploy quietly puts it back to 2.

**GitOps** is the practice that stops that from happening. The repository says what should run, and a program inside the cluster keeps the cluster matching it. The deploy step becomes a commit: instead of someone running a command against the cluster, a pipeline or a person pushes a change to git and the cluster picks it up [@argocd-auto-sync]. **Argo CD** and **Flux** are the two common tools that run that program. This primer follows one change, raising the shop from 2 copies to 3, through both of them.

## A few terms

- **Kubernetes manifest**: a YAML file describing one object Kubernetes should run, such as a Deployment (copies of an app) or a Service (a stable address in front of them).
- **Controller**: a program running in the cluster that watches some kind of object and keeps changing the cluster until it matches. Kubernetes itself is mostly controllers, and so are the GitOps tools.
- **CRD** (custom resource definition): a way to add your own object types to Kubernetes. Argo CD and Flux are configured through their own object types, like `Application` or `HelmRelease`.
- **Helm chart**: a package of Kubernetes manifests with placeholders. A **values file** fills in the placeholders, for example `replicaCount: 2`. Running `helm install` or `helm upgrade` records a **release** in the cluster, which `helm list` shows.
- **Kustomize**: another way to vary manifests. A **base** holds the common files, and an **overlay** per environment patches them (more copies in production, fewer in staging).
- **Desired state**: what should be running, as written in git. Argo CD calls it the *target state* [@argocd-concepts].
- **Live state**: what's running in the cluster right now [@argocd-concepts].
- **Drift**: any difference between the two, like the hand-run `helm upgrade` above.
- **Reconcile**: compare live with desired, and change live to match.

## The four principles

The OpenGitOps project defines GitOps with four principles about the desired state [@opengitops-principles]. Git is the usual place to keep it, but the principles only ask for something versioned and immutable.

| Principle | What the definition says | In the shop example |
|---|---|---|
| Declarative | Desired state is written as a description, not as steps [@opengitops-principles] | `replicaCount: 3` in a values file, not "run `helm upgrade`" |
| Versioned and immutable | It's stored with a complete version history [@opengitops-principles] | Each change is a commit that can be reviewed and reverted |
| Pulled automatically | Software agents pull it from where it's stored [@opengitops-principles] | Argo CD or Flux fetches the repository itself |
| Continuously reconciled | Agents keep watching the live state and applying the desired state [@opengitops-principles] | A hand edit gets noticed and, if configured, undone |

## Push and pull

Pulling changes which side opens the connection:

<div class="gitops-flow" role="img" aria-label="Two panels. On the left, push: a git repository triggers a CI pipeline, and the pipeline connects into the cluster's API server, so the pipeline has to hold credentials for the cluster. On the right, pull: an agent such as Argo CD or Flux runs inside the cluster, connects out to fetch from the git repository, and applies changes inside the cluster.">
<svg viewBox="0 0 400 184" aria-hidden="true" focusable="false">
<defs><marker id="go-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="go-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="go-title" x="100" y="14">Push</text>
<text class="go-title" x="300" y="14">Pull</text>
<line class="go-divider" x1="200" y1="4" x2="200" y2="180"/>
<rect class="go-box" x="45" y="26" width="110" height="28" rx="3"/>
<text class="go-name" x="100" y="44">git repo</text>
<rect class="go-box" x="45" y="82" width="110" height="28" rx="3"/>
<text class="go-name" x="100" y="100">CI pipeline</text>
<rect class="go-cluster" x="35" y="138" width="130" height="38" rx="3"/>
<text class="go-name" x="100" y="154">cluster</text>
<text class="go-small" x="100" y="168">API server</text>
<line class="go-arrow" x1="100" y1="55" x2="100" y2="80" marker-end="url(#go-head)"/>
<text class="go-small go-start" x="106" y="71">triggers</text>
<line class="go-arrow go-hot" x1="100" y1="111" x2="100" y2="136" marker-end="url(#go-head)"/>
<text class="go-small go-start go-hotlabel" x="106" y="122">connects in,</text>
<text class="go-small go-start go-hotlabel" x="106" y="132">holds credentials</text>
<rect class="go-box" x="245" y="26" width="110" height="28" rx="3"/>
<text class="go-name" x="300" y="44">git repo</text>
<rect class="go-cluster" x="225" y="82" width="150" height="94" rx="3"/>
<rect class="go-box go-agent" x="245" y="94" width="110" height="30" rx="3"/>
<text class="go-name" x="300" y="108">agent</text>
<text class="go-small" x="300" y="119">Argo CD or Flux</text>
<line class="go-arrow go-hot" x1="300" y1="93" x2="300" y2="56" marker-end="url(#go-head)"/>
<text class="go-small go-start go-hotlabel" x="306" y="74">fetches</text>
<text class="go-small" x="300" y="144">applies changes here</text>
<text class="go-name" x="300" y="166">cluster</text>
</svg>
</div>

<p class="bitgrid-caption">Arrows point from the side that opens the connection. With push, something outside the cluster needs its credentials. With pull, the cluster only reaches out to git.</p>

With **push**, a pipeline outside the cluster runs `helm` or `kubectl` against it, so the pipeline needs credentials for the cluster and a network path to its API server, and nothing notices drift until the next pipeline run. With **pull**, the agent runs inside the cluster and fetches from git on its own, so the pipeline only needs to push a commit [@argocd-auto-sync], and the agent keeps checking between commits.

One Argo CD can also manage other clusters. It stores their addresses and credentials as Secrets in its own namespace and connects to their API servers [@argocd-cluster-generator, @argocd-architecture]. For those clusters it's pull from git but push to the cluster, which is the main architectural difference from Flux (below).

## One change, step by step

The shop's chart lives in the team's repository at `charts/shop`, with production settings in `charts/shop/values-production.yaml`. To go from 2 copies to 3:

1. Someone changes `replicaCount: 2` to `replicaCount: 3` in `values-production.yaml` and opens a pull request.
2. The change is reviewed and merged. The commit is the record of who changed what, and reverting it is the rollback.
3. The agent in the cluster fetches the repository on its next check, or immediately if git sends it a webhook.
4. It renders the chart with the new values and compares the result with the live state. The Deployment's replica count differs, so the app shows as out of sync.
5. It applies the difference, and Kubernetes starts a third copy.

Neither tool knows about the repository until something in the cluster tells it where to look. That link is itself a Kubernetes object, usually kept in git too:

| | Argo CD | Flux |
|---|---|---|
| Which repository and revision | `Application` | `GitRepository` |
| What to apply from it | `Application` | `Kustomization` or `HelmRelease` |
| Many clusters from one definition | `ApplicationSet` | One folder per cluster, with Kustomize overlays |

## Argo CD

Argo CD runs as three main parts: an **API server** behind its web UI and `argocd` command line, a **repository server** that keeps a copy of the git repository and renders manifests from it, and an **application controller** that keeps comparing live state with desired state and reports when they differ [@argocd-architecture]. For the shop, the link is one `Application` [@argocd-declarative, @argocd-helm]:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shop
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://git.example.com/platform/deploy.git
    targetRevision: main
    path: charts/shop
    helm:
      valueFiles:
        - values-production.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: shop
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Each `Application` has a **sync status**, whether the live state matches git, and a separate **health status**, whether the app is running and able to serve requests [@argocd-concepts]. Just after the replica change is merged, `argocd app get shop` would show something like this (the format follows the Argo CD getting-started guide [@argocd-getting-started]):

```text
Name:               shop
Server:             https://kubernetes.default.svc
Namespace:          shop
Repo:               https://git.example.com/platform/deploy.git
Target:             main
Path:               charts/shop
Sync Status:        OutOfSync from main (a1b2c3d)
Health Status:      Healthy

GROUP  KIND        NAMESPACE  NAME  STATUS     HEALTH
       Service     shop       shop  Synced     Healthy
apps   Deployment  shop       shop  OutOfSync  Healthy
```

`OutOfSync` on the Deployment is the replica change waiting to be applied. The app is still `Healthy`, because the two existing copies are running fine.

Some behavior to know before relying on it:

- **Syncing automatically is opt-in.** Without a `syncPolicy.automated` block, Argo CD only reports `OutOfSync` and waits for someone to sync. Deleting what was removed from git (`prune`) and undoing hand edits to the cluster (`selfHeal`) are separate switches, and both are off by default [@argocd-auto-sync]. Without `selfHeal`, the hand-run `helm upgrade` from the opening would just show as `OutOfSync`.
- **It checks git about every three minutes** by default: a 120-second interval plus up to 60 seconds of random delay [@argocd-auto-sync]. A webhook from the git server makes it immediate.
- **Helm is only used to render.** Argo CD runs `helm template` and applies the result itself, instead of `helm install`. So `helm list` doesn't show the release, and Helm's own commands can't inspect or roll it back. Argo CD keeps its own history and rollback instead [@argocd-faq, @argocd-helm].
- **Values come from several places, in a fixed order.** From lowest to highest priority: the chart's own `values.yaml`, then `valueFiles`, then inline `values`, then `valuesObject`, then individual `parameters` [@argocd-helm]. Since version 2.6, values files can live in a different repository from the chart [@argocd-helm].

An **`ApplicationSet`** generates many `Application`s from one template. A generator produces a list of parameter sets, and each one becomes an `Application` [@argocd-appset]. The cluster generator, for example, produces one set per cluster Argo CD manages, and a label selector picks which clusters get the app [@argocd-cluster-generator]. Labeling a cluster `staging: "true"` is then enough to give it every app aimed at staging.

## Flux

Flux is a set of controllers, called the GitOps Toolkit, each with its own object types [@flux-components]:

- The **source controller** fetches from git (`GitRepository`), OCI registries (`OCIRepository`), Helm repositories (`HelmRepository`), and storage buckets.
- The **kustomize controller** applies a folder of manifests (`Kustomization`).
- The **helm controller** installs and upgrades Helm charts (`HelmRelease`).

The Flux project doesn't ship a web UI of its own. You work with it through `kubectl` and the `flux` command line, and separate projects provide UIs [@flux-faq].

For the shop, the repository is a `GitRepository`, and the chart is a `HelmRelease` pointing at it [@flux-helmreleases]:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: deploy
  namespace: flux-system
spec:
  interval: 1m
  url: https://git.example.com/platform/deploy.git
  ref:
    branch: main
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: shop
  namespace: shop
spec:
  interval: 10m
  chart:
    spec:
      chart: ./charts/shop
      sourceRef:
        kind: GitRepository
        name: deploy
        namespace: flux-system
      valuesFiles:
        - ./charts/shop/values-production.yaml
```

These two objects live in git too. `flux bootstrap` installs Flux in the cluster, commits Flux's own manifests to the repository, and points Flux at a folder such as `clusters/production`. From then on, anything committed to that folder is applied [@flux-get-started].

Some behavior to know:

- **Every object has an `interval`.** It sets how often Flux checks that object. For a `Kustomization`, each check fetches the source, rebuilds, applies, and corrects any drift, with no separate switch for undoing hand edits [@flux-kustomization].
- **A `HelmRelease` doesn't undo hand edits unless asked.** Flux only compares the cluster with the Helm release, and corrects what differs, when `driftDetection.mode` is set to `enabled`. Set to `warn`, it only reports the drift [@flux-helmrelease-spec].
- **`prune` is a required field on a `Kustomization`.** With `prune: true`, objects that were removed from git get deleted from the cluster [@flux-kustomization].
- **`HelmRelease` runs real Helm.** The helm controller performs Helm installs, upgrades, tests, and rollbacks itself, and can roll back automatically when an upgrade fails [@flux-helm-controller]. Because these are ordinary Helm releases, `helm list` shows them.

`flux get kustomizations` shows which commit each `Kustomization` has applied [@flux-get-started]:

```text
NAME          REVISION              SUSPENDED  READY  MESSAGE
flux-system   main@sha1:a1b2c3d4    False      True   Applied revision: main@sha1:a1b2c3d4
```

For many clusters, the Flux guide suggests a folder layout instead of a central server: an `apps/base` folder with the common manifests, an overlay per environment such as `apps/production`, and one `clusters/<name>` folder per cluster that pulls in the right overlays [@flux-repo-structure]. Usually each cluster runs its own Flux and pulls for itself. A `Kustomization` can apply to a remote cluster through a kubeconfig, but that's an option, not the default design [@flux-kustomization].

## Side by side

| | Argo CD | Flux |
|---|---|---|
| Shape | API server, repository server, application controller [@argocd-architecture] | Separate controllers and their object types [@flux-components] |
| UI | Built in | None of its own; separate projects provide one [@flux-faq] |
| Helm | Renders with `helm template`; not in `helm list` [@argocd-faq] | Real Helm releases, in `helm list` [@flux-helm-controller] |
| Undo hand edits | Only with `selfHeal: true` [@argocd-auto-sync] | `Kustomization`: on every check [@flux-kustomization]. `HelmRelease`: only with drift detection enabled [@flux-helmrelease-spec] |
| Many clusters | One Argo CD can manage many, with `ApplicationSet` | Usually one Flux per cluster, with overlays [@flux-repo-structure] |
| Cluster credentials | Stored centrally for every cluster it manages [@argocd-cluster-generator] | Normally none leave the cluster |

## What GitOps leaves open

Neither tool decides how to handle **secrets**, since passwords and keys can't sit in plain text in git, or how to lay out values for many environments. Both are design choices a team makes on top of either tool.
