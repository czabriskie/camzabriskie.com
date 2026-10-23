---
title: Separating customers, from own cluster to fully pooled
description: The ways to keep SaaS customers apart once they stop getting their own accounts, from a namespace per customer in a shared Kubernetes cluster down to one app and one database for everyone, and what each one asks of the app.
order: 4
updated: 2026-10-23
---

The [account-per-customer primer](/primers/deployment/aws-account-per-customer/) gave every customer their own AWS accounts and clusters. That's the strongest separation and the most expensive, and most SaaS products don't give it to every customer. This primer walks down the rest of the scale from the [self-service environments primer](/primers/deployment/self-service-environments/), one rung at a time, to the least separated version: everyone sharing one app and one database.

The running example is still Ledgerly, the made-up invoicing app on Kubernetes. Acme pays for its own accounts. Three smaller customers, Birch, Cedar, and Dune, have signed a cheaper plan, and Ledgerly has to decide how much of the platform they share.

## A few terms

- **Tenant**: one customer, as the system sees them. Here, Birch, Cedar, and Dune are three tenants.
- **Compute and data**: the two halves that can be separated independently. Compute is where the app runs (pods, nodes, clusters). Data is where it stores things (databases, buckets).
- **Silo, pool, bridge**: AWS's names for dedicated resources per tenant, shared resources, and a mix of the two chosen per component [@aws-saas-lens-models]. The rest of this primer is about where on that line each piece goes.
- **Soft and hard multi-tenancy**: in Kubernetes, *soft* means tenants share a cluster and are kept apart with namespaces, roles, quotas, and network policies; *hard* means each tenant gets a separate cluster [@aws-eks-tenant-isolation].
- **Noisy neighbor**: one tenant's load slowing down others who share a resource with them [@aws-saas-lens-noisy-neighbor].
- **Blast radius**: how many tenants one failure or one breach reaches.
- **Tenant context**: the answer to "which customer is this request for?", carried with every request once the app serves more than one customer [@aws-saas-lens-identity].
- **Row-level security** (RLS): a PostgreSQL feature that filters which rows a query can see or change, according to a policy on the table [@postgres-rls].

## The rungs

Each rung down shares one more thing. The first two keep a copy of the app per customer; from the third rung on, one copy of the app serves several customers.

| Rung | Each customer gets | Shared with other customers | One copy of the app per customer? |
|---|---|---|---|
| Own accounts | Accounts, cluster, database | The platform and the release | Yes |
| Own cluster | Cluster, database | The AWS account | Yes |
| Namespace per customer | Namespace, database | Cluster and nodes | Yes |
| Shared app, own data | A database or schema | Cluster, nodes, the running app | No |
| Fully pooled | Rows with their tenant ID | Everything | No |

Through the namespace rung, each copy of Ledgerly serves exactly one customer, so the app's code doesn't need to know customers exist; the platform keeps them apart. From the shared-app rung down, the app itself has to keep them apart, which makes it a change to the product, not just the platform.

