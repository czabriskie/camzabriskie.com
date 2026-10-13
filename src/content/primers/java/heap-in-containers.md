---
title: Java heap size and container memory
description: 'What the JVM heap is, how its default maximum is chosen inside a container, and how to tell a heap problem from an out-of-memory kill or a failed health probe when a pod keeps restarting.'
order: 0
updated: 2026-10-13
---

A Java service runs in a container with a 2 GiB memory limit. Someone checks its heap and finds a maximum of about 512 MiB. That looks like a quarter of what was asked for, and it is natural to wonder whether the service is starved. The service also restarts every few hours, and the restarts look like a memory problem.

Neither follows. The 512 MiB is a default with a rule behind it, and a restart has several possible causes, only one of which is the heap. This note covers how the heap size is chosen, and how to tell the causes of a restart apart.

## A few terms

- **JVM**: the Java Virtual Machine, the program that runs Java code. Each Java service is one JVM process.
- **Heap**: the region of memory where the JVM keeps the objects a program creates. When no code refers to an object any more, the garbage collector frees its space.
- **Garbage collector (GC)**: the part of the JVM that finds unused objects and frees them. Some collectors pause the whole application while they work.
- **Container limit**: a memory ceiling set on a container. On Linux it is a **cgroup** limit, enforced by the kernel [@k8s-manage-resources].
- **Pod and kubelet**: a pod is a group of one or more containers in Kubernetes. The kubelet is the agent on each node that starts, watches, and restarts them.
- **Probe**: a periodic health check the kubelet runs against a container. A failing **liveness** probe makes the kubelet restart the container [@k8s-probes].
- **MiB**: a mebibyte, 1,048,576 bytes. A limit written `2G` is 2,000,000,000 bytes, and `2Gi` is 2,147,483,648. The suffix matters [@k8s-manage-resources].

## Where the default heap comes from

The heap needs an upper bound, and the JVM picks one when you don't. In a container it reads the container's memory limit and takes a fraction of it. The defaults are an initial heap of 1/64 of memory and a maximum heap of 1/4 [@jdk-ergonomics]. The flag behind the maximum is `-XX:MaxRAMPercentage`, whose default is 25 percent [@jdk-java-man].

For the 2 GiB container:

1. Memory visible to the JVM: 2,048 MiB.
2. Initial heap: 2,048 / 64 = **32 MiB**.
3. Maximum heap: 2,048 × 0.25 = **512 MiB**.

The JVM only reads the container limit when container support is on, which is the default in current JDKs. Without it the JVM would size itself from the node's memory instead.

An explicit setting wins over the default. `-Xmx512m` sets the maximum directly, and `-XX:MaxRAMPercentage=60` changes the fraction [@jdk-java-man]. Raising the percentage is better than a fixed `-Xmx` when the limit may change later, because the heap follows the limit.

## Why only a quarter

The heap is not all of the JVM's memory. The container limit has to cover all of these [@jdk-other-considerations, @jdk-java-man]:

- the heap
- **metaspace**, where class definitions live, which has no upper limit unless you set one
- the **code cache**, which holds compiled code, up to 240 MB by default
- one stack per thread
- direct buffers and other native memory

<div class="jvm-budget" role="img" aria-label="A bar representing a 2 GiB container limit. The first quarter, 512 MiB, is the maximum heap. The next part holds metaspace, code cache, thread stacks, and native buffers. The remainder is free headroom. A solid line at the right end marks the container limit, where the kernel kills the process.">
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

<p class="bitgrid-caption">The heap is a quarter of the budget. The rest is for everything else the process needs, and what is left is the safety margin before the limit.</p>

A heap set equal to the container limit leaves nothing for the non-heap parts, so the process crosses the limit and is killed even though the heap is not full. That is the reason for the conservative default. Many teams raise the fraction to 50 or 75 percent once they know how much non-heap memory the service really uses.

## Reading the live value

The obvious command starts a new JVM:

```sh
kubectl exec <pod> -- java -XX:+PrintFlagsFinal -version | grep -E 'MaxHeapSize|InitialHeapSize'
```

That prints what a **fresh** JVM would choose in this container. It ignores any flags the running service was started with. To read the running process, ask it with `jcmd`, which ships with the JDK. In most images the Java process is PID 1:

```sh
kubectl exec <pod> -- jcmd 1 VM.flags
kubectl exec <pod> -- jcmd 1 GC.heap_info
```

