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

<div class="gitops-flow" role="img" aria-label="The shop change as a loop. 1: someone edits replicaCount to 3 and the change is reviewed. 2: it's merged into the git repository, which holds the desired state. Inside the cluster, an agent 3: fetches from git, 4: renders the chart and compares it with the live state, and 5: applies the difference, so the Deployment goes from 2 copies to 3. 6: it keeps watching the live state for anything that drifts.">
<svg viewBox="0 0 400 180" aria-hidden="true" focusable="false">
<defs><marker id="gl-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="go-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="go-box" x="8" y="58" width="84" height="40" rx="3"/>
<text class="go-name" x="50.0" y="76.0">pull request</text>
<text class="go-small" x="50.0" y="87.0">replicaCount: 3</text>
<rect class="go-box" x="116" y="58" width="84" height="40" rx="3"/>
<text class="go-name" x="158.0" y="76.0">git repo</text>
<text class="go-small" x="158.0" y="87.0">desired state</text>
<rect class="go-cluster" x="222" y="6" width="172" height="166" rx="3"/>
<text class="go-name" x="308" y="164">cluster</text>
<rect class="go-box go-agent" x="236" y="20" width="144" height="42" rx="3"/>
<text class="go-name" x="308.0" y="39.0">agent</text>
<text class="go-small" x="308.0" y="50.0">4 render, compare</text>
<rect class="go-box" x="236" y="104" width="144" height="40" rx="3"/>
<text class="go-name" x="308.0" y="122.0">live state</text>
<text class="go-small" x="308.0" y="133.0">Deployment: 2 → 3 copies</text>
<line class="go-arrow" x1="93" y1="78" x2="114" y2="78" marker-end="url(#gl-head)"/>
<text class="go-small go-start" x="96" y="72">2</text>
<text class="go-small go-start" x="8" y="112">1 edit, review</text>
<line class="go-arrow go-hot" x1="235" y1="41" x2="201" y2="70" marker-end="url(#gl-head)"/>
<text class="go-small go-start go-hotlabel" x="150" y="50">3 fetch</text>
<line class="go-arrow go-hot" x1="286" y1="63" x2="286" y2="102" marker-end="url(#gl-head)"/>
<text class="go-small go-hotlabel go-end" x="266" y="88">5 apply</text>
<line class="go-arrow" x1="330" y1="103" x2="330" y2="64" marker-end="url(#gl-head)"/>
<text class="go-small go-start" x="336" y="88">6 watch</text>
</svg>
</div>

<p class="bitgrid-caption">The numbers match the steps above. Steps 3 to 6 repeat on a schedule, not only when someone commits.</p>

Neither tool knows about the repository until something in the cluster tells it where to look. That link is itself a Kubernetes object, usually kept in git too:

| | Argo CD | Flux |
|---|---|---|
| Which repository and revision | `Application` | `GitRepository` |
| What to apply from it | `Application` | `Kustomization` or `HelmRelease` |
| Many clusters from one definition | `ApplicationSet` | One folder per cluster, with Kustomize overlays |

## Argo CD

Argo CD works with two separate sets of YAML, and they live in different places:

| | The app's manifests | The `Application` |
|---|---|---|
| What it describes | The shop itself: its Deployment, Service, and settings, here as a Helm chart and a values file | A deployment job: where the shop's manifests are, and where to deploy them |
| Where it's kept | The git repository | The cluster Argo CD runs in, in Argo CD's namespace (`argocd` by default) [@argocd-declarative] |
| Who writes it | The team, through pull requests | Whoever sets the app up: in the web UI, with the `argocd` CLI, or with `kubectl` |
| What Argo CD does with it | Fetches and renders it, but never edits it | Reads it to learn what to fetch and where to put the result |

### What an `Application` is

An `Application` is a Kubernetes object, stored by the cluster like a Deployment or a Service is. A Deployment describes containers to run. An `Application` describes a link between a place in git and a place in a cluster. Argo CD's docs define it by two pieces of information: a **source**, the repository, revision, and path of the desired state, and a **destination**, the cluster and namespace to deploy into [@argocd-declarative]. On its own it runs nothing. Argo CD's application controller reads it, gets the manifests from the source, compares them with what's running at the destination, and syncs the difference [@argocd-architecture].

Here's the shop's `Application`, with what each part means [@argocd-declarative, @argocd-helm, @argocd-getting-started]:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shop               # the name Argo CD shows in its UI and CLI
  namespace: argocd        # where this object itself is stored
