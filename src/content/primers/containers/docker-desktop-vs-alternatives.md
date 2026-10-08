---
title: Docker Desktop vs Podman and other container runtimes on a Mac
description: Why every Mac container tool is the same three layers (VM, engine, client), what Docker Desktop's license covers, and how Podman, Colima, Rancher Desktop, and OrbStack differ.
order: 0
updated: 2026-10-08
---

A Mac cannot run Linux containers directly, because macOS has no Linux kernel. Every tool that "runs Docker on a Mac" boots a Linux virtual machine, runs a container engine inside it, and gives the terminal a client to talk to that engine. Once that shape is clear, comparing the tools is a matter of seeing which layer each one swaps.

## A few terms

- **Image**: a read-only template for creating a container, holding the program and everything it needs on disk [@docker-overview].
- **Container**: a running instance of an image, which you can start, stop, and delete [@docker-overview].
- **Engine**: the program that pulls images and runs containers. Docker's engine is a **daemon** called `dockerd`, meaning a background service that stays running and waits for requests [@docker-overview].
- **Socket**: a file such as `/var/run/docker.sock` that programs use to talk to each other. The `docker` command you type is only a client: it sends HTTP API requests to the engine over that socket and prints what comes back [@docker-overview].
- **VM manager**: the piece that creates and boots the Linux virtual machine the engine lives in.

## The three layers

<div class="ctr-layers" role="img" aria-label="Layers of a container tool on a Mac. On macOS, the docker command-line client sends HTTP API requests over a socket such as /var/run/docker.sock. The requests reach the engine, dockerd or Podman, inside a Linux virtual machine. The engine starts containers, which run on the VM's Linux kernel. A VM manager, also on macOS, boots that VM.">
<svg viewBox="0 0 400 272" aria-hidden="true" focusable="false">
<defs><marker id="ctr-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="ctr-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="ctr-host" x="6" y="6" width="388" height="260" rx="8"/>
<text class="ctr-zone" x="18" y="26">macOS</text>
<rect class="ctr-box" x="130" y="34" width="250" height="30" rx="4"/>
<text class="ctr-name" x="255" y="53">docker CLI (the client)</text>
<line class="ctr-arrow" x1="255" y1="64" x2="255" y2="106" marker-end="url(#ctr-head)"/>
<text class="ctr-note" x="263" y="82">HTTP API requests over</text>
<text class="ctr-note ctr-mono" x="263" y="95">/var/run/docker.sock</text>
<rect class="ctr-vm" x="130" y="108" width="250" height="148" rx="6"/>
<text class="ctr-zone" x="140" y="124">Linux VM</text>
<rect class="ctr-box ctr-engine" x="145" y="132" width="220" height="28" rx="4"/>
<text class="ctr-name" x="255" y="150">engine (dockerd or Podman)</text>
<rect class="ctr-box" x="145" y="170" width="68" height="34" rx="4"/>
<rect class="ctr-box" x="221" y="170" width="68" height="34" rx="4"/>
<rect class="ctr-box" x="297" y="170" width="68" height="34" rx="4"/>
<text class="ctr-small" x="179" y="191">container</text>
<text class="ctr-small" x="255" y="191">container</text>
<text class="ctr-small" x="331" y="191">container</text>
<rect class="ctr-kernel" x="145" y="214" width="220" height="30" rx="4"/>
<text class="ctr-name" x="255" y="233">Linux kernel</text>
<rect class="ctr-box" x="18" y="166" width="98" height="44" rx="4"/>
<text class="ctr-name" x="67" y="185">VM manager</text>
<text class="ctr-small" x="67" y="199">boots the VM</text>
<line class="ctr-arrow" x1="116" y1="188" x2="128" y2="188" marker-end="url(#ctr-head)"/>
</svg>
</div>

<p class="bitgrid-caption">The client and the VM manager run on macOS. The engine, the containers, and the Linux kernel they need all live inside the VM.</p>

Take the plain command `docker run example/app` and follow it through:

1. The `docker` client on macOS turns the command into HTTP API requests and sends them to the socket. The tool you installed connects that socket to the engine inside the VM.
2. The engine pulls `example/app` if it isn't already on disk and creates a container from the image.
3. The container's program starts and runs on the VM's Linux kernel, and its output travels back through the same socket to your terminal.

Each tool fills the three layers with its own parts. In the table, **containerd** is a lower-level container runtime that Docker Engine itself builds on [@containerd-site], and **nerdctl** is a Docker-compatible command line for containerd [@nerdctl-readme].

