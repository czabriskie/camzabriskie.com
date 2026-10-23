---
title: Self-service environment platforms
description: How a platform turns "I need a copy of our product" into a running environment without a ticket, for a developer, a partner, or a paying customer, and why keeping the copies alike is harder than making them.
order: 2
updated: 2026-10-23
---

A small company sells an invoicing app called Ledgerly. In the same week three people ask for their own copy of it. A developer wants one to try a change before it merges. A partner building an integration wants a sandbox they can poke at for a month. And sales has just signed Acme, a customer who will only buy if their data sits in an environment nobody else shares. Today each request is a ticket to the only engineer who knows how to build an environment, and each one takes a few days of their time.

A **self-service environment platform** replaces those few days with a form, a command, or a pull request. The person asking fills in what they need, and automation builds the environment, deploys the app into it, and hands back a URL and a login. Nobody on the platform team has to touch it. The CNCF's white paper on platforms gives this as a defining property: users "must be able to request and receive capabilities autonomously and automatically," and one of the more mature things a platform can offer is complete environments built from templates [@cncf-platforms].

This primer follows Ledgerly's three requests through one such platform. It doesn't assume you've built one, and it stays at the level of how the pieces fit, with tool names as examples rather than recommendations.

## A few terms

- **Environment**: one complete, running copy of the product, with everything it needs to work: the app, its database, its storage, its network, its web address. "Staging" and "production" are environments. So is Acme's copy.
- **Tenant**: whoever an environment, or a slice of one, belongs to. For a customer it's usually a whole company; inside a company it might be a team [@k8s-multi-tenancy]. In everyday speech a tenant rents an apartment, and the software sense is close: they use a space someone else owns and runs.
- **Platform engineering**: building and running the internal tools other engineers use to ship, treated as a product with its own users [@cncf-platforms, @ms-platform-engineering]. The self-service platform is one of those products.
- **Internal developer platform** (IDP): Microsoft's name for the platform a platform team builds for its own company's developers [@ms-platform-engineering]. People also say "IDP" for an identity provider, which is unrelated.
- **Golden path** (or **paved path**): the recommended, supported way to do a common job, packaged as a template plus docs, so the easy way and the right way are the same way [@cncf-platforms, @ms-platform-engineering].
- **Infrastructure as code** (IaC): describing servers, networks, and databases in files that a tool reads and creates for you. Terraform and OpenTofu are the common ones [@opentofu-intro].
- **Control plane**: software that takes a description of what should exist and keeps making it true [@crossplane-intro]. In a SaaS business it also means the shared services that onboard, manage, and bill tenants, as opposed to the **application plane**, the product itself [@aws-saas-control-plane]. Both senses show up below and they overlap.
- **GitOps**: keeping the desired state of a deployment in git and letting an agent apply it. The [GitOps primer](/primers/deployment/gitops-argo-cd-and-flux/) covers it.

## Where you'll meet it

You may already have used one of these without calling it a platform:

- **Preview environments** (GitLab calls them review apps): every pull request gets its own temporary deploy, linked from the pull request, and it's torn down when the pull request closes or after a set idle time [@gitlab-review-apps]. Argo CD can do the same thing from Kubernetes by generating one deployment per open pull request [@argocd-pr-generator].
- **Developer portals** like Backstage, where an engineer picks a template from a list, fills in a form, reviews it, and clicks Create [@backstage-templates].
- **Cloud account vending**: AWS's Account Factory for Terraform creates a new, pre-configured AWS account when someone commits an account request file to git [@aws-aft].
- **SaaS sign-up**: when a business customer signs up and gets their own workspace, the code behind that button is doing **tenant onboarding**, provisioning and configuring everything a new tenant needs, and AWS notes it can be started by the customer or by the provider [@aws-saas-lens-onboarding].

Ledgerly's platform has to do all four jobs, and underneath they're the same machine with different settings.

## One request, step by step

Acme's request goes through the platform like this. The developer's and the partner's requests take the same path with different settings.