<div class="selfserve-diagram" role="img" aria-label="Three panels compare the lower rungs for customers birch, cedar, and dune. Namespace per customer: one cluster holds three namespaces, each running its own copy of the app, and each copy has its own database below. Shared app, own data: one cluster runs one tenant-aware app, which uses one database server holding a separate schema for each customer. Fully pooled: one cluster runs one tenant-aware app, which uses one shared invoices table where every row carries a tenant ID.">
<svg viewBox="0 0 400 200" aria-hidden="true" focusable="false">
<text class="ssp-name" x="68" y="12">namespace per customer</text>
<text class="ssp-name" x="200" y="12">shared app, own data</text>
<text class="ssp-name" x="332" y="12">fully pooled</text>
<rect class="ssp-env" x="8" y="22" width="120" height="84" rx="3"/>
<text class="ssp-small" x="68" y="31">shared cluster</text>
<rect class="ssp-box" x="12" y="36" width="36" height="58" rx="2"/>
<text class="ssp-small" x="30" y="49">birch</text>
<rect class="ssp-box ssp-core" x="16" y="62" width="28" height="18" rx="2"/>
<text class="ssp-small" x="30" y="74">app</text>
<rect class="ssp-box" x="50" y="36" width="36" height="58" rx="2"/>
<text class="ssp-small" x="68" y="49">cedar</text>
<rect class="ssp-box ssp-core" x="54" y="62" width="28" height="18" rx="2"/>
<text class="ssp-small" x="68" y="74">app</text>
<rect class="ssp-box" x="88" y="36" width="36" height="58" rx="2"/>
<text class="ssp-small" x="106" y="49">dune</text>
<rect class="ssp-box ssp-core" x="92" y="62" width="28" height="18" rx="2"/>
<text class="ssp-small" x="106" y="74">app</text>
<line class="ssp-arrow" x1="30" y1="95" x2="30" y2="138"/>
<line class="ssp-arrow" x1="68" y1="95" x2="68" y2="138"/>
<line class="ssp-arrow" x1="106" y1="95" x2="106" y2="138"/>
<rect class="ssp-box" x="12" y="140" width="36" height="26" rx="2"/>
<text class="ssp-small" x="30" y="156">db</text>
<rect class="ssp-box" x="50" y="140" width="36" height="26" rx="2"/>
<text class="ssp-small" x="68" y="156">db</text>
<rect class="ssp-box" x="88" y="140" width="36" height="26" rx="2"/>
<text class="ssp-small" x="106" y="156">db</text>
<text class="ssp-small" x="68" y="184">a database each</text>
<rect class="ssp-env" x="140" y="22" width="120" height="84" rx="3"/>
<text class="ssp-small" x="200" y="31">shared cluster</text>
<rect class="ssp-box ssp-core" x="152" y="42" width="96" height="40" rx="2"/>
<text class="ssp-name" x="200" y="59">app</text>
<text class="ssp-small" x="200" y="72">tenant-aware</text>
<line class="ssp-arrow" x1="200" y1="83" x2="200" y2="128"/>
<rect class="ssp-env" x="140" y="128" width="120" height="44" rx="3"/>
<rect class="ssp-box" x="144" y="134" width="36" height="22" rx="2"/>
<text class="ssp-small" x="162" y="148">birch</text>
<rect class="ssp-box" x="182" y="134" width="36" height="22" rx="2"/>
<text class="ssp-small" x="200" y="148">cedar</text>
<rect class="ssp-box" x="220" y="134" width="36" height="22" rx="2"/>
<text class="ssp-small" x="238" y="148">dune</text>
<text class="ssp-small" x="200" y="167">one server</text>
<text class="ssp-small" x="200" y="184">a schema each</text>
<rect class="ssp-env" x="272" y="22" width="120" height="84" rx="3"/>
<text class="ssp-small" x="332" y="31">shared cluster</text>
<rect class="ssp-box ssp-core" x="284" y="42" width="96" height="40" rx="2"/>
<text class="ssp-name" x="332" y="59">app</text>
<text class="ssp-small" x="332" y="72">tenant-aware</text>
<line class="ssp-arrow" x1="332" y1="83" x2="332" y2="128"/>
<rect class="ssp-env" x="272" y="128" width="120" height="44" rx="3"/>
<rect class="ssp-box" x="280" y="134" width="104" height="22" rx="2"/>
<text class="ssp-small" x="332" y="148">invoices table</text>
<text class="ssp-small" x="332" y="167">one server</text>
<text class="ssp-small" x="332" y="184">tenant_id on each row</text>
</svg>
</div>

<p class="bitgrid-caption">Teal marks running copies of the app. Moving right, there are fewer of them and less in the database for each customer, and the app has to do more of the separating.</p>

## Own cluster in a shared account

This rung is the account-per-customer setup with the account boundary removed: every customer still gets their own EKS cluster and database, but they live in one AWS account. The EKS guide calls a cluster per tenant hard multi-tenancy and says the cluster is "the only construct that provides a strong security boundary" in Kubernetes [@aws-eks-tenant-isolation].

Removing the account boundary loses the things accounts gave you: a separate bill per customer, separate service quotas, and a hard IAM wall [@aws-multi-account-benefits]. A mistake in one IAM policy in the shared account can now reach several customers' resources. It keeps the cost of the account-per-customer setup too: the EKS guide warns that a cluster per tenant gets expensive with many tenants, since each cluster's control plane is paid for separately and compute can't be shared between clusters, and that it needs tooling to manage many clusters [@aws-eks-tenant-isolation]. So this rung is mostly a stepping stone, or a place for customers who need their own cluster but not their own bill.