| Tool | VM manager | Engine | Client |
|---|---|---|---|
| Docker Desktop | Docker VMM or Apple Virtualization framework [@docker-desktop-vmm] | Docker Engine | `docker` |
| Podman Desktop | `podman machine` [@podman-remote-clients] | Podman | `podman`, or `docker` through a compatible socket [@podman-desktop-docker-compat] |
| Colima | Part of Colima [@colima-readme] | Docker, containerd, or Incus [@colima-readme] | `docker` or `nerdctl` [@colima-readme] |
| Rancher Desktop | Part of the app | dockerd or containerd [@rancher-desktop-docs] | `docker` or `nerdctl` [@rancher-desktop-docs] |
| OrbStack | Part of the app | Docker-compatible | `docker` |

> **Formula:** Docker Desktop is a VM, an engine, a GUI, and a license bundled together. Each alternative replaces some of those parts.

The `docker` client only needs a socket that speaks the Docker API. That is why several tools can stand in for Docker Desktop without changing your scripts.

## Licensing

As of October 2026, Docker Desktop is free for personal use, education, non-commercial open source, and small businesses, defined as fewer than 250 employees **and** less than $10 million in annual revenue [@docker-desktop-license]. Larger organizations and government entities need a paid subscription (Pro, Team, or Business) [@docker-desktop-license]. Docker states that licensing for Docker Engine and Moby (the open source framework Docker created for assembling container systems [@moby-site]) is not changing, so the cost attaches to the Desktop product and not to containers themselves [@docker-desktop-license].

| Tool | Commercial use, as of October 2026 |
|---|---|
| Docker Desktop | Paid above the size or revenue threshold |
| Podman and Podman Desktop | Open source, Apache-2.0, no size clause [@podman-license] [@podman-desktop-license] |
| Colima | Open source, MIT [@colima-license] |
| Rancher Desktop | Open source, Apache-2.0, SUSE-backed [@rancher-desktop-license] [@rancher-desktop-docs] |
| OrbStack | Free for personal, non-commercial use; Pro is $8 per user per month billed annually ($96 a year) for business use [@orbstack-pricing] |

Whether a given organization crosses the threshold is a question for its own legal or procurement team.

## Docker versus Podman

With Docker, `docker ps` asks the daemon what is running. Podman describes itself as daemonless, so each command does its own work instead of asking a central service, and its containers can run either as root or as an ordinary user [@podman-docs-intro]. Running as an ordinary user is called **rootless**.

Podman's runtime "can only run on Linux operating systems", so on macOS it runs as a remote client against a Linux VM that `podman machine` creates [@podman-remote-clients].

```bash
podman machine init
podman machine start
```

Docker compatibility is a setting rather than a rewrite. Podman Desktop turns on "Third-Party Docker Tool Compatibility" by default on macOS, which maps the usual `/var/run/docker.sock` path to Podman, and its Compose extension lets `docker compose up` run against the Podman engine [@podman-desktop-docker-compat].

## Colima, Rancher Desktop, OrbStack

- **Colima** is command-line only. After `brew install colima` and `colima start`, the normal `docker` client works with no further setup, and Kubernetes is one flag (`--kubernetes`) away [@colima-readme].
- **Rancher Desktop** is a GUI for Mac, Windows, and Linux. It offers dockerd or containerd with `nerdctl` as the engine, and built-in Kubernetes through k3s with a selectable version [@rancher-desktop-docs]. **k3s** is a lightweight Kubernetes distribution shipped as a single binary [@k3s-docs].
- **OrbStack** is a Mac app positioned as a Docker Desktop alternative. Its free tier excludes commercial use [@orbstack-pricing]. Performance claims for it come from the vendor and from reviews, and were not verified here.

## Apple Silicon and amd64 images

Every compiled program is built for one CPU family. Intel and AMD chips use **amd64** (also called x86_64), and Apple Silicon uses **arm64** (also called aarch64). An image is built for one of them, though a multi-platform image bundles a variant for each and the engine picks the one that matches [@docker-multi-platform]. When only an amd64 variant exists, an Apple Silicon Mac has to translate it.

You can see each step from the terminal. These are real outputs from Docker Desktop on an Apple Silicon Mac:

```bash
uname -m                          # macOS itself
# arm64
docker run --rm alpine uname -m   # the Linux VM, native
# aarch64
docker run --rm --platform linux/amd64 alpine uname -m
# x86_64   (emulated)
```

The first two name the same chip in macOS's and Linux's spellings. The third asks for the amd64 variant of the image, and the program inside believes it is on an x86_64 machine because something is translating every instruction. One catch: once you have pulled the amd64 variant, a later plain `docker run alpine` can reuse it and print `x86_64` with a platform warning, so pull again without `--platform` to get back to the native image.

