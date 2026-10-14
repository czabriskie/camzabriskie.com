---
title: Java heap size and container memory
description: 'What the JVM heap is, how its default maximum is chosen inside a container, why it is only a quarter of the limit, how that plays out in a container, a pod, or on a server, how to read the value a running service uses, and which garbage collector a small container gets.'
order: 0
updated: 2026-10-13
---

A web service written in Java runs in a container with a 4 GiB memory limit. Someone checks its heap and finds a maximum of 1 GiB, a quarter of what the container was given, and wonders whether the other 3 GiB are going to waste. They aren't, or not all of them. The 1 GiB is a default with a rule behind it, and most of the rest is spoken for.

This primer covers how the JVM picks its heap size inside a container, where the rest of the memory goes, and how to read what a running service is really using. When a Java pod keeps restarting, [why a pod keeps restarting](/primers/kubernetes/pod-restarts/) covers telling a memory problem from the other causes.

## A few terms

- **JVM**: the Java Virtual Machine, the program that runs Java code. Each Java service is one JVM process.
- **Heap**: the area of memory where the JVM keeps the objects a program creates. When no code refers to an object anymore, the garbage collector frees its space.
- **Garbage collector (GC)**: the part of the JVM that finds unused objects and frees them. Some collectors pause the whole application while they work.
- **Container limit**: a ceiling on how much memory a container may use, enforced by the Linux kernel. A container that goes over it can be killed [@k8s-manage-resources].
- **MiB and MB**: a mebibyte (MiB) is 1,048,576 bytes and a megabyte (MB) is 1,000,000. In Kubernetes a limit written `2G` is 2,000,000,000 bytes and `2Gi` is 2,147,483,648, so the suffix matters [@k8s-manage-resources].

<details class="aside">
<summary>Why there are two kinds of megabyte</summary>

Neither one is rounded. They're two exact sizes with similar names. Memory is addressed in binary, so its sizes come in powers of two, and 1,024 is close enough to 1,000 that the metric names got borrowed for it: a "kilobyte" of memory was often 1,024 bytes and a "megabyte" 1,048,576. Disk makers, network speeds, and the metric system itself use powers of ten instead. The official rules for metric prefixes say they mean powers of ten only, so a kilobit is 1,000 bits and not 1,024 [@si-brochure].

To end the confusion, the International Electrotechnical Commission approved separate binary prefixes in December 1998: kibi (Ki), mebi (Mi), gibi (Gi), and tebi (Ti), where the "bi" stands for binary [@nist-binary]. The gap between the two kinds grows with each step up:

| Prefix | Powers of ten | Powers of two | Difference |
|---|---|---|---|
| kilo / kibi | 1,000 | 1,024 | 2.4% |
| mega / mebi | 1,000,000 | 1,048,576 | 4.9% |
| giga / gibi | 1,000,000,000 | 1,073,741,824 | 7.4% |
| tera / tebi | 1,000,000,000,000 | 1,099,511,627,776 | 10% |

Not everything adopted the new names. Kubernetes did, which is why `2G` and `2Gi` are different limits. The JVM's size flags didn't: `-Xmx80m` means 80 × 1,048,576 bytes, the same as `-Xmx83886080`, even though it's written with a plain `m` [@jdk-java-man].

</details>

## Where you run into a JVM

The JVM doesn't run Java source code. It runs **class files**, a compiled format, and doesn't care which language produced them, so other languages compile to it too [@jvm-spec]. Kotlin is one: it targets the JVM, and Kotlin services can use Java frameworks like Spring Boot [@kotlin-faq]. Anything built in Java or another JVM language brings a JVM with it when it runs. Some common examples:

- **Web services and APIs**, often built with Spring Boot, a Java framework for standalone services [@spring-boot-requirements]. These are the services most teams write themselves and package into containers.
- **Jenkins**, the build server. Its controller is a Java program, and it won't start on a Java version it doesn't support [@jenkins-java].
- **Elasticsearch**, the search engine. It ships with its own copy of Java and sizes its own heap, which comes up again below [@elastic-jvm].

## Where the default heap comes from

The heap needs an upper bound, and the JVM picks one when nobody sets it. By default it takes an **initial heap of 1/64** of the available memory and a **maximum heap of 1/4** [@jdk-ergonomics]. The flag behind the maximum is `-XX:MaxRAMPercentage`, whose default is 25 percent [@jdk-java-man].

Inside a container, "available memory" means the container's limit, not the machine's. That's because of **container support**, which is on by default on Linux and lets the JVM read the container's memory and CPU limits [@jdk-java-man]. Without it, a JVM on a 64 GiB node would size its heap as if it had the whole node.

For the 4 GiB container:

1. Memory the JVM sees: 4,096 MiB.
2. Initial heap: 4,096 ÷ 64 = **64 MiB**.
3. Maximum heap: 4,096 × 0.25 = **1,024 MiB**, or 1 GiB.

