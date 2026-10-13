---
title: Java heap size and container memory
description: 'What the JVM heap is, how its default maximum is chosen inside a container, why it is only a quarter of the limit, how to read the value a running service actually uses, and which garbage collector a small container gets.'
order: 0
updated: 2026-10-13
---

A Java service runs in a container with a 2 GiB memory limit. Someone checks its heap and finds a maximum of about 512 MiB. That looks like a quarter of what was asked for, and it's natural to wonder whether the service is starved of memory. It isn't, or at least that number doesn't show it. The 512 MiB is a default with a rule behind it, and the other three quarters are spoken for.

This primer covers how the JVM picks its heap size inside a container, where the rest of the memory goes, and how to read what a running service is really using. When a Java pod keeps restarting, [why a pod keeps restarting](/primers/kubernetes/pod-restarts/) covers telling a memory problem from the other causes.

## A few terms

- **JVM**: the Java Virtual Machine, the program that runs Java code. Each Java service is one JVM process.
- **Heap**: the area of memory where the JVM keeps the objects a program creates. When no code refers to an object anymore, the garbage collector frees its space.
- **Garbage collector (GC)**: the part of the JVM that finds unused objects and frees them. Some collectors pause the whole application while they work.
- **Container limit**: a ceiling on how much memory a container may use, enforced by the Linux kernel. A container that goes over it can be killed [@k8s-manage-resources].
- **MiB and MB**: a mebibyte (MiB) is 1,048,576 bytes and a megabyte (MB) is 1,000,000. In Kubernetes a limit written `2G` is 2,000,000,000 bytes and `2Gi` is 2,147,483,648, so the suffix matters [@k8s-manage-resources].

## Where the default heap comes from

The heap needs an upper bound, and the JVM picks one when nobody sets it. By default it takes an **initial heap of 1/64** of the available memory and a **maximum heap of 1/4** [@jdk-ergonomics]. The flag behind the maximum is `-XX:MaxRAMPercentage`, whose default is 25 percent [@jdk-java-man].

Inside a container, "available memory" means the container's limit, not the machine's. That's because of **container support**, which is on by default on Linux and lets the JVM read the container's memory and CPU limits [@jdk-java-man]. Without it, a JVM on a 64 GiB node would size its heap as if it had the whole node.

For the 2 GiB container:

1. Memory the JVM sees: 2,048 MiB.
2. Initial heap: 2,048 ÷ 64 = **32 MiB**.
3. Maximum heap: 2,048 × 0.25 = **512 MiB**.

An explicit setting wins over the default. `-Xmx512m` sets the maximum heap directly, and `-XX:MaxRAMPercentage=60` changes the fraction [@jdk-java-man]. The percentage is usually the better choice in a container, because if someone later raises the container limit, the heap grows with it. A fixed `-Xmx` stays where it was.

## Why only a quarter

The heap is only part of what a JVM uses. The container limit has to cover all of this [@jdk-other-considerations, @jdk-java-man]:

- **the heap**
- **metaspace**, where class definitions live. By default it has no upper limit at all.
- **the code cache**, which holds compiled code, up to 240 MB by default
- **one stack per thread**
- **direct buffers and other native memory**

<div class="jvm-budget" role="img" aria-label="A bar representing a 2 GiB container limit. The first quarter, 512 MiB, is the maximum heap. The next part holds metaspace, the code cache, thread stacks, and native buffers. The rest is free headroom. A solid line at the right end marks the container limit, where the kernel can kill the process.">
<svg viewBox="0 0 400 96" aria-hidden="true" focusable="false">
<rect class="jb-heap" x="20" y="22" width="90" height="36"/>
<rect class="jb-other" x="110" y="22" width="130" height="36"/>
<rect class="jb-free" x="240" y="22" width="140" height="36"/>
<line class="jb-limit" x1="380" y1="14" x2="380" y2="66"/>
<text class="jb-name" x="65" y="38">max heap</text>
<text class="jb-small" x="65" y="50">512 MiB</text>
<text class="jb-name" x="175" y="38">non-heap</text>
<text class="jb-small" x="175" y="50">metaspace, code, stacks</text>
<text class="jb-name" x="310" y="38">headroom</text>
<text class="jb-small" x="310" y="50">unused</text>
<text class="jb-edge" x="20" y="82">0</text>
<text class="jb-edge" x="380" y="82" text-anchor="end">2 GiB limit</text>
</svg>
</div>

<p class="bitgrid-caption">The heap is a quarter of the budget. The rest is for everything else the process needs, and whatever is left is the margin before the limit.</p>

A heap set equal to the container limit leaves nothing for the non-heap parts, so the process crosses the limit and gets killed even though the heap itself isn't full. That's the reason for the cautious default. Teams often raise the fraction to 50 or 75 percent once they've measured how much non-heap memory their service really uses.

The two ways of running out look different:

| | What ran out | What you see |
|---|---|---|
| **Heap exhausted** | The heap hit its maximum while the container still had room | The JVM throws `OutOfMemoryError` in the logs. The container may keep running. |
| **Container out of memory** | Heap plus everything else crossed the container limit | The kernel kills the process, and Kubernetes reports `OOMKilled` [@k8s-manage-resources] |

## Reading the value a running service uses

The command most people reach for first starts a brand new JVM:

```bash tab="macOS / Linux"
kubectl exec <pod> -- java -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|InitialHeapSize'
```

```powershell tab="Windows (PowerShell)"
kubectl exec <pod> -- java -XX:+PrintFlagsFinal -version | Select-String 'MaxHeapSize|InitialHeapSize'
```

That prints what a *fresh* JVM would choose in this container, and ignores any flags the running service was started with. To ask the running service itself, use `jcmd`, which comes with the JDK. It takes the process ID, and when Java is the container's main process, that's PID 1 [@jdk-jcmd]:

```bash
kubectl exec <pod> -- jcmd 1 VM.flags
kubectl exec <pod> -- jcmd 1 GC.heap_info
```

`VM.flags` prints the flags in effect and their values, including `MaxHeapSize` and which collector is in use. `GC.heap_info` shows how much of the heap is in use right now [@jdk-jcmd]. Compare the two before blaming the heap: a heap that's 36 percent full has plenty of room.

Flags are often set through the `JAVA_TOOL_OPTIONS` environment variable instead of the command line. The JVM prints that variable's whole value to its error output every time it starts, as `Picked up JAVA_TOOL_OPTIONS: …` [@jdk-source-picked-up], so anything secret put there, like a trust store password, ends up in the logs.

## Which garbage collector you get

When nobody chooses a collector, the JVM picks one based on the machine. It treats a machine as **server-class** if it sees two or more processors and at least 1,792 MB of memory, and gives server-class machines the **G1** collector. Everything else gets the **Serial** collector [@jdk-ergonomics].

In a container, the processor count comes from the CPU limit, rounded up: the JVM divides the container's CPU quota by its period and takes the ceiling [@jdk-source-cpu-count]. So a limit of `500m` (half a CPU) or `1000m` both look like one processor, and `1500m` looks like two. A container limited to one CPU or less gets Serial no matter how much memory it has.

Serial uses a single thread for all its work. It suits single-processor machines and applications with small data sets, up to about 100 MB [@jdk-collectors]. That's fine for a small service, and it also means a full collection stops the whole application, on a CPU that may already be throttled. A long pause like that is one of the ways a healthy service fails its health checks, which [why a pod keeps restarting](/primers/kubernetes/pod-restarts/#why-a-healthy-looking-app-fails-its-probe) covers.
