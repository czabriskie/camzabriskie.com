---
title: GitOps, Argo CD and Flux
description: What GitOps means, how a commit in git turns into a change in a cluster, and how Argo CD and Flux differ in doing it.
order: 1
updated: 2026-10-14
---

Say a team runs a service on Kubernetes, and one afternoon someone runs `helm upgrade` by hand to change a setting on `app.example.com`. It fixes the problem. Three months later nobody remembers the cluster differs from what is in the repository. GitOps is the practice that makes that situation impossible to hide: the repository states what should run, and a program inside the cluster keeps the cluster equal to it.

## A few terms

- **Desired state**: a description of what should be running (which chart, which version, which values).
- **Live state**: what is actually running in the cluster right now.
- **Drift**: the difference between the two.
- **Reconcile**: compare live with desired and change live to match.
- **CRD** (custom resource definition): a way to add your own object types to Kubernetes, which GitOps tools use for their configuration.
- **Helm chart**: a package of Kubernetes manifests with placeholders, filled in by a values file.

## The four principles

GitOps has a short formal definition: desired state is declarative, versioned and immutable, pulled automatically, and continuously reconciled [@opengitops-principles]. Git is the usual store, but the principles only ask for something versioned and immutable.

| Principle | In practice |
|---|---|
| Declarative | You write the end state (a chart and values), not the steps |
| Versioned and immutable | Every change is a commit that can be reviewed and reverted |
| Pulled automatically | An agent in the cluster fetches the state; nothing pushes in |
| Continuously reconciled | The agent keeps comparing and correcting |

> **GitOps = desired state in git + an agent in the cluster that keeps pulling and reconciling it.**

## Push and pull

A push pipeline runs a tool (Ansible, `helm`, `kubectl`) from outside the cluster, so the pipeline needs credentials and network access to the cluster, and nothing notices drift until the next run. A pull agent runs inside, so only outbound access to git is needed and drift is seen continuously [@argocd-auto-sync].

## How git config becomes a deployment

Git does nothing by itself. The link is an object in the cluster that says which repository, which path and which revision to apply, and where. That mapping is explicit, and it is also stored as YAML in git, bootstrapped once per cluster.

| | Argo CD | Flux |
|---|---|---|
| Where is the repo | `Application` | `GitRepository` |
| What to apply | `Application` | `Kustomization` or `HelmRelease` |
| Many clusters from one template | `ApplicationSet` | One directory per cluster, with overlays |

## Argo CD

Argo CD has an API server, a repo server that renders manifests, and an application controller that compares live with desired state [@argocd-concepts]. Its unit is the `Application`, with a sync status of `Synced` or `OutOfSync` and a separate health status.

For Helm, Argo CD runs `helm template` and applies the result itself, so `helm ls` shows nothing [@argocd-helm]. Values from a `values` block, value files or parameters are merged in a fixed order, and values files can live in a different repository from the chart [@argocd-helm].

An `ApplicationSet` holds a generator and a template. Each parameter set the generator produces becomes one `Application`, and the cluster generator lets a label on a cluster decide which apps it receives [@argocd-bootstrapping].

Automated sync is off by default. `prune` (delete what left git) and `selfHeal` (revert hand edits) are separate switches, also off by default [@argocd-auto-sync].

## Flux

Flux is a set of controllers, the GitOps Toolkit. One fetches sources (git, OCI, Helm repositories), others apply a `Kustomization` or run a `HelmRelease` [@flux-components]. There is no server or UI built in.

A `HelmRelease` makes Flux run real Helm, so `helm ls` shows the release and Helm rollback applies. Many clusters are handled by directory layout: a shared base, an overlay per environment, and one `clusters/<name>` entry point per cluster [@flux-repo-structure]. Each cluster runs its own Flux and pulls for itself.

## Side by side

| | Argo CD | Flux |
|---|---|---|
| Shape | Server, UI, API | Controllers and CRDs |
| Helm | `helm template`, Argo owns the lifecycle | Real Helm release |
| Many clusters | One instance can manage many; ApplicationSet | One Flux per cluster; overlays |
| UI | Built in | Not built in |
| Cluster credentials | Held by a central Argo CD | Stay in each cluster |

## Where to go next

Both tools leave open how to handle secrets (they cannot live in plain text in git) and how to organise per-customer values. Those are design choices, not features of either tool.