An explicit setting wins over the default. `-Xmx2g` sets the maximum heap directly, and `-XX:MaxRAMPercentage=60` changes the fraction [@jdk-java-man]. The percentage is usually the better choice in a container, because if someone later raises the container limit, the heap grows with it. A fixed `-Xmx` stays where it was.

## In a container, a pod, or on its own server

The same JVM runs in all three places. Two things differ between them: what "available memory" means to the JVM, and how many other programs share that memory:

| Where it runs | Memory the JVM sizes from | Usually shared with |
|---|---|---|
| **A container** (Docker, for example) | The container's memory limit [@jdk-java-man] | Nothing. Docker recommends one service per container [@docker-one-service], so one JVM per container is the normal setup. |
| **A Kubernetes pod** | Its own container's limit, set per container in the pod spec [@k8s-manage-resources] | Usually nothing. One container per pod is the most common way pods are used [@k8s-pods], though a pod can add helper containers with limits of their own. |
| **A server or virtual machine** | All the machine's memory [@jdk-ergonomics] | The operating system and anything else installed on it |

Containers and pods are the common case for services written today, and they suit the default well: the JVM is alone with its limit, and the limit was chosen for it. On a server of its own, the default is less of a fit. A JVM that's the only real program on a 64 GiB server takes 16 GiB of heap and leaves most of the machine idle, and four JVMs on one server would each claim 16 GiB with nothing left between them. On servers, the heap is usually set explicitly instead. Elasticsearch, for example, sizes its heap automatically and says that anyone overriding it should keep the heap to no more than half of the memory available, with all the Elasticsearch processes on one host or in one container counted together, because it needs the rest for memory outside the heap [@elastic-jvm].

## Why only a quarter

The heap is only part of what a JVM uses. The container limit has to cover all of this [@jdk-other-considerations, @jdk-java-man]:

- **the heap**
- **metaspace**, where class definitions live. By default it has no upper limit at all.
- **the code cache**, which holds compiled code, up to 240 MB by default
- **one stack per thread**
- **direct buffers and other native memory**

<div class="jvm-budget" role="img" aria-label="A bar representing a 4 GiB container limit. The first quarter, 1 GiB, is the maximum heap. The next part holds metaspace, the code cache, thread stacks, and native buffers. The rest is free headroom. A solid line at the right end marks the container limit, where the kernel can kill the process.">
<svg viewBox="0 0 400 96" aria-hidden="true" focusable="false">
<rect class="jb-heap" x="20" y="22" width="90" height="36"/>
<rect class="jb-other" x="110" y="22" width="130" height="36"/>
<rect class="jb-free" x="240" y="22" width="140" height="36"/>
<line class="jb-limit" x1="380" y1="14" x2="380" y2="66"/>
<text class="jb-name" x="65" y="38">max heap</text>
<text class="jb-small" x="65" y="50">1 GiB</text>
<text class="jb-name" x="175" y="38">non-heap</text>
<text class="jb-small" x="175" y="50">metaspace, code, stacks</text>
<text class="jb-name" x="310" y="38">headroom</text>
<text class="jb-small" x="310" y="50">unused</text>
<text class="jb-edge" x="20" y="82">0</text>
<text class="jb-edge" x="380" y="82" text-anchor="end">4 GiB limit</text>
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

`VM.flags` prints the flags in effect and their values, including `MaxHeapSize` and which collector is in use. `GC.heap_info` shows how much of the heap is in use right now [@jdk-jcmd]. Compare the two before blaming the heap: a service using 300 MiB of a 1 GiB heap has plenty of room left.

Flags are often set through the `JAVA_TOOL_OPTIONS` environment variable instead of the command line. The JVM prints that variable's whole value to its error output every time it starts, as `Picked up JAVA_TOOL_OPTIONS: …` [@jdk-source-picked-up], so anything secret put there, like a trust store password, ends up in the logs.

## Which garbage collector you get

When nobody chooses a collector, the JVM picks one based on the machine. It treats a machine as **server-class** if it sees two or more processors and at least 1,792 MB of memory, and gives server-class machines the **G1** collector. Everything else gets the **Serial** collector [@jdk-ergonomics].

In a container, the processor count comes from the CPU limit, rounded up: the JVM divides the container's CPU quota by its period and takes the ceiling [@jdk-source-cpu-count]. So a limit of `500m` (half a CPU) or `1000m` both look like one processor, and `1500m` looks like two. A container limited to one CPU or less gets Serial no matter how much memory it has.

Serial uses a single thread for all its work. It suits single-processor machines and applications with small data sets, up to about 100 MB [@jdk-collectors]. That's fine for a small service, and it also means a full collection stops the whole application, on a CPU that may already be throttled. A long pause like that is one of the ways a healthy service fails its health checks, which [why a pod keeps restarting](/primers/kubernetes/pod-restarts/#why-a-healthy-looking-app-fails-its-probe) covers.