<div class="selfserve-diagram" role="img" aria-label="A flow from top to bottom. Three requesters, a developer, a partner team, and sales on behalf of a customer, send a request to one front door, which can be a portal, an API, or a pull request. Step 2: the front door records the environment in the control plane. Step 3: the control plane runs infrastructure as code to create the cloud account, network, and database. Step 4: it runs app delivery to deploy the app. Both land in the new environment, acme, at acme.app.example.com. Step 5: the platform hands the URL and a login back to whoever asked.">
<svg viewBox="0 0 410 272" aria-hidden="true" focusable="false">
<defs><marker id="ssp-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ssp-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="ssp-box" x="10" y="8" width="118" height="26" rx="3"/>
<text class="ssp-name" x="69" y="24">developer</text>
<rect class="ssp-box" x="140" y="8" width="118" height="26" rx="3"/>
<text class="ssp-name" x="199" y="24">partner team</text>
<rect class="ssp-box" x="270" y="8" width="118" height="26" rx="3"/>
<text class="ssp-name" x="329" y="24">sales, for Acme</text>
<line class="ssp-arrow" x1="69" y1="35" x2="168" y2="54" marker-end="url(#ssp-head)"/>
<line class="ssp-arrow" x1="199" y1="35" x2="199" y2="54" marker-end="url(#ssp-head)"/>
<line class="ssp-arrow ssp-hot" x1="329" y1="35" x2="230" y2="54" marker-end="url(#ssp-head)"/>
<text class="ssp-small ssp-start" x="300" y="52">1 request</text>
<rect class="ssp-box" x="140" y="56" width="118" height="32" rx="3"/>
<text class="ssp-name" x="199" y="70">front door</text>
<text class="ssp-small" x="199" y="81">portal, API, or PR</text>
<line class="ssp-arrow ssp-hot" x1="199" y1="89" x2="199" y2="106" marker-end="url(#ssp-head)"/>
<text class="ssp-small ssp-start" x="205" y="101">2 record</text>
<rect class="ssp-box ssp-core" x="140" y="108" width="118" height="32" rx="3"/>
<text class="ssp-name" x="199" y="122">control plane</text>
<text class="ssp-small" x="199" y="133">env list, runs steps</text>
<line class="ssp-arrow ssp-hot" x1="139" y1="130" x2="80" y2="158" marker-end="url(#ssp-head)"/>
<text class="ssp-small ssp-end" x="118" y="132">3 provision</text>
<line class="ssp-arrow ssp-hot" x1="259" y1="130" x2="318" y2="158" marker-end="url(#ssp-head)"/>
<text class="ssp-small ssp-start" x="280" y="132">4 deploy</text>
<rect class="ssp-box" x="20" y="160" width="120" height="32" rx="3"/>
<text class="ssp-name" x="80" y="174">infrastructure as code</text>
<text class="ssp-small" x="80" y="185">account, network, DB</text>
<rect class="ssp-box" x="258" y="160" width="120" height="32" rx="3"/>
<text class="ssp-name" x="318" y="174">app delivery</text>
<text class="ssp-small" x="318" y="185">GitOps deploys the app</text>
<line class="ssp-arrow" x1="80" y1="193" x2="80" y2="210" marker-end="url(#ssp-head)"/>
<line class="ssp-arrow" x1="318" y1="193" x2="318" y2="210" marker-end="url(#ssp-head)"/>
<rect class="ssp-env" x="20" y="212" width="358" height="54" rx="3"/>
<text class="ssp-name" x="199" y="226">environment: acme</text>
<rect class="ssp-box" x="32" y="234" width="76" height="22" rx="2"/>
<text class="ssp-small" x="70" y="248">account</text>
<rect class="ssp-box" x="116" y="234" width="76" height="22" rx="2"/>
<text class="ssp-small" x="154" y="248">network</text>
<rect class="ssp-box" x="200" y="234" width="76" height="22" rx="2"/>
<text class="ssp-small" x="238" y="248">database</text>
<rect class="ssp-box ssp-core" x="284" y="234" width="82" height="22" rx="2"/>
<text class="ssp-small" x="325" y="248">app</text>
<path class="ssp-link" d="M379,239 H398 V21 H390" marker-end="url(#ssp-head)"/>
<text class="ssp-small ssp-hotlabel" x="0" y="0" transform="translate(386 92) rotate(90)">5 hand off URL, login</text>
</svg>
</div>

<p class="bitgrid-caption">Three kinds of requester share one front door. Teal arrows follow Acme's request. The platform team builds steps 2 to 5 once and every request reuses them.</p>