## Namespace per customer

The cluster is shared and each customer gets a **namespace**, a named slice of the cluster that most Kubernetes objects live inside. Birch's copy of Ledgerly runs in namespace `birch`, Cedar's in `cedar`. Each copy still serves one customer, so the app doesn't change; the platform's onboarding step creates a namespace instead of an account.

A namespace on its own keeps nothing apart. The EKS guide lists the pieces that turn it into a tenant boundary, which it calls soft multi-tenancy [@aws-eks-tenant-isolation]:

| Piece | What it stops | Per namespace |
|---|---|---|
| RBAC roles and role bindings | People and service accounts touching another tenant's objects [@aws-eks-tenant-isolation] | A Role and RoleBinding |
| Resource quota | One tenant using up the cluster's CPU, memory, or object count [@k8s-resource-quotas] | A ResourceQuota |
| Limit range | One pod taking all of its namespace's quota, and pods with no limits set [@k8s-limit-range] | A LimitRange |
| Network policy | Pods in one namespace talking to another's | A default-deny policy, plus allow rules |
| IAM role for the app | One customer's app reading another's bucket or database | A service account tied to its own IAM role (Pod Identity [@aws-eks-pod-identity]) |
| Its own database | Data mixing | An RDS instance or database per customer |

Network policies need the most care. By default every pod in a cluster can reach every other pod, and the EKS guide recommends starting from a rule that denies all pod-to-pod traffic, plus one that lets pods reach the DNS server, then adding narrower allow rules [@aws-eks-tenant-isolation]. Policies only take effect if the cluster's network plugin enforces them [@k8s-network-policies]; on EKS, the VPC CNI plugin supports them [@aws-eks-network-policy]. The default-deny policy for Birch's namespace looks like this:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: birch
spec:
  podSelector: {}          # every pod in the namespace
  policyTypes: [Ingress, Egress]
  # no rules listed, so nothing is allowed in or out
```

Next to it go a policy allowing egress to the cluster DNS, one allowing traffic from the ingress controller, and one allowing egress to Birch's database.

### What a namespace doesn't separate

None of the pieces above stop pods from different tenants landing on the same node, and the EKS guide points out that an attacker who gets onto a node can read the Secrets, ConfigMaps, and volumes mounted there [@aws-eks-tenant-isolation]. Other things stay shared too:

- **Cluster-wide objects.** Some Kubernetes objects, like custom resource definitions, can't live in a namespace, so every tenant shares them [@k8s-multi-tenancy].
- **The list of tenants.** Anyone allowed to see one namespace can see all of them, and by default any pod can look up every service in the cluster through DNS [@aws-eks-tenant-isolation]. Ledgerly's customers don't run their own pods, so this matters less than it would for a platform that runs customer code.
- **Upgrades and outages.** One cluster upgrade touches every customer at once, and a broken control plane takes them all down together.

The guide's mitigations are to pin each tenant's pods to their own nodes with node affinity and taints, which it warns gets complicated and expensive with many tenants, and to run containers in sandboxes or enforce rules with a policy engine such as OPA Gatekeeper or Kyverno [@aws-eks-tenant-isolation, @k8s-runtime-class].

### What it buys

Onboarding Birch now means creating a namespace, its policies, and a database, which is much quicker than building a cluster [@aws-eks-tenant-isolation]. Compute is shared, so three small customers can fill one set of nodes rather than idling on three clusters. And the platform from the earlier primers barely changes: the customer file points at a namespace instead of an account, and Argo CD deploys one copy per namespace the same way it deployed one per cluster.

## Shared app, separate data

Here the copies of the app collapse into one. A single Ledgerly deployment serves Birch, Cedar, and Dune, and each request carries its tenant context. Data is still separated: each customer has their own database or schema.

For PostgreSQL, AWS's guidance calls this the bridge model: one database server, with tenants separated by a PostgreSQL database each or a schema each [@aws-postgres-bridge]. The app has to keep a mapping from tenant to database or schema and connect to the right one for every request [@aws-postgres-bridge]. Noisy neighbors come back, because everyone's queries share one server, and onboarding still means creating a database or schema per tenant [@aws-postgres-bridge].

This rung adds tenant context. AWS's SaaS guidance recommends binding each user to a tenant at sign-in, so the tenant ID travels in the user's token, for example as a claim in a JSON Web Token, and every service can read it without asking another service [@aws-saas-lens-identity]. Ledgerly's login would issue a token saying `tenant: birch`, and the app uses that, never a value the browser could change, to pick Birch's schema.

## Fully pooled

The least separated rung. One deployment, one database, one set of tables, and every row carries a `tenant_id`. Adding Dune is adding a row to a `tenants` table.

AWS's PostgreSQL guidance calls row-level security required for this model [@aws-postgres-rls]. Without it, every query in the codebase has to remember `WHERE tenant_id = …`, and one forgotten clause shows one customer another's invoices. With it, the database adds the filter itself. The recommended pattern sets a per-session variable to the current tenant and writes the policy against it, rather than creating a database user per tenant [@aws-postgres-rls]:

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON invoices
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- the app, at the start of each request, from the tenant in the user's token:
SET app.current_tenant = '6f1c…';   -- Birch's tenant ID
SELECT * FROM invoices;             -- only Birch's rows come back
```

