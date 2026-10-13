---
title: Why a pod keeps restarting
description: 'Telling the causes of a restart apart from the exit code, why an app that looks healthy can still fail its liveness probe, and the order to check things in.'
order: 1
updated: 2026-10-13
---

A service in Kubernetes restarts every few hours. Its logs end in a normal-looking shutdown, there's no crash in them, and the first guess is usually that it ran out of memory. That's one possibility. There are others that look almost the same from the outside, and the fix for each is different, so it pays to know which one happened before raising any limits.

## A few terms

- **Pod**: the smallest thing Kubernetes runs, one or more containers that are scheduled together.
- **Kubelet**: the agent on each node that starts a pod's containers, watches them, and restarts them.
- **Probe**: a health check the kubelet runs against a container on a schedule. A failing **liveness** probe gets the container restarted. A failing **readiness** probe only stops traffic from being sent to it. A **startup** probe holds off the other two until the app has finished starting [@k8s-probes].
- **Signal**: a message the operating system delivers to a process. **SIGTERM** (signal 15) asks it to shut down, and a well-behaved app cleans up and exits. **SIGKILL** (signal 9) ends it immediately, with no chance to clean up [@linux-signal].
- **Exit code**: the number a process leaves behind when it ends. When a process is ended by signal number N, the exit code is 128 + N, so SIGKILL shows up as 137 and SIGTERM as 143 [@bash-exit-status].
- **CPU limit**: the most CPU time a container may use, written in thousandths of a CPU, so `500m` is half a CPU [@k8s-manage-resources].

## Read the exit code first

`kubectl describe pod` shows, for each container, its **Last State**: why the previous run ended and with what exit code. That one field narrows things down a lot:

```bash
kubectl describe pod <pod>
```

| Last State shows | What happened | Where to look |
|---|---|---|
| `OOMKilled`, exit code 137 | The container used more memory than its limit and the kernel killed it [@k8s-manage-resources] | Memory: raise the limit, or make the app use less |
| `Error`, exit code 143 | Something sent SIGTERM and the app shut down cleanly. When nobody deleted the pod, that's usually the kubelet after a failed liveness probe [@k8s-probes, @k8s-pod-lifecycle] | Probe settings, CPU, and why the app stopped answering |
| `Error`, exit code 137, not `OOMKilled` | The app got SIGTERM, didn't exit within the grace period (30 seconds by default), and was killed with SIGKILL [@k8s-pod-lifecycle] | Same as 143, plus why the app ignores or is slow to handle SIGTERM |
| `Error` with another code, often 1 | The app exited on its own, with its own error | The app's logs from just before it ended |

The second row surprises people most. Nothing ran out, no error is logged, and the log ends in what looks like a normal shutdown, because SIGTERM lets the app close down cleanly. A burst of "interrupted" errors in the last few seconds is that shutdown in progress, not its cause.

For Java services there's one more case. The heap can fill up and throw `OutOfMemoryError` while the container itself is well under its limit, so it may not restart at all. [Java heap size and container memory](/primers/java/heap-in-containers/) covers how to tell the two kinds of out-of-memory apart.

## How a failed probe turns into a restart

A liveness probe is usually a request to a health endpoint in the app. Three settings decide how much silence the kubelet tolerates [@k8s-probes]:

- `periodSeconds`: how often to probe.
- `timeoutSeconds`: how long to wait for each answer.
- `failureThreshold`: how many failures in a row count as dead.

With a 30-second period, a 10-second timeout, and a threshold of 3, an app that stops answering gets about 90 seconds before the kubelet gives up on it:

<div class="probe-timeline" role="img" aria-label="A timeline in seconds. At 0 the app stops answering. Probes at 30, 60, and 90 seconds each wait 10 seconds for an answer and fail. After the third failure, at about 100 seconds, the kubelet sends SIGTERM. If the app exits, the exit code is 143. If it is still running when the 30-second grace period ends, at about 130 seconds, it gets SIGKILL and the exit code is 137.">
<svg viewBox="0 0 400 132" aria-hidden="true" focusable="false">
<defs><marker id="pt-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="pt-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<line class="pt-axis" x1="20" y1="78" x2="390" y2="78" marker-end="url(#pt-head)"/>
<text class="pt-tick" x="30.0" y="92">0 s</text><text class="pt-tick" x="108.5" y="92">30</text><text class="pt-tick" x="186.9" y="92">60</text><text class="pt-tick" x="265.4" y="92">90</text><text class="pt-tick" x="291.5" y="92">100</text><text class="pt-tick" x="370.0" y="92">130</text>
<line class="pt-mark" x1="30.0" y1="44" x2="30.0" y2="78"/>
<text class="pt-label pt-start" x="26.0" y="38">app stops answering</text>
<text class="pt-small pt-start" x="108.5" y="50">failed probes</text>
<rect class="pt-fail" x="108.5" y="66" width="26.1" height="12"/><text class="pt-label" x="121.5" y="61">1st</text><rect class="pt-fail" x="186.9" y="66" width="26.2" height="12"/><text class="pt-label" x="200.0" y="61">2nd</text><rect class="pt-fail" x="265.4" y="66" width="26.1" height="12"/><text class="pt-label" x="278.4" y="61">3rd</text>
<line class="pt-signal" x1="291.5" y1="30" x2="291.5" y2="78"/>
<text class="pt-label pt-hot pt-end" x="287.5" y="14">SIGTERM</text>
<text class="pt-label pt-hot pt-end" x="287.5" y="25">exit 143 if it stops</text>
<line class="pt-signal" x1="370.0" y1="30" x2="370.0" y2="78"/>
<text class="pt-label pt-hot pt-end" x="394" y="14">SIGKILL</text>
<text class="pt-label pt-hot pt-end" x="394" y="25">137 if not</text>
<line class="pt-span" x1="293.5" y1="104" x2="368.0" y2="104"/>
<text class="pt-small" x="330.8" y="116">30 s grace</text>
<text class="pt-small pt-start" x="30.0" y="116">each probe waits 10 s, then fails</text>
</svg>
</div>

<p class="bitgrid-caption">Three failed probes in a row, then a polite SIGTERM, then a forced SIGKILL only if the app doesn't stop within the grace period.</p>

## Why a healthy-looking app fails its probe

An app can go quiet for 90 seconds without anything being wrong in the usual sense:

- **CPU throttling.** A CPU limit is a hard ceiling. When a container has used its share for the current scheduling period, the kernel holds it back until the next one [@k8s-manage-resources]. Everything in the container stalls, the health endpoint included. The kubelet never kills a container for using CPU, but a throttled one can be too slow to answer a probe. The container's `cpu.stat` file counts how often it happened, in `nr_throttled`, and for how long, in `throttled_usec` [@kernel-cgroup-v2]:

  ```bash
  kubectl exec <pod> -- cat /sys/fs/cgroup/cpu.stat
  ```

- **A long garbage-collection pause.** A collector that stops the whole application, running on a throttled CPU, can freeze it for seconds. Java services in small containers often get exactly that kind of collector, which [Java heap size and container memory](/primers/java/heap-in-containers/#which-garbage-collector-you-get) explains.
- **Every worker busy.** If all the threads that handle requests are stuck waiting on something slow, like a database, none is free to answer the probe.
- **Slow startup.** A liveness probe that begins before the app has finished starting can kill it partway through, every time. A startup probe fixes that, because Kubernetes runs no liveness or readiness probes until the startup probe has succeeded [@k8s-probes].

The Kubernetes documentation also warns that liveness probes set up wrong can cause **cascading failures**: containers restarted under heavy load, more failed requests, and more load on the pods that are left [@k8s-probes]. The usual way into that trap is a liveness check that also tests a database or another service. When that dependency gets slow, every replica fails its probe at once and restarts together. Checks on dependencies belong in the readiness probe, whose failure only takes the pod out of rotation without restarting anything [@k8s-probes].

## An order to check things in

1. **Read Last State** with `kubectl describe pod`. `OOMKilled` means memory. 143, or 137 without `OOMKilled`, means a signal from outside, usually a probe.
2. **Read the events**, which include the kubelet's "Liveness probe failed" messages. Events are deleted after an hour by default, so read them soon after a restart [@k8s-apiserver]:

   ```bash
   kubectl get events --field-selector involvedObject.name=<pod>
   ```

3. **Compare the probe settings** with how long the app takes to start and how long it can stall.
4. **Check for throttling** in `cpu.stat`.
5. **For a Java service, read the live heap** with `jcmd`, as in [Java heap size and container memory](/primers/java/heap-in-containers/#reading-the-value-a-running-service-uses). A heap far below its maximum isn't the cause.
6. **Catch it in the act.** The next time it starts stalling, take a thread dump and turn on garbage-collection logging, so the evidence exists when it happens again.

Once the cause is known, the fix usually follows from it: a startup probe for a slow start, a higher failure threshold or timeout for an app that stalls briefly, a higher CPU limit for one that's throttled, or a memory change only when the evidence points at memory. A bigger memory limit does nothing for a probe failure.