spec:
  project: default         # the Argo CD project it belongs to
  source:                  # where the desired state is
    repoURL: https://git.example.com/platform/deploy.git
    targetRevision: main   # branch, tag, or commit to follow
    path: charts/shop      # folder in that repository
    helm:
      valueFiles:
        - values-production.yaml
  destination:             # where to deploy it
    server: https://kubernetes.default.svc   # the cluster Argo CD runs in
    namespace: shop
  syncPolicy:              # optional: apply changes without anyone clicking Sync
    automated:
      prune: true
      selfHeal: true
```

Nothing about the shop's containers is in there. Those are in the chart, in git. Putting the two together:

<div class="gitops-flow" role="img" aria-label="Where each piece lives. On the left, the git repository holds the shop's chart: charts/shop with Chart.yaml, values-production.yaml, and templates for a Deployment and a Service. On the right, the cluster Argo CD runs in. In its argocd namespace is the Application named shop, made in the web UI, the CLI, or with kubectl. Its source points at charts/shop on the main branch, and its destination is the shop namespace. Argo CD fetches the chart, renders it, and applies the result into the shop namespace, where the Deployment with 3 copies and the Service are created.">
<svg viewBox="0 0 400 226" aria-hidden="true" focusable="false">
<defs><marker id="gw-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="go-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="go-title" x="77" y="14">git repo</text>
<text class="go-title" x="283" y="14">cluster Argo CD runs in</text>
<rect class="go-box" x="4" y="24" width="146" height="128" rx="3"/>
<text class="go-small go-start" x="12" y="42">deploy.git/</text>
<text class="go-small go-start go-file" x="21" y="57">charts/shop/</text>
<text class="go-small go-start go-file" x="30" y="72">Chart.yaml</text>
<text class="go-small go-start go-file" x="30" y="87">values-production.yaml</text>
<text class="go-small go-start go-file" x="30" y="102">templates/</text>
<text class="go-small go-start go-file" x="39" y="117">deployment.yaml</text>
<text class="go-small go-start go-file" x="39" y="132">service.yaml</text>
<rect class="go-cluster" x="168" y="24" width="228" height="196" rx="3"/>
<text class="go-small go-start" x="178" y="40">namespace argocd</text>
<rect class="go-box go-agent" x="178" y="46" width="208" height="58" rx="3"/>
<text class="go-name" x="282.0" y="62.0">Application: shop</text>
<text class="go-small" x="282.0" y="73.0">source: charts/shop @ main</text>
<text class="go-small" x="282.0" y="84.0">destination: namespace shop</text>
<text class="go-small" x="282.0" y="95.0">made in UI, CLI, or kubectl</text>
<text class="go-small go-start" x="178" y="146">namespace shop</text>
<rect class="go-box" x="178" y="152" width="208" height="58" rx="3"/>
<text class="go-name" x="282.0" y="168.0">Deployment: shop, 3 copies</text>
<text class="go-small" x="282.0" y="179.0">Service: shop</text>
<text class="go-small" x="282.0" y="190.0">created by Argo CD from</text>
<text class="go-small" x="282.0" y="201.0">the rendered chart</text>
<line class="go-arrow go-hot" x1="177" y1="62" x2="82" y2="58" marker-end="url(#gw-head)"/>
<text class="go-small go-start go-hotlabel" x="112" y="53">source</text>
<line class="go-arrow" x1="300" y1="105" x2="300" y2="150" marker-end="url(#gw-head)"/>
<text class="go-small go-start" x="305" y="131">destination</text>
<line class="go-arrow go-hot" x1="120" y1="153" x2="176" y2="182" marker-end="url(#gw-head)"/>
<text class="go-small go-start go-hotlabel" x="60" y="176">fetched,</text>
<text class="go-small go-start go-hotlabel" x="60" y="186">rendered, applied</text>
</svg>
</div>

<p class="bitgrid-caption">The chart stays in git. The `Application` lives in Argo CD's namespace and only points at it. Argo CD does the fetching, and creates the real objects in the destination namespace.</p>

### What the folder in git has to contain

The `Application` can point at any folder, but Argo CD has to be able to turn what's in it into Kubernetes objects. Its repo server knows how to build from a few formats [@argocd-tools]:

| What's in the folder | How Argo CD recognizes it | What it does with it |
|---|---|---|
| A Helm chart | A `Chart.yaml` file | Renders it with `helm template` [@argocd-helm] |
| A Kustomize setup | A `kustomization.yaml` file | Builds it with Kustomize |
| Plain manifests | Neither of those | Reads every `.yaml`, `.yml`, and `.json` file as a Kubernetes manifest, also Jsonnet [@argocd-directory] |
| Anything else | Only through a **config management plugin**, a tool you add to the repo server | Runs the plugin, which has to print Kubernetes YAML [@argocd-cmp] |

Argo CD checks in that order unless the `Application` names a tool, so a folder with a `Chart.yaml` is always treated as a Helm chart [@argocd-tool-detection]. Whichever way it's built, the result has to be valid Kubernetes objects. A folder of plain manifests is read only at its top level unless the `Application` sets `directory.recurse: true`. Plain-manifest mode is only for plain files: if the `Application` forces it and Argo CD finds Helm, Kustomize, or Jsonnet files there, rendering fails [@argocd-directory].

`Application` files follow the same rule when they're in git. They only need to be there if Argo CD reads them from git, which is what app of apps does: the parent `Application`'s folder holds the child `Application`s, and it's just another source, so it can be plain `Application` YAML files or a Helm chart that produces them [@argocd-bootstrapping]. An `ApplicationSet` keeps one file in git, and the `Application`s it generates never exist as files at all.

### Three ways to create an `Application`

Each of these creates the same kind of object in the same place. The web UI and the CLI send it through Argo CD's API server, and `kubectl` writes it straight to the cluster [@argocd-architecture, @argocd-declarative].

- **The web UI.** Click **+ New App** and fill in the same fields as the YAML: name, project, sync policy, repository URL, revision, path, and the destination cluster and namespace. Then click **Create** [@argocd-getting-started].
- **The `argocd` CLI** [@argocd-app-create]:

  ```bash
  argocd app create shop \
    --repo https://git.example.com/platform/deploy.git \
    --revision main \
    --path charts/shop \
    --values values-production.yaml \
    --dest-server https://kubernetes.default.svc \
    --dest-namespace shop
  ```

- **`kubectl`**, with the YAML above saved as a file. Argo CD supports managing `Application`s this way without touching the `argocd` CLI [@argocd-declarative]:

  ```bash
  kubectl apply -f shop-application.yaml
  ```

None of these write anything to git. The `Application` only points at the repository.

### Keeping the `Application` in git too

An `Application` made in the web UI or with the CLI exists only in the cluster. The shop's chart is versioned, but the pointer to it isn't, which is the opening problem one level up: if someone changes or deletes the `Application` by hand, git has no record of it.

Argo CD's docs say you can create `Application`s by hand or with a script, but recommend generating them with an `ApplicationSet`, with a pattern called **app of apps** as the alternative [@argocd-bootstrapping]. Both work the same way at heart: one object you write once and keep in git produces the `Application`s, so nobody makes them by hand. In app of apps, one parent `Application` is created by hand, once, and its source is a folder in git full of other `Application` files. From then on, adding an app to the cluster means committing an `Application` file. Argo CD warns that this is an admin-level tool, because whoever can push to that folder can create `Application`s in any project, so only admins should have push access to it and changes to it should be reviewed [@argocd-bootstrapping].

### Generating `Application`s with an `ApplicationSet`

An **`ApplicationSet`** is a recipe for `Application`s. It's another Argo CD object with two parts [@argocd-appset, @argocd-generators]:

- a **generator**, which produces a list of parameter sets, such as one per cluster, one per folder in a repository, or one per item in a list you write;
- a **template**, an `Application` with blanks in it. For each parameter set, Argo CD's ApplicationSet controller fills in the blanks and creates that `Application`.

Say the shop now runs on two clusters, staging and production, and the team wants it on any future cluster that should have it. Each cluster Argo CD manages is registered as a Secret in Argo CD's namespace, and those Secrets can carry labels [@argocd-cluster-generator]. The team labels each cluster with its environment, and labels the ones that should run the shop with `shop: "enabled"`. Then, instead of one `Application` per cluster, they write one `ApplicationSet` [@argocd-cluster-generator]:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: shop
  namespace: argocd
spec:
  goTemplate: true
  goTemplateOptions: ["missingkey=error"]
  generators:
    - clusters:                  # one parameter set per registered cluster...
        selector:
          matchLabels:
            shop: "enabled"      # ...but only clusters with this label
  template:                      # an Application, with blanks
    metadata:
      name: 'shop-{{.name}}'     # the cluster's name
    spec:
      project: default
      source:
        repoURL: https://git.example.com/platform/deploy.git
        targetRevision: main
        path: charts/shop
        helm:
          valueFiles:
            - 'values-{{.metadata.labels.env}}.yaml'   # the cluster's env label
      destination:
        server: '{{.server}}'      # the cluster's API address
        namespace: shop
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

For every cluster with `shop: "enabled"`, the cluster generator hands the template that cluster's `name`, its `server` address, and its labels [@argocd-cluster-generator]. With three clusters registered, the result looks like this:

<div class="gitops-flow" role="img" aria-label="An ApplicationSet named shop and the Applications it generates. On the left, three clusters registered in Argo CD: staging, labeled env=staging and shop=enabled; production, labeled env=production and shop=enabled; and dev, labeled env=dev with no shop label. The ApplicationSet selects clusters labeled shop=enabled and fills in a template named shop-{{.name}}. It generates two Applications: shop-staging, using values-staging.yaml and deploying to the staging cluster, and shop-production, using values-production.yaml and deploying to the production cluster. Dev isn't selected, so it gets no shop.">
<svg viewBox="0 0 400 186" aria-hidden="true" focusable="false">
<defs><marker id="gs-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="go-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="go-title" x="61" y="14">registered clusters</text>
<text class="go-title" x="204" y="14">ApplicationSet</text>
<text class="go-title" x="337" y="14">generated Applications</text>
<rect class="go-box" x="4" y="26" width="114" height="42" rx="3"/>
<text class="go-name" x="61.0" y="39.5">staging</text>
<text class="go-small" x="61.0" y="50.5">env=staging</text>
<text class="go-small" x="61.0" y="61.5">shop=enabled</text>
<rect class="go-box" x="4" y="80" width="114" height="42" rx="3"/>
<text class="go-name" x="61.0" y="93.5">production</text>
<text class="go-small" x="61.0" y="104.5">env=production</text>
<text class="go-small" x="61.0" y="115.5">shop=enabled</text>
<rect class="go-cluster" x="4" y="134" width="114" height="42" rx="3"/>
<text class="go-name" x="61.0" y="147.5">dev</text>
<text class="go-small" x="61.0" y="158.5">env=dev</text>
<text class="go-small" x="61.0" y="169.5">no shop label</text>
<rect class="go-box go-agent" x="144" y="62" width="120" height="64" rx="3"/>
<text class="go-name" x="204.0" y="81.0">ApplicationSet: shop</text>
<text class="go-small" x="204.0" y="92.0">selects</text>
<text class="go-small" x="204.0" y="103.0">shop=enabled</text>
<text class="go-small" x="204.0" y="114.0">name: shop-{{.name}}</text>
<rect class="go-box" x="278" y="30" width="118" height="48" rx="3"/>
<text class="go-name" x="337.0" y="46.5">shop-staging</text>
<text class="go-small" x="337.0" y="57.5">values-staging.yaml</text>
<text class="go-small" x="337.0" y="68.5">to: staging</text>
<rect class="go-box" x="278" y="110" width="118" height="48" rx="3"/>
<text class="go-name" x="337.0" y="126.5">shop-production</text>
<text class="go-small" x="337.0" y="137.5">values-production.yaml</text>
<text class="go-small" x="337.0" y="148.5">to: production</text>
<line class="go-arrow go-hot" x1="119" y1="50" x2="142" y2="82" marker-end="url(#gs-head)"/>
<line class="go-arrow go-hot" x1="119" y1="101" x2="142" y2="101" marker-end="url(#gs-head)"/>
<line class="go-arrow go-hot" x1="265" y1="86" x2="276" y2="58" marker-end="url(#gs-head)"/>
<line class="go-arrow go-hot" x1="265" y1="104" x2="276" y2="132" marker-end="url(#gs-head)"/>
<text class="go-small" x="204" y="166">dev isn't selected,</text>
<text class="go-small" x="204" y="177">so it gets no shop</text>
</svg>
</div>

<p class="bitgrid-caption">The generator decides how many <code>Application</code>s there are, one per selected cluster. The template decides what each one looks like.</p>

| Cluster | Labels | Generated `Application` | Values file | Deploys to |
|---|---|---|---|---|
| staging | `env=staging`, `shop=enabled` | `shop-staging` | `values-staging.yaml` | the staging cluster's `shop` namespace |
| production | `env=production`, `shop=enabled` | `shop-production` | `values-production.yaml` | the production cluster's `shop` namespace |
| dev | `env=dev` | none | | |

Each generated `Application` is an ordinary `Application`, the same kind of object as the one in the previous section. It shows up in the web UI and syncs the same way. The difference is who made it.

From then on, the controller keeps the `Application`s matching the clusters:

- **A new cluster gets the shop by being labeled.** Register a fourth cluster with `env=staging` and `shop=enabled`, and the controller creates `shop-<name>` for it. Nobody writes an `Application`. The cluster generator responds to clusters being added and removed [@argocd-generators].
- **Removing the label removes the shop.** Under the controller's default policy, `sync`, it creates, updates, and deletes `Application`s to match what the generator produces [@argocd-appset-modification]. Generated `Application`s carry a finalizer that, by default, makes Argo CD delete what they deployed when they go away [@argocd-appset-deletion].
- **Hand edits to a generated `Application` don't stick.** The same `sync` policy updates them back to what the template says. A policy such as `create-only` or `create-update` limits what the controller may change [@argocd-appset-modification].
- **Deleting the `ApplicationSet` deletes everything it made:** the `Application`s, and the Deployments and Services they deployed, unless `syncPolicy.preserveResourcesOnDeletion` is `true` [@argocd-appset-deletion]. Be careful with `kubectl delete` on one.

Argo CD's bootstrapping guide recommends exactly this pattern, cluster labels plus `ApplicationSet`s, for getting apps onto new clusters [@argocd-bootstrapping]. The `ApplicationSet` itself still has to be created once, for example with `kubectl apply`, but it's one file to keep in git instead of one per app per cluster, and every `Application` it makes follows from that file.

The cluster generator is one of nine. A few others that come up often [@argocd-generators]:

| Generator | One parameter set per… |
|---|---|
| List | item in a list written into the `ApplicationSet` itself |
| Cluster | cluster Argo CD manages, optionally filtered by label |
| Git | file, or folder, in a git repository, such as one folder per app |
| Matrix | combination of two other generators, such as every app folder on every cluster |
| Pull Request | open pull request in a repository, for short-lived preview environments |

### How Argo CD's parts fit together

Argo CD runs as three main parts: an **API server** behind its web UI and CLI, a **repo server** that keeps a copy of the git repository and renders manifests from it, and an **application controller** that keeps comparing live state with desired state [@argocd-architecture]. The web UI and the CLI only talk to the API server, which also handles logins and permissions [@argocd-architecture, @argocd-components]. The API server never calls the application controller. Both work through the Kubernetes API of the cluster Argo CD runs in: the API server creates and updates `Application` objects there, and the controller watches those objects and does the syncing [@argocd-components]. Clicking Sync in the UI writes a sync request onto the `Application`, which is also how you can sync with plain `kubectl` [@argocd-sync-kubectl]. For other clusters, the controller connects with the credentials Argo CD stores for them [@argocd-cluster-generator].

<div class="gitops-flow" role="img" aria-label="Argo CD's parts. The web UI and the argocd CLI talk only to the API server, which handles logins and permissions. The API server writes Application objects to the Kubernetes API. The application controller watches those Application objects, asks the repo server for manifests, and applies changes, through the Kubernetes API for its own cluster and with stored credentials for other clusters. The repo server fetches from the git repository and renders manifests, for both the API server and the controller.">
<svg viewBox="0 0 400 258" aria-hidden="true" focusable="false">
<defs><marker id="ga-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="go-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="go-box" x="100" y="6" width="76" height="24" rx="3"/>
<text class="go-name" x="138.0" y="21.5">web UI</text>
<rect class="go-box" x="186" y="6" width="82" height="24" rx="3"/>
<text class="go-name" x="227.0" y="21.5">argocd CLI</text>
<rect class="go-cluster" x="96" y="40" width="176" height="214" rx="3"/>
<text class="go-small" x="184" y="249">Argo CD</text>
<rect class="go-box" x="106" y="50" width="156" height="36" rx="3"/>
<text class="go-name" x="184.0" y="66.0">API server</text>
<text class="go-small" x="184.0" y="77.0">logins, permissions</text>
<rect class="go-box" x="106" y="124" width="156" height="36" rx="3"/>
<text class="go-name" x="184.0" y="140.0">repo server</text>
<text class="go-small" x="184.0" y="151.0">fetches git, renders</text>
<rect class="go-box go-agent" x="106" y="196" width="156" height="36" rx="3"/>
<text class="go-name" x="184.0" y="212.0">application controller</text>
<text class="go-small" x="184.0" y="223.0">compares, syncs</text>
<rect class="go-box" x="4" y="126" width="60" height="32" rx="3"/>
<text class="go-name" x="34.0" y="145.5">git repo</text>
<rect class="go-box" x="292" y="64" width="100" height="60" rx="3"/>
<text class="go-name" x="342.0" y="86.5">Kubernetes API</text>
<text class="go-small" x="342.0" y="97.5">Application</text>
<text class="go-small" x="342.0" y="108.5">objects</text>
<rect class="go-box" x="292" y="184" width="100" height="48" rx="3"/>
<text class="go-name" x="342.0" y="200.5">other clusters</text>
<text class="go-small" x="342.0" y="211.5">stored</text>
<text class="go-small" x="342.0" y="222.5">credentials</text>
<line class="go-arrow" x1="138" y1="31" x2="138" y2="48" marker-end="url(#ga-head)"/>
<line class="go-arrow" x1="227" y1="31" x2="227" y2="48" marker-end="url(#ga-head)"/>
<line class="go-arrow" x1="150" y1="87" x2="150" y2="122" marker-end="url(#ga-head)"/>
<text class="go-small go-start" x="155" y="108">manifests</text>
<line class="go-arrow" x1="218" y1="195" x2="218" y2="162" marker-end="url(#ga-head)"/>
<text class="go-small go-start" x="223" y="182">manifests</text>
<line class="go-arrow go-hot" x1="105" y1="142" x2="66" y2="142" marker-end="url(#ga-head)"/>
<text class="go-small go-hotlabel go-end" x="93" y="136">fetch</text>
<line class="go-arrow" x1="263" y1="72" x2="290" y2="82" marker-end="url(#ga-head)"/>
<text class="go-small go-start" x="277" y="60">writes</text>
<line class="go-arrow go-hot" x1="263" y1="204" x2="300" y2="126" marker-end="url(#ga-head)"/>
<text class="go-small go-start go-hotlabel" x="298" y="146">watches,</text>
<text class="go-small go-start go-hotlabel" x="298" y="156">applies</text>
<line class="go-arrow go-hot" x1="263" y1="220" x2="290" y2="212" marker-end="url(#ga-head)"/>
</svg>
</div>

<p class="bitgrid-caption">The UI and CLI never reach the controller directly. The API server writes `Application` objects, the controller watches them, and the Kubernetes API sits between the two.</p>

### Watching the shop change

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


## Flux

Flux works with the same two sets of YAML as Argo CD, the app's manifests and the objects that tell the tool what to do with them. The difference is where the second set lives:

| | The app's manifests | Flux's objects |
|---|---|---|
| What it describes | The shop itself: its chart and values file | What Flux should fetch, and what to apply or install from it |
| Where it's kept | The git repository | Usually the same git repository, in the cluster's folder, such as `clusters/production` [@flux-get-started, @flux-repo-structure] |
| Who writes it | The team, through pull requests | The team, through pull requests. `flux create` can generate the YAML |
| What Flux does with it | Fetches it, and applies or installs it, but never edits it | Applies it to the cluster from git, then follows it |

Argo CD's `Application` normally starts life in the cluster, from the web UI or the CLI. Flux has no web UI of its own [@flux-faq], and its objects normally start life as files in git that Flux applies to itself.

### Flux's three objects

Each object is a Kubernetes object, like Argo CD's `Application`, and each one is handled by a different Flux controller [@flux-components]:

- **`GitRepository`**: where a repository is, which branch to follow, and how often to check it. The source controller fetches it and packages the files as an **artifact** for the other controllers [@flux-helmreleases, @flux-helm-controller].
- **`Kustomization`**: a folder in a source to apply to the cluster, how often, and whether to delete what's been removed from git [@flux-kustomization]. This isn't Kustomize's own `kustomization.yaml` file, despite the name. Flux's FAQ confirms there are two different types called Kustomization: Flux's is a Kubernetes object that points at a folder, and Kustomize's is the file inside that folder that lists what to build [@flux-faq].
- **`HelmRelease`**: a Helm chart from a source, with its values. The helm controller turns it into a real Helm release [@flux-helm-controller].

Here's the shop's `HelmRelease`, saved as `clusters/production/shop.yaml` in the repository [@flux-helmreleases, @flux-kustomization]:

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: shop
  namespace: shop
spec:
  interval: 10m              # how often to check the release against git
  chart:
    spec:
      chart: ./charts/shop   # path to the chart inside the source
      reconcileStrategy: Revision   # upgrade on any new commit (see below)
      sourceRef:             # which source the chart comes from
        kind: GitRepository
        name: flux-system    # the repository bootstrap already set up
        namespace: flux-system
      valuesFiles:
        - ./charts/shop/values-production.yaml
```