1. **Request.** Someone from sales opens the platform's form and picks the "dedicated customer" template, then fills in a name (`acme`), a region, and a size.
2. **Record.** The platform writes that down as a new environment in its list. Often the record is a small file committed to git, so every environment that exists has a reviewed line somewhere saying why. AWS's account factory works this way: the account request is a Terraform file pushed with a plain `git push` [@aws-aft].
3. **Provision.** The control plane runs the infrastructure step: a cloud account or a namespace for Acme, a network, a database, storage, a DNS name like `acme.app.example.com`, a certificate for it.
4. **Deploy.** It points app delivery at the new environment, and the same Ledgerly release every other customer runs gets deployed there.
5. **Hand off.** It creates Acme's first admin user, and the platform sends the URL and login back to whoever asked.

Step 1's record might look like this. The format is made up, because every platform invents its own, but they all carry roughly these fields:

```yaml
# environments/acme.yaml
name: acme
template: dedicated-customer   # which golden path to follow
owner: sales@example.com       # who to ask before deleting it
region: us-east
size: medium
release: 2026.10.2             # app version; usually the same for every tenant
expires: never                 # a preview might say 7d, a partner sandbox 30d
```

The `template` line is the golden path at work. The person filling in the form doesn't choose a database engine or a network layout; the template already chose, and the platform team keeps those choices in one place.

## The layers

Each step in the diagram is a layer you can build or buy separately. The CNCF white paper lists the capabilities a platform tends to offer and gives open-source examples for each [@cncf-platforms]. The ones an environment platform needs are these:

| Layer | Its job | Common choices |
|---|---|---|
| Front door | Where people ask: a web form, a CLI, an API, or a pull request | Backstage software templates [@backstage-templates, @backstage-overview], a small internal web app, or just a git repository |
| Environment record | The list of environments that should exist, with their settings | Files in git, rows in a database, or Kubernetes objects |
| Orchestration | Runs the steps in order, retries, reports progress | A CI pipeline, Crossplane [@crossplane-intro], or a workflow engine |
| Infrastructure | Accounts, networks, databases, DNS, certificates | Terraform or OpenTofu modules [@terraform-modules, @opentofu-intro], Crossplane compositions [@crossplane-compositions] |
| App delivery | Puts the right release of the app into the environment | Argo CD or Flux ([GitOps primer](/primers/deployment/gitops-argo-cd-and-flux/)) |
| Identity and secrets | Logins for people, credentials for the app | An identity provider, a secrets store |
| Observability and cost | Is it healthy, and what is it costing | Metrics and logs per environment, cost tagged per environment |

The infrastructure layer comes in two styles, and the choice shapes the orchestration layer too.