`VM.flags` shows the flags in effect, including `-XX:MaxHeapSize` and which collector is in use. `GC.heap_info` shows how much of the heap is used now. Compare used with the maximum before blaming the heap: a heap at 36 percent has plenty of room.

One more check applies to flags set through `JAVA_TOOL_OPTIONS`. The JVM echoes that variable to its output at every start (`Picked up JAVA_TOOL_OPTIONS: ...`), so a secret placed there, such as a trust store password, ends up in the logs.

## Which collector you get

The JVM treats a machine as server-class when it sees two or more processors and at least 1792 MB of memory. Server-class machines get the G1 collector, and everything else gets the Serial collector [@jdk-ergonomics]. A container with a CPU limit under 1000m looks like a single processor, so it gets Serial, which collects with one thread and is meant for small heaps and single-processor machines [@jdk-collectors]. That is fine for small services, and it means a full collection pauses the whole application on a throttled CPU.

## Three restarts that look alike

A pod that restarts without an obvious error has one of three causes. The exit code in `kubectl describe pod`, under `Last State`, tells them apart. When a process dies from a signal numbered N, the shell reports the exit code 128+N [@bash-exit-status]. SIGKILL is signal 9 and SIGTERM is signal 15 [@linux-signal].

| Cause | Reason and exit code | What happened | Where to look |
|---|---|---|---|
| Container out of memory | `OOMKilled`, 137 | Total process memory (heap plus non-heap) crossed the container limit and the kernel killed it [@k8s-manage-resources] | Raise the limit, or lower heap and metaspace |
| Heap exhausted | The JVM throws `OutOfMemoryError`; the container may stay up | The heap hit its maximum while the container had room | Raise `MaxRAMPercentage` or `-Xmx`, or find the leak |
| Failed liveness probe | `Error`, 143 | The kubelet sent SIGTERM after the probe failed too many times in a row [@k8s-probes] | Probe settings, CPU, and why the app stopped answering |

The third row is the one that surprises people. Nothing ran out of memory, no heap error is logged, and the log shows a normal shutdown, because SIGTERM lets the app shut down cleanly. A burst of "interrupted" errors in the last seconds of the log is that shutdown, not the cause of it.

## Why a healthy-looking app fails its probe

A liveness probe is a request to a health endpoint. If the app cannot answer in time, the probe fails. The probe settings decide how much silence is tolerated: with a 10-second timeout, a 30-second period, and a failure threshold of 3, about 90 seconds without an answer gets the container restarted [@k8s-probes].

An app can go quiet for that long without running out of anything:

- **CPU throttling.** A CPU limit is a hard ceiling. When the container uses its share for the period, the kernel pauses it until the next period, and a pause stalls everything, including the health endpoint [@k8s-manage-resources]. The kubelet doesn't kill a container for using CPU, but a throttled container can be slow enough to fail a probe. The counters `nr_throttled` and `throttled_usec` in the container's `cpu.stat` file show how often it happened.
- **A long garbage collection pause.** A collector that stops the application, running on a throttled CPU, can freeze it for seconds.
- **Exhausted threads.** If every worker thread waits on a slow dependency such as a database or cache, no thread is free to answer the probe.
- **Slow startup.** A liveness probe that starts before the app finishes starting can kill it mid-boot. A **startup probe** holds off the liveness probe until the app has come up once [@k8s-probes].

Kubernetes documentation advises against probes that depend on backends, because a slow dependency then restarts every replica at once and can cascade [@k8s-probes]. Readiness is the place for dependency checks, since a failed readiness probe only stops traffic and does not restart anything.

## A diagnostic order

1. Read `Last State` in `kubectl describe pod`. 137 and `OOMKilled` is a memory problem. 143 is a signal from outside, usually a probe.
2. Read the live heap with `jcmd 1 GC.heap_info`. If used memory is far below the maximum, the heap is not the cause.
3. Read the probe settings and compare them with how long the app takes to start and how long it can stall.
4. Check `cpu.stat` in the container for throttling.
5. Capture evidence while the problem is happening: a thread dump from `jcmd 1 Thread.print`, and GC logging switched on with `-Xlog:gc*`.

Kubernetes events, which show the kubelet's "Liveness probe failed" messages, expire after about an hour in many clusters, so read them right after a restart.

Common fixes, once the cause is known: a startup probe for slow boots, a larger failure threshold, a higher CPU limit, or a heap fraction that matches what the service uses. Raise a limit only after the evidence points to it, since a bigger memory limit does nothing for a probe failure.