Like an `Application`, it says nothing about the shop's containers. It points at the chart, and the chart describes the containers.

The `reconcileStrategy` line matters for a chart kept in git. By default Flux only builds a new copy of the chart when the `version` in `Chart.yaml` goes up, so a commit that only changes `values-production.yaml` wouldn't reach the cluster. `Revision` makes every new commit count [@flux-helmchart, @flux-helmrelease-api].

The folders Flux reads have rules too. A `HelmRelease` needs a Helm chart. A `Kustomization` reads a folder of Kubernetes manifests: if there's no `kustomization.yaml`, Flux generates one covering every YAML file under the path, so every one of them has to be a valid Kubernetes manifest unless it's excluded with a `.sourceignore` file or the source's `ignore` field. Flux recommends committing your own `kustomization.yaml` so CI can check it [@flux-kustomization].

### How Flux finds the shop

Neither the `HelmRelease` nor the chart does anything until Flux is reading the folder they're in. That starts with bootstrap, and the rest follows in a chain:

1. **`flux bootstrap`**, run once per cluster, installs Flux's controllers, commits Flux's own manifests to the repository under `clusters/production/flux-system`, and sets Flux to keep the cluster in sync with that folder of the repository. From then on, any change to the cluster, Flux upgrades included, can be made with a git push [@flux-installation, @flux-get-started].
2. Bootstrap leaves a `GitRepository` for the repository and a `Kustomization` for the cluster's folder, both called `flux-system`. Flux's docs build on that `GitRepository` in their own examples [@flux-get-started, @flux-kustomization].
3. The team commits `shop.yaml` to `clusters/production`. The `flux-system` `Kustomization` applies everything in that folder on its next check, so the `HelmRelease` appears in the cluster [@flux-kustomization].
4. The helm controller sees the new `HelmRelease`, gets the chart from the source's artifact, and runs a Helm install. The Deployment and Service appear in the `shop` namespace [@flux-helm-controller].