**Run a tool per environment.** A pipeline runs Terraform or OpenTofu with that environment's settings. A **module** is a reusable bundle of resources, and HashiCorp's guidance for building the same kind of thing again and again, "such as networking resources for new development environments," is to write one module and reuse it [@terraform-modules]. Each environment then gets its own small configuration that calls the module and its own **state** (Terraform's record of what it created). Terraform also has a feature called workspaces that looks like it should give one copy per tenant, but its own docs say workspaces share one backend and credentials, so they aren't a suitable boundary between deployments that need different access controls; the suggested alternative is the module plus a separate configuration per instance [@terraform-workspaces].

**Run a control plane that never stops.** Crossplane adds your own object types to Kubernetes, say a `LedgerlyEnvironment`, and when someone creates one it builds every resource the template lists, then keeps watching and puts things back if they drift [@crossplane-intro, @crossplane-compositions]. Creating a tenant becomes creating one object, and deleting it removes the rest. That's the same reconcile loop GitOps uses, applied to infrastructure.

The first style is easier to start with and easier to read. The second gives you one API for "make an environment" that the front door can call, and drift correction for free, at the cost of running Kubernetes and learning Crossplane.

## How separate is each copy?

"A fresh version of the environment" can mean very different amounts of separation. AWS's SaaS guidance names the two ends: in the **silo** model a tenant gets dedicated resources, anything from its own database up to a fully independent stack, and in the **pool** model tenants share the same resources [@aws-saas-lens-models]. The **bridge** model sits between them: some parts of the system siloed, some pooled, chosen per component [@aws-saas-lens-models]. Silos are simpler to isolate and keep a failure inside one tenant; pools cost less and give one place to manage and deploy [@aws-saas-silo-isolation, @aws-saas-pool-isolation].

A platform that "spins up a fresh environment" is building silos, at least for some tenants, and AWS describes a common mix: basic-tier tenants share a pool, and premium tenants pay for their own stack [@aws-saas-full-stack]. The [customer separation primer](/primers/deployment/customer-separation-models/) walks through the options from one end to the other.

## Three requests, three sets of settings

Ledgerly's three requesters want the same machine with different settings. These defaults are a reasonable starting point, not rules:

| | Developer preview | Partner sandbox | Customer (Acme) |
|---|---|---|---|
| Lifetime | Until the pull request closes, or a week idle [@gitlab-review-apps] | Weeks to months, with an end date | Until the contract ends |
| Separation | Namespace in a shared cluster | Namespace, network-separated from internal tools | Own account or cluster |
| Data | Seeded fake data | Seeded fake data, reset on request | The customer's own; backed up |
| App version | The branch being tested | The current release | The current release |
| Who logs in | Engineers | The partner's people | The customer's people |
| Who pays | Engineering budget | Partnerships budget | Comes out of the customer's price |
| Failure cost | Low | Embarrassing | Contractual |

The rows that differ most are lifetime, data, and who logs in. Those become fields in the template, and the rest of the machine stays the same.

## Day two: keeping the copies alike

Making the first copy is the easy half. **Day two** is everything after: upgrades, certificate renewals, security patches, backups, and eventually deletion, now multiplied by every copy that exists.

Even when premium tenants get their own stack, those stacks shouldn't allow "any one-off variation or customization." Every silo runs the same configuration and the same version, and a new release goes to the pool and every silo [@aws-saas-full-stack]. AWS draws the line between SaaS and a **managed service provider**: an MSP automates installing each customer's environment but lets each one run whatever version that customer wants, and treats them as separate operations. AWS's summary is that "automating the install of environments does not equate to having a SaaS environment" [@aws-saas-msp]. A platform that can create Acme's copy but upgrades it by hand is the MSP model, whatever it's called.

So a few rules tend to fall out:

- **One release field, one value.** Customer environments all point at the same release, and the platform rolls a new one out in waves, internal first, then partners, then customers, the same way it rolls anything out.
- **No hand edits.** A change to one environment goes through its record and the template, or it drifts. The reconcile loop in GitOps and Crossplane is the tool that keeps this true.
- **Customization is configuration.** If Acme needs a feature switched on, that's a flag in their record that every environment understands, not a fork of the code.
- **Every environment has an end.** Previews expire on a timer [@gitlab-review-apps] or when their pull request closes [@argocd-pr-generator], sandboxes get an end date, and deleting a customer's environment is a supported, tested path rather than an afternoon of clicking. Idle silos cost money every hour they exist [@aws-saas-silo-isolation].
- **The control plane is not multi-tenant.** The platform itself, the list of tenants and the code that onboards and upgrades them, is one shared system that sits outside every tenant [@aws-saas-control-plane]. Guard it accordingly, since it holds the keys to all of them.

## Where to start

The CNCF paper says a platform should be "the thinnest reasonable layer" over services that already exist, and that the simplest possible platform could be a wiki page linking to the steps for provisioning things [@cncf-platforms]. It also lists a progression, starting with developers provisioning single capabilities like a database on demand and ending with complete environments from templates [@cncf-platforms]. A full environment platform sits near the far end of that list, so most teams get there in stages:

1. **Write the environment down.** One template, in IaC, that builds a complete Ledgerly from nothing with no manual steps. Until this exists nothing else can be automated, and finding the manual steps is most of the work.
2. **Make it repeatable.** Run the same template twice with two names and get two working, independent environments. Then delete one cleanly.
3. **Put a front door on it.** A pull request that adds `environments/<name>.yaml` and a pipeline that applies it is already self-service. A portal can come later.
4. **Start with one audience.** Developer previews are the safest first users, because they're short-lived and a broken one costs little. Customers come last.
5. **Measure it.** The CNCF paper suggests tracking the time from request to a usable environment, among other things [@cncf-platforms]. If it's a few days today, watch it drop.

The rest of this series goes from here: [separating customers](/primers/deployment/customer-separation-models/) compares the ways to keep customers apart, then [an AWS account set per customer](/primers/deployment/aws-account-per-customer/) builds the most separated one and [the fully pooled version](/primers/deployment/fully-pooled-saas/) builds the least.

<details class="aside">
<summary>Build or buy?</summary>

Every layer in the table above has both open-source pieces and commercial products, and some vendors sell the whole stack, front door to teardown. The CNCF paper's advice is that platform teams should rely on providers and existing services as much as possible and build their own capabilities only when nothing suitable is available [@cncf-platforms]. In practice the layer a company usually ends up owning is the template itself, because only that company knows what a complete copy of its product contains.

</details>