The translation comes from one of two places. **Rosetta** is Apple's translator that lets software built for Intel Macs run on Apple Silicon [@apple-rosetta], and a Linux VM on Apple Silicon can use it for Linux programs too [@docker-desktop-settings] [@podman-desktop-rosetta]. **QEMU** is an open source emulator whose user mode runs a program compiled for one CPU on another [@qemu-about]. The Linux kernel picks between them through **binfmt_misc**, a kernel feature that recognizes a program's format from its first bytes and hands it to a registered interpreter [@linux-binfmt-misc], so whichever translator registered for x86_64 programs gets the job.

- **Docker Desktop** runs amd64 images under emulation out of the box, using the QEMU user-mode emulators bundled with its build tooling [@docker-multi-platform]. Rosetta needs two settings: the VM manager set to Apple Virtualization framework under **Settings > General > Virtual Machine Manager** [@docker-desktop-vmm], and **Use Rosetta for x86_64/amd64 emulation on Apple Silicon** turned on under **Settings > General**, which the documentation lists as off by default and available only with the Apple Virtualization framework [@docker-desktop-settings]. The newer Docker VMM "does not currently support Rosetta, so emulation of amd64 architectures is slow" [@docker-desktop-vmm].
- **Podman** has changed its default. Podman Desktop's documentation says new machines use the `applehv` hypervisor with Rosetta on, which brings x86_64 containers "to near-native levels", and that turning Rosetta off falls back to QEMU [@podman-desktop-rosetta]. The Podman 5.6 release (August 2025) then shipped with Rosetta off by default, because of compatibility problems between Rosetta and Linux kernels 6.13 and later [@podman-56-rosetta]. On Podman 5.6 or later, expect QEMU unless you have turned Rosetta back on.

> **Rule of thumb:** If amd64 containers are slow on a Mac, check the VM manager and Rosetta setting before switching tools.

<details class="aside">
<summary>Checking which translator is registered</summary>

The registrations live in the VM, not on macOS, so look from inside a privileged container:

```bash
docker run --rm --privileged alpine sh -c \
  'mount -t binfmt_misc none /proc/sys/fs/binfmt_misc; ls /proc/sys/fs/binfmt_misc'
```

On the Mac used for the outputs above, the list included both `rosetta` and `x86_64` (a QEMU handler), so the same VM can have both registered at once.

</details>

### When Rosetta is not enough

Rosetta is not a complete x86_64 implementation. Reports of failures cluster around **AVX** instructions (x86 extensions that do math on several numbers in one instruction) and **JIT**-heavy runtimes (just-in-time compilers, such as the JVM's or a JavaScript engine's, which generate machine code while the program runs). Those reports come from secondary sources and are worth reproducing before you rely on them. An image that crashes with `Illegal instruction` under `--platform linux/amd64` is the typical symptom.

QEMU covers more instructions than Rosetta and runs slower, and Docker's documentation says emulation "can be much slower than native builds, especially for compute-heavy tasks" [@docker-multi-platform]. QEMU also comes in two forms. User mode, the one Docker Desktop bundles, translates a single program's instructions while it runs on the VM's arm64 Linux kernel. System emulation models an entire machine, CPU, memory, and devices, and boots a full x86_64 operating system on it [@qemu-about], which leaves nothing native in the path and is slower still.

| Approach | Fidelity | Speed |
|---|---|---|
| Rosetta | Good, with known gaps | Near-native |
| QEMU user mode | Broader | Much slower |
| Full x86_64 VM under QEMU system emulation | Most complete | Slowest |
| Native amd64 host | Complete | Native |

The way out depends on whether you need to build amd64 images or run them.

- **If you only need to build amd64 images:** Docker documents two ways to skip emulation, cross-compilation from the native architecture and a builder with a native amd64 node [@docker-multi-platform].
- **If you need to run them:** a remote amd64 machine is the only option that is both fast and faithful. Locally, the choice is between the translators above.
- **If the QEMU handlers are missing:** Docker documents `docker run --privileged --rm tonistiigi/binfmt --install all` to install and register them [@docker-multi-platform].

## Choosing

| Priority | Look at |
|---|---|
| No license gate, with a GUI | Podman Desktop, Rancher Desktop |
| Smallest change, keep the `docker` client, no GUI | Colima |
| Local Kubernetes | Rancher Desktop, Colima with `--kubernetes` |
| Rootless containers | Podman |
| Keep everything as-is and get vendor support | Docker Desktop, paid above the threshold |

Not covered here: Lima on its own, which launches Linux VMs with file sharing and port forwarding and is what Colima, Rancher Desktop, and Finch build on [@lima-site]; Finch, an open source client that bundles Lima, nerdctl, containerd, and BuildKit [@finch-readme]; plain `nerdctl`; and running Docker Engine in a self-managed Linux VM.
