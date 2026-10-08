---
title: Docker Desktop vs Podman and other container runtimes on a Mac
description: Why every Mac container tool is the same three layers (VM, engine, client), what Docker Desktop's license covers, and how Podman, Colima, Rancher Desktop, and OrbStack differ.
order: 0
updated: 2026-10-08
---

A Mac cannot run Linux containers directly, because macOS has no Linux kernel. Every tool that "runs Docker on a Mac" boots a Linux virtual machine, runs a container engine inside it, and gives the terminal a client to talk to that engine. Once that shape is clear, comparing the tools is a matter of seeing which layer each one swaps.

## The three layers

Take a concrete command: `docker run --platform linux/amd64 example/app`. Three things must exist for it to work.

| Layer | Job | Docker Desktop | Podman Desktop | Colima | Rancher Desktop | OrbStack |
|---|---|---|---|---|---|---|
| VM manager | Boots the Linux VM | Docker VMM or Apple Virtualization [@docker-desktop-vmm] | `podman machine` [@podman-remote-clients] | Part of Colima [@colima-readme] | Part of the app | Part of the app |
| Engine | Runs the containers | Docker Engine | Podman | Docker, containerd, or Incus [@colima-readme] | dockerd or containerd [@rancher-desktop-docs] | Docker-compatible |
| Client | What you type | `docker` | `podman`, or `docker` through a compatible socket [@podman-desktop-docker-compat] | `docker` or `nerdctl` [@colima-readme] | `docker` or `nerdctl` [@rancher-desktop-docs] | `docker` |

> **Formula:** Docker Desktop is a VM, an engine, a GUI, and a license bundled together. Each alternative replaces some of those parts.

The `docker` command-line client only needs a socket that speaks the Docker API. That is why several tools can stand in for Docker Desktop without changing your scripts.

## Licensing

Docker Desktop is free for personal use, education, non-commercial open source, and small businesses, defined as fewer than 250 employees **and** less than $10 million in annual revenue [@docker-desktop-license]. Larger organizations and government entities need a paid subscription (Pro, Team, or Business) [@docker-desktop-license]. Docker states that licensing for Docker Engine and Moby is not changing, so the cost attaches to the Desktop product and not to containers themselves [@docker-desktop-license].

| Tool | Commercial use |
|---|---|
| Docker Desktop | Paid above the size or revenue threshold |
| Podman Desktop | Open source, no size clause |
| Colima | Open source [@colima-readme] |
| Rancher Desktop | Open source, SUSE-backed [@rancher-desktop-docs] |
| OrbStack | Free for personal, non-commercial use; Pro is $8 per user per month ($96 billed annually) for business use [@orbstack-pricing] |

Whether a given organization crosses the threshold is a question for its own legal or procurement team.

## Docker versus Podman

With Docker, `docker ps` asks a long-running background service, the daemon, what is running. Podman has no central daemon: each command launches containers directly, and rootless operation is a core design goal. These two points are widely described this way, and they match Podman's design, but this primer did not check each against Podman's reference documentation.

Podman's macOS story is documented. Podman's runtime "can only run on Linux operating systems", so on macOS it runs as a remote client against a Linux VM that `podman machine` creates [@podman-remote-clients].

```sh
podman machine init
podman machine start
```

Docker compatibility is a setting rather than a rewrite. Podman Desktop turns on "Third-Party Docker Tool Compatibility" by default on macOS, which maps the usual `/var/run/docker.sock` path to Podman, and its Compose extension lets `docker compose up` run against the Podman engine [@podman-desktop-docker-compat].

## The other three

- **Colima** is command-line only. After `brew install colima` and `colima start`, the normal `docker` client works with no further setup, and Kubernetes is one flag (`--kubernetes`) away [@colima-readme].
- **Rancher Desktop** is a GUI for Mac, Windows, and Linux. It offers dockerd or containerd with `nerdctl` as the engine, and built-in Kubernetes through k3s with a selectable version [@rancher-desktop-docs].
- **OrbStack** is a Mac app positioned as a Docker Desktop alternative. Its free tier excludes commercial use [@orbstack-pricing]. Performance claims for it come from the vendor and from reviews, and were not verified here.

## Apple Silicon and amd64 images

An `amd64` image on an Apple Silicon Mac needs translation. Speed depends on whether the VM can use Apple's Rosetta.

- Docker Desktop's newer Docker VMM "does not currently support Rosetta, so emulation of amd64 architectures is slow", and the documented alternative is the Apple Virtualization framework [@docker-desktop-vmm]. The setting is under Settings, General, Virtual Machine Manager.
- Podman Desktop states that new Podman machines use the `applehv` hypervisor with Rosetta enabled by default, which brings x86_64 containers "to near-native levels"; turning Rosetta off falls back to qemu [@podman-desktop-rosetta].

Some secondary sources claim a later Podman release flipped that default. Treat the vendor documentation as the baseline and check `~/.config/containers/containers.conf` on your own machine [@podman-desktop-rosetta].

> **Rule of thumb:** If amd64 containers are slow on a Mac, check the VM manager and Rosetta setting before switching tools.

### When Rosetta is not enough

Rosetta is not a complete x86_64 implementation. Reports of failures cluster around AVX instructions and JIT-heavy runtimes, though those reports come from secondary sources and are worth reproducing before you rely on them. An image that crashes with `Illegal instruction` under `--platform linux/amd64` is the typical symptom.

Docker Desktop bundles QEMU user-mode emulation, which runs without setup, and its Rosetta option is documented as disabled by default [@docker-desktop-settings]. The VM can have both registered at once, so check which one your settings select. QEMU covers more instructions than Rosetta and runs slower, and Docker's documentation says as much for emulated builds [@docker-multi-platform].

| Approach | Fidelity | Speed |
|---|---|---|
| Rosetta | Good, with known gaps | Near-native |
| QEMU user-mode | Broader | Much slower |
| Full x86_64 VM under QEMU | Most complete | Slowest |
| Native amd64 host | Complete | Native |

Docker documents two ways to skip emulation: a builder with a native amd64 node, and cross-compilation [@docker-multi-platform]. A remote amd64 machine is the only option that is both fast and faithful. To reinstall the QEMU handlers manually, Docker documents `docker run --privileged --rm tonistiigi/binfmt --install all` [@docker-multi-platform].

## Choosing

| Priority | Look at |
|---|---|
| No license gate, with a GUI | Podman Desktop, Rancher Desktop |
| Smallest change, keep the `docker` client, no GUI | Colima |
| Local Kubernetes | Rancher Desktop, Colima with `--kubernetes` |
| Rootless by default | Podman |
| No change, vendor support | Docker Desktop, paid above the threshold |

Not covered here: Lima on its own, Finch, plain `nerdctl`, and running Docker Engine in a self-managed Linux VM.