Three details from the PostgreSQL docs decide whether the policy protects anything [@postgres-rls]:

- With RLS on and no policy, the table denies everything.
- Superusers and roles with `BYPASSRLS` always skip the policies.
- The table's owner skips them too unless the table is set to `FORCE ROW LEVEL SECURITY`.

So the app must connect as an ordinary role that doesn't own the tables, or the policy quietly does nothing.

According to AWS, pooling is the cheapest and simplest to run and makes onboarding fast because no infrastructure is created [@aws-postgres-pool]. But noisy neighbors can be reduced, not eliminated; seeing which tenant is using what needs instrumentation in the app, since the database doesn't know about tenants; and some customers won't accept rows in a shared table as separation [@aws-postgres-pool]. An outage of the shared database is an outage for every customer [@aws-saas-pool-isolation].

## Side by side

| | Own cluster | Namespace | Shared app, own data | Fully pooled |
|---|---|---|---|---|
| Adding a customer | Build a cluster and database | Namespace, policies, database | A database or schema | A row |
| App knows about tenants | No | No | Yes | Yes |
| Where separation lives | The cluster boundary | Kubernetes policies | App picks the schema; the database keeps them apart | App sets the tenant; RLS filters |
| Noisy neighbors | None in compute | Shared nodes, capped by quotas | Shared app and database server | Everything shared |
| One failure reaches | One customer | Every customer, if it's the cluster | Every customer | Every customer |
| Cost per extra customer | A cluster | A namespace's share of nodes, a database | A schema | Close to nothing |
| What a security review hears | Separate infrastructure | Separate namespaces and policies on shared nodes | Separate schemas in a shared server | Rows filtered by the database |

## Mixing rungs

Most SaaS products end up on more than one rung. AWS describes the common shape: basic-tier tenants in a pooled environment and premium tenants with their own stacks, all on the same version [@aws-saas-full-stack]. The bridge model also works per component, with some services pooled and others siloed depending on their data and load [@aws-saas-bridge-isolation].

For Ledgerly that could mean Acme in its own accounts, Birch, Cedar, and Dune pooled, and a regulated customer next year somewhere in between. Two choices make that mix manageable:

- **Make the app tenant-aware even where it serves one tenant.** If every copy reads tenant context from the token, a siloed copy is just a pooled deployment that happens to hold one customer, and moving a customer between rungs is a data migration, not a code change.
- **Keep one release.** The pooled environment and every siloed one run the same version and the same configuration [@aws-saas-full-stack], which the platform from the [first primer](/primers/deployment/self-service-environments/) already enforces.

## Choosing a rung

The questions that usually decide it:

1. **What has the customer contract promised?** "Our data never shares a database server with anyone" rules out the bottom two rungs no matter what they'd save.
2. **Does the app know about tenants today?** If not, the namespace rung is the cheapest separation available without changing the product. Moving below it is a project for the application team, not the platform team.
3. **How many customers, and how small?** Silos cost roughly the same whether a customer is big or tiny, so a long tail of small customers is where pooling pays.
4. **Do customers run their own code in the platform?** If they do, shared nodes and a shared cluster become much riskier, and the EKS guide's sandboxing and per-tenant node advice stops being optional [@aws-eks-tenant-isolation].