<div class="gitops-flow" role="img" aria-label="How Flux finds the shop. On the left, the git repository: clusters/production holds a flux-system folder written by bootstrap, and the team's shop.yaml. charts/shop holds the chart. On the right, inside the cluster, a chain: the GitRepository named flux-system fetches the repository and hands an artifact to the Kustomization named flux-system, which applies everything in clusters/production, including shop.yaml. That creates the HelmRelease named shop, whose chart is ./charts/shop. The helm controller runs Helm install or upgrade, creating the Deployment and Service in the shop namespace as a Helm release. Dashed lines connect each object to the file in git it comes from.">
<svg viewBox="0 0 400 256" aria-hidden="true" focusable="false">
<defs><marker id="gc-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="go-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="go-title" x="82" y="14">git repo</text>
<text class="go-title" x="286" y="14">cluster</text>
<rect class="go-box" x="4" y="24" width="156" height="132" rx="3"/>
<text class="go-small go-start" x="12" y="42">deploy.git/</text>
<text class="go-small go-start go-file" x="21" y="57">clusters/production/</text>
<text class="go-small go-start go-file" x="30" y="72">flux-system/</text>
<text class="go-small go-start go-file" x="30" y="87">shop.yaml</text>
<text class="go-small go-start go-file" x="21" y="102">charts/shop/</text>
<text class="go-small go-start go-file" x="30" y="117">Chart.yaml</text>
<text class="go-small go-start go-file" x="30" y="132">values-production.yaml</text>
<text class="go-small go-start go-file" x="30" y="147">templates/</text>
<rect class="go-cluster" x="176" y="24" width="220" height="226" rx="3"/>
<rect class="go-box go-agent" x="186" y="30" width="200" height="34" rx="3"/>
<text class="go-name" x="286.0" y="45.0">GitRepository: flux-system</text>
<text class="go-small" x="286.0" y="56.0">fetches deploy.git</text>
<rect class="go-box go-agent" x="186" y="84" width="200" height="34" rx="3"/>
<text class="go-name" x="286.0" y="99.0">Kustomization: flux-system</text>
<text class="go-small" x="286.0" y="110.0">applies clusters/production/</text>
<rect class="go-box go-agent" x="186" y="138" width="200" height="34" rx="3"/>
<text class="go-name" x="286.0" y="153.0">HelmRelease: shop</text>
<text class="go-small" x="286.0" y="164.0">chart: ./charts/shop</text>
<rect class="go-box" x="186" y="192" width="200" height="48" rx="3"/>
<text class="go-name" x="286.0" y="208.5">namespace shop</text>
<text class="go-small" x="286.0" y="219.5">Deployment and Service,</text>
<text class="go-small" x="286.0" y="230.5">installed as a Helm release</text>
<line class="go-arrow go-hot" x1="286" y1="65" x2="286" y2="82" marker-end="url(#gc-head)"/>
<text class="go-small go-start go-hotlabel" x="291" y="76.5">artifact</text>
<line class="go-arrow go-hot" x1="286" y1="119" x2="286" y2="136" marker-end="url(#gc-head)"/>
<text class="go-small go-start go-hotlabel" x="291" y="130.5">applies shop.yaml</text>
<line class="go-arrow go-hot" x1="286" y1="173" x2="286" y2="190" marker-end="url(#gc-head)"/>
<text class="go-small go-start go-hotlabel" x="291" y="184.5">helm install, upgrade</text>
<polyline class="go-link" points="95,69 152,69 185,47"/>
<polyline class="go-link" points="152,69 185,101"/>
<polyline class="go-link" points="80,84 152,84 185,155"/>
<polyline class="go-link" points="86,99 152,99 185,214"/>
</svg>
</div>

<p class="bitgrid-caption">Dashed lines show which files in git each object comes from. Bootstrap writes the first two, the team commits <code>shop.yaml</code>, and everything below the first object is applied by Flux itself.</p>

Raising the shop to 3 copies is then the change from earlier: edit `values-production.yaml` and merge. Because of `reconcileStrategy: Revision`, the new commit produces a new chart artifact, and the helm controller upgrades the release [@flux-helmchart, @flux-helm-controller].

If the chart lived in a separate repository, the team would commit a second `GitRepository` next to `shop.yaml` and point `sourceRef` at it instead [@flux-helmreleases]:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: shop-chart
  namespace: flux-system
spec:
  interval: 1m               # how often to check for new commits
  url: https://git.example.com/team/shop-chart.git
  ref:
    branch: main
```

### Creating Flux's objects

- **Commit the YAML** to the cluster's folder. That's the normal way, and the only one that keeps git a full record.
- **Generate it with `flux create ... --export`**, which prints the YAML instead of applying it, then commit the file [@flux-create-helmrelease, @flux-get-started]. The generated `HelmRelease` still needs the `valuesFiles` and `reconcileStrategy` lines added by hand:

  ```bash
  flux create helmrelease shop \
    --namespace=shop \
    --source=GitRepository/flux-system.flux-system \
    --chart=./charts/shop \
    --export > clusters/production/shop.yaml
  ```

- **`flux create` without `--export`**, or `kubectl apply`, creates the object straight in the cluster [@flux-create-source-git]. That works, but then the cluster has something git doesn't, the same problem as an Argo CD `Application` made in the web UI.

### How Flux's controllers fit together

<div class="gitops-flow" role="img" aria-label="Flux's controllers inside one cluster. The source controller fetches the git repository named in a GitRepository and packages it as an artifact. The kustomize controller applies manifests from that artifact for each Kustomization, and the helm controller runs Helm installs and upgrades for each HelmRelease. Each cluster usually runs its own Flux.">
<svg viewBox="0 0 400 186" aria-hidden="true" focusable="false">
<defs><marker id="gf-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="go-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="go-box" x="8" y="74" width="70" height="32" rx="3"/>
<text class="go-name" x="43.0" y="93.5">git repo</text>
<rect class="go-cluster" x="96" y="6" width="298" height="174" rx="3"/>
<text class="go-small" x="245" y="174">one cluster, with its own Flux</text>
<rect class="go-box go-agent" x="108" y="64" width="108" height="52" rx="3"/>
<text class="go-name" x="162.0" y="82.5">source controller</text>
<text class="go-small" x="162.0" y="93.5">GitRepository</text>
<text class="go-small" x="162.0" y="104.5">fetches, packages</text>
<rect class="go-box go-agent" x="254" y="16" width="128" height="52" rx="3"/>
<text class="go-name" x="318.0" y="34.5">kustomize controller</text>
<text class="go-small" x="318.0" y="45.5">Kustomization</text>
<text class="go-small" x="318.0" y="56.5">applies manifests</text>
<rect class="go-box go-agent" x="254" y="100" width="128" height="52" rx="3"/>
<text class="go-name" x="318.0" y="118.5">helm controller</text>
<text class="go-small" x="318.0" y="129.5">HelmRelease</text>
<text class="go-small" x="318.0" y="140.5">Helm install, upgrade</text>
<line class="go-arrow go-hot" x1="107" y1="90" x2="79" y2="90" marker-end="url(#gf-head)"/>
<text class="go-small go-hotlabel go-end" x="104" y="82">fetch</text>
<line class="go-arrow" x1="217" y1="80" x2="252" y2="48" marker-end="url(#gf-head)"/>
<line class="go-arrow" x1="217" y1="100" x2="252" y2="122" marker-end="url(#gf-head)"/>
<text class="go-small go-start" x="222" y="94">artifact</text>
</svg>
</div>

<p class="bitgrid-caption">Flux splits the work across controllers that pass an artifact along. There's no central server, and each cluster usually runs its own copy.</p>

### Watching the shop change

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
