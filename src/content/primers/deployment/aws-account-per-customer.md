---
title: An AWS account set per customer
description: How a self-service platform gives each customer its own AWS accounts and EKS clusters, one for production and one for testing, and what it takes to keep dozens of them alike.
order: 4
updated: 2026-10-23
only: AWS
---

The [customer separation primer](/primers/deployment/customer-separation-models/) laid out the options from each customer having their own AWS accounts down to everyone sharing one database. This primer builds the top rung on AWS with Kubernetes on EKS. Each customer gets two AWS accounts: one for production, and one test account where a release is checked against that customer's configuration before it reaches their production.

The running example is the same made-up company. Ledgerly sells an invoicing app, it runs on EKS, and its customers' contracts say their data lives in accounts nobody else uses. Acme has just signed and needs `acme-test` and `acme-prod`. Ledgerly's own engineers develop in internal accounts, so no customer needs a dev account of their own.

## A few terms

- **AWS account**: the basic container for everything in AWS: resources, permissions, and a bill. Two accounts can't touch each other's resources unless someone explicitly allows it [@aws-multi-account-intro]. It's not a login; people and programs get into an account through roles.
- **AWS Organizations**: groups many accounts under one **management account**, which pays every member account's charges on one bill [@aws-consolidated-billing].
- **OU** (organizational unit): a folder of accounts inside an organization. Policies attached to an OU apply to every account in it.
- **SCP** (service control policy): a policy on an OU or account that sets the most any role in it can do. An SCP never grants anything by itself, it only caps what other policies grant, and it doesn't apply to the management account [@aws-scps].
- **IAM role**: a set of permissions that a person or program assumes to get temporary credentials. A role in one account can trust a role in another, which is how work crosses accounts [@aws-iam-cross-account].
- **Control Tower**: AWS's service for setting up and governing a multi-account organization. It builds a **landing zone**, the baseline every account starts from, and applies **controls** (also called guardrails) to keep accounts from drifting [@aws-control-tower].
- **AFT** (Account Factory for Terraform): a Control Tower add-on that creates accounts from Terraform files pushed to git, then runs customization steps on them [@aws-aft, @aws-aft-provision].
- **EKS access entry**: ties an IAM role to a set of Kubernetes permissions in one EKS cluster, which is how something outside the cluster gets to use its API [@aws-eks-access-entries].
- **EKS Pod Identity**: gives an app's pods an IAM role, so the app can call AWS services without stored keys [@aws-eks-pod-identity].

## Why an account per environment

AWS's own guidance on multi-account setups lists the reasons, and most of them line up with what a customer asking for isolation wants [@aws-multi-account-benefits]:

- **A hard boundary.** Resources and data in one account are separated from other accounts by default [@aws-multi-account-benefits]. A mistake in Acme's IAM policies can't expose another customer's data, because none of it is in Acme's account.
- **Different rules for production.** Separate accounts let production and non-production carry different security and operational controls [@aws-multi-account-benefits].
- **Smaller blast radius.** A misconfiguration or a compromise in one account stays in that account [@aws-multi-account-benefits].
- **Separate quotas.** AWS service quotas and API rate limits are per account, so one busy customer doesn't use up another's [@aws-multi-account-benefits].
- **A bill per customer.** An account is AWS's default unit for allocating costs [@aws-multi-account-benefits], and the organization's combined bill still tracks charges per account [@aws-consolidated-billing], which makes "what does Acme cost us" a lookup rather than an estimate.

Accounts themselves cost nothing; AWS charges for what runs in them, not for the number of accounts [@aws-multi-account-intro]. The cost is in running many of them, which the rest of this primer is about.

## Laying out the organization

AWS's recommended layout groups accounts by what they do, not by who owns them. A **Workloads** OU holds business applications, with production and non-production split into child OUs; a **Security** OU holds the accounts that apply security and compliance controls; an **Infrastructure** OU holds shared networking; and a **Deployments** OU holds the accounts that run CI/CD and deploy into everything else [@aws-multi-account-recommended-ous, @aws-multi-account-workloads-ou]. Ledgerly's customer accounts slot into the Workloads OU like this:

<div class="selfserve-diagram" role="img" aria-label="A tree of the organization. The organization root, owned by the management account, has four OUs. The Security OU holds log and audit accounts. The Infrastructure OU holds a network account. The Deployments OU, highlighted, holds the platform account. The Workloads OU has two child OUs: Prod holds acme-prod and globex-prod, and NonProd holds acme-test, globex-test, and Ledgerly's internal ledgerly-dev account.">
<svg viewBox="0 0 400 236" aria-hidden="true" focusable="false">
<rect class="ssp-box" x="8" y="8" width="162" height="26" rx="3"/>
<text class="ssp-name ssp-start" x="16" y="20">organization root</text>
<text class="ssp-small ssp-start" x="16" y="30">management account</text>
<line class="ssp-arrow" x1="20" y1="34" x2="20" y2="153"/>
<line class="ssp-arrow" x1="20" y1="57" x2="30" y2="57"/>
<line class="ssp-arrow" x1="20" y1="89" x2="30" y2="89"/>
<line class="ssp-arrow" x1="20" y1="121" x2="30" y2="121"/>
<line class="ssp-arrow" x1="20" y1="153" x2="30" y2="153"/>
<rect class="ssp-box" x="30" y="46" width="120" height="22" rx="3"/>
<text class="ssp-name ssp-start" x="38" y="61">Security OU</text>
<rect class="ssp-box" x="30" y="78" width="120" height="22" rx="3"/>
<text class="ssp-name ssp-start" x="38" y="93">Infrastructure OU</text>
<rect class="ssp-box ssp-core" x="30" y="110" width="120" height="22" rx="3"/>
<text class="ssp-name ssp-start" x="38" y="125">Deployments OU</text>
<rect class="ssp-box" x="30" y="142" width="120" height="22" rx="3"/>
<text class="ssp-name ssp-start" x="38" y="157">Workloads OU</text>
<line class="ssp-arrow" x1="42" y1="164" x2="42" y2="217"/>
<line class="ssp-arrow" x1="42" y1="185" x2="52" y2="185"/>
<line class="ssp-arrow" x1="42" y1="217" x2="52" y2="217"/>
<rect class="ssp-box" x="52" y="174" width="98" height="22" rx="3"/>
<text class="ssp-name ssp-start" x="60" y="189">Prod OU</text>
<rect class="ssp-box" x="52" y="206" width="98" height="22" rx="3"/>
<text class="ssp-name ssp-start" x="60" y="221">NonProd OU</text>
<line class="ssp-arrow" x1="150" y1="57" x2="168" y2="57"/>
<line class="ssp-arrow" x1="150" y1="89" x2="168" y2="89"/>
<line class="ssp-arrow" x1="150" y1="121" x2="168" y2="121"/>
<line class="ssp-arrow" x1="150" y1="185" x2="168" y2="185"/>
<line class="ssp-arrow" x1="150" y1="217" x2="168" y2="217"/>
<rect class="ssp-env" x="168" y="47" width="146" height="20" rx="2"/>
<text class="ssp-small" x="241" y="60">log + audit accounts</text>
<rect class="ssp-env" x="168" y="79" width="146" height="20" rx="2"/>
<text class="ssp-small" x="241" y="92">network account</text>
<rect class="ssp-box ssp-core" x="168" y="111" width="146" height="20" rx="2"/>
<text class="ssp-small" x="241" y="124">platform account</text>
<rect class="ssp-box" x="168" y="175" width="70" height="20" rx="2"/>
<text class="ssp-small" x="203" y="188">acme-prod</text>
<rect class="ssp-box" x="244" y="175" width="70" height="20" rx="2"/>
<text class="ssp-small" x="279" y="188">globex-prod</text>
<rect class="ssp-box" x="168" y="207" width="70" height="20" rx="2"/>
<text class="ssp-small" x="203" y="220">acme-test</text>
<rect class="ssp-box" x="244" y="207" width="70" height="20" rx="2"/>
<text class="ssp-small" x="279" y="220">globex-test</text>
<rect class="ssp-box" x="320" y="207" width="72" height="20" rx="2"/>
<text class="ssp-small" x="356" y="220">ledgerly-dev</text>
</svg>
</div>

<p class="bitgrid-caption">Customer accounts sort by environment first, so one SCP on the Prod OU covers every customer's production. The platform account (teal) deploys into all of them.</p>

Sorting by environment first, rather than making an OU per customer, means a production rule gets written once and applies to every customer's production account the moment it's created. If one customer needs a rule nobody else has, AWS's layout has an **Exceptions** OU for accounts that deviate from the standard [@aws-multi-account-recommended-ous], though every exception is one more thing to keep track of.

The **platform account** is where the self-service platform itself lives: the pipelines, Argo CD, and the container registry. AWS recommends keeping CI/CD out of workload accounts, partly because deployment tooling needs access to both production and non-production, and running it from a production account would mean letting production reach into non-production [@aws-multi-account-deployments-ou]. Production accounts only need to read finished artifacts, not write them [@aws-multi-account-deployments-ou].

## Onboarding Acme, step by step

Sales signs Acme. The platform's front door is a pull request that adds one file:

```yaml
# customers/acme.yaml
name: acme
environments:
  - name: test
    ou: NonProd
    size: small
  - name: prod
    ou: Prod
    size: medium
region: us-east-1
release: 2026.10.2
```

Once it merges, the pipeline does the rest:

1. **Create the accounts.** For each environment the pipeline writes an AFT account request, a small Terraform file with the account's name, an email address for it, the OU to put it in, and tags, and pushes it to AFT's request repository. AFT creates the account through Control Tower, so it starts with the landing zone's controls [@aws-aft, @aws-aft-provision].
2. **Apply the baseline.** AFT runs customizations, Terraform or scripts, on every account, on a group of accounts, or on one [@aws-aft-customizations]. The baseline every Ledgerly account gets: the roles the platform will assume, a VPC with an address range handed out by IPAM (AWS's IP address manager, which can allocate ranges to new VPCs automatically by rules you set [@aws-ipam], so no two customers' VPCs collide if they ever need connecting), and logging.
3. **Build the environment.** A Terraform module, the same one for every customer, creates the EKS cluster, the database, and storage inside each new account [@terraform-modules].
4. **Register the cluster.** The new cluster is added to Argo CD in the platform account, with an access entry letting the platform's role deploy into it (next section).
5. **Deploy.** Argo CD's ApplicationSet sees a new cluster and generates an `Application` for it [@argocd-cluster-generator], and release `2026.10.2` has already passed in Ledgerly's internal `ledgerly-dev`, so it rolls out to `acme-test`, then to `acme-prod` once Acme's checks pass.

AWS documents step 1's input as a Terraform file and starts processing with a `git push` [@aws-aft-provision], so the whole chain, from merged pull request to running cluster, needs no person in the middle.

## How the platform reaches into each account

Nothing in the platform account can touch Acme's accounts by default. Every crossing is a role that trusts another role, and there are only a few of them:

<div class="selfserve-diagram" role="img" aria-label="Two account boxes side by side. On the left, the platform account holds Argo CD, which runs as a management role, and ECR, the image registry, with a repository policy. On the right, the acme-prod account holds a cluster role, the EKS API server, and the app's pods. Step 1: Argo CD assumes the cluster role across the account boundary. Step 2: an access entry on the EKS API server maps that role to Kubernetes permissions. Step 3: Argo CD syncs the app into the cluster. Step 4: the pods pull their image from ECR in the platform account, allowed by the repository policy.">
<svg viewBox="0 0 400 204" aria-hidden="true" focusable="false">
<defs><marker id="apc-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ssp-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="ssp-env" x="8" y="8" width="160" height="188" rx="3"/>
<text class="ssp-name" x="88" y="24">platform account</text>
<rect class="ssp-env" x="232" y="8" width="160" height="188" rx="3"/>
<text class="ssp-name" x="312" y="24">acme-prod account</text>
<rect class="ssp-box ssp-core" x="20" y="44" width="136" height="32" rx="3"/>
<text class="ssp-name" x="88" y="58">Argo CD</text>
<text class="ssp-small" x="88" y="69">management role</text>
<rect class="ssp-box" x="20" y="148" width="136" height="32" rx="3"/>
<text class="ssp-name" x="88" y="162">ECR</text>
<text class="ssp-small" x="88" y="173">repository policy</text>
<rect class="ssp-box" x="244" y="44" width="136" height="32" rx="3"/>
<text class="ssp-name" x="312" y="58">cluster role</text>
<text class="ssp-small" x="312" y="69">trusts the platform</text>
<rect class="ssp-box" x="244" y="96" width="136" height="32" rx="3"/>
<text class="ssp-name" x="312" y="110">EKS API server</text>
<text class="ssp-small" x="312" y="121">access entry for role</text>
<rect class="ssp-box" x="244" y="148" width="136" height="32" rx="3"/>
<text class="ssp-name" x="312" y="162">app pods</text>
<text class="ssp-small" x="312" y="173">own role, Pod Identity</text>
<line class="ssp-arrow ssp-hot" x1="157" y1="60" x2="242" y2="60" marker-end="url(#apc-head)"/>
<text class="ssp-small ssp-hotlabel" x="200" y="54">1 assume</text>
<line class="ssp-arrow ssp-hot" x1="312" y1="77" x2="312" y2="94" marker-end="url(#apc-head)"/>
<text class="ssp-small ssp-start ssp-hotlabel" x="318" y="89">2 authorize</text>
<line class="ssp-arrow ssp-hot" x1="312" y1="129" x2="312" y2="146" marker-end="url(#apc-head)"/>
<text class="ssp-small ssp-start ssp-hotlabel" x="318" y="141">3 sync</text>
<line class="ssp-arrow" x1="243" y1="164" x2="158" y2="164" marker-end="url(#apc-head)"/>
<text class="ssp-small" x="200" y="158">4 pull image</text>
</svg>
</div>

<p class="bitgrid-caption">Teal is the deploy path, crossing into the customer's account through one role. The image pull is the only other crossing, and it's read-only.</p>

1. **Assume.** Argo CD runs with a "management role" in the platform account. Each customer cluster has its own role, in the customer's account, that the management role is allowed to assume [@argocd-declarative].
2. **Authorize.** An EKS access entry in each cluster gives that cluster role Kubernetes permissions [@argocd-declarative, @aws-eks-access-entries]. The cluster's registration in Argo CD is a Secret naming the cluster and the role to assume [@argocd-declarative].
3. **Sync.** With those credentials Argo CD applies the app to the cluster. One Argo CD connects out to many clusters' API servers [@argocd-architecture], so it needs a network path to every cluster's endpoint, which is a networking decision to make early (see [reaching private resources](/primers/networking/reaching-private-resources/)).
4. **Pull.** The cluster's nodes pull images from ECR in the platform account. An ECR repository policy can allow other accounts in [@aws-ecr-repo-policies], and ECR can also replicate images into other accounts' registries if you'd rather each account pull locally [@aws-ecr-replication].

The app itself gets AWS permissions through Pod Identity, with a role that lives in Acme's own account, so its permissions only ever need to name Acme's own resources [@aws-eks-pod-identity].

The other way to do step 3 is to install Flux in every cluster and let each one pull from git itself (the [GitOps primer](/primers/deployment/gitops-argo-cd-and-flux/) compares the two). Then nothing in the platform account needs credentials for customer clusters at all, at the cost of one more thing installed and upgraded per cluster.

## Limits that show up at this scale

Every customer adds two accounts and two clusters, so Ledgerly with 40 customers has 80 customer accounts, plus the shared ones. A few AWS limits matter well before that:

| Limit | Default | Why it matters |
|---|---|---|
| Accounts in an organization | 10, adjustable; AWS can grant up to 50,000 depending on the customer [@aws-org-quotas] | With six shared accounts (management, log, audit, network, platform, internal dev) and two per customer, the third customer won't fit until you ask for an increase |
| Accounts being created at once | 5 [@aws-org-quotas] | Onboarding several customers at once queues |
| Accounts closed in 30 days | 20% of member accounts or 250, whichever is higher, up to 1,000; not adjustable [@aws-org-quotas] | Mass teardown has to be spread out |
| Closed accounts | Still count toward the organization's limit until permanently closed [@aws-org-quotas], 90 days after closing [@aws-org-close-account] | A departed customer's accounts take up quota for three months |

People hit the first row on day one. Ask for the increase before the platform goes live, sized for the customers you expect plus the environments each one gets.

## Day two across many accounts

Making accounts is the easy half here too. Keeping 80 of them alike is the job.

**Baseline changes.** A new logging rule or role has to land in every account. AFT reruns its customizations on all accounts, a set, or one [@aws-aft-customizations], and CloudFormation StackSets can create, update, or delete the same stack across many accounts and regions in one operation [@aws-stacksets]. Either way the change is written once and fanned out, never clicked into each account.

**Kubernetes upgrades.** Kubernetes ships a new minor version about every four months. EKS gives each one 14 months of standard support, then 12 months of extended support at an extra cost per cluster hour, and after that it upgrades the cluster automatically [@aws-eks-versions]. Clusters move one minor version at a time, and a rollback is possible only within 7 days of upgrading [@aws-eks-update]. With a release every four months, each cluster needs about three upgrades a year. At 80 customer clusters that's roughly 240 cluster upgrades a year, about one every working day, so upgrades have to be a pipeline that runs in waves (Ledgerly's internal clusters, then every customer's test cluster, then production) rather than a task someone does.

**App releases.** The same wave pattern carries app releases. A new Ledgerly version goes to the internal accounts, then every customer's `-test` account, then production, and the `release` field in each customer file only ever lags, never forks. AWS's SaaS guidance is clear that dedicated stacks should all run the same version [@aws-saas-full-stack].

**Cost.** Each account is visible on the combined bill [@aws-consolidated-billing], which makes idle non-production accounts easy to spot. Every silo carries idle capacity [@aws-saas-silo-isolation], and with a test account per customer, half of Ledgerly's customer accounts sit idle between releases. Scaling test clusters down when no release is in flight cuts that cost.

## How many non-production accounts?

The number of non-production accounts per customer is the decision with the biggest cost lever. Three common shapes, with Ledgerly's choice in the middle:

| Shape | Accounts for 40 customers | Good for |
|---|---|---|
| Prod per customer, one shared test account | 40 + 1 | Customers who only care where their production data lives |
| **Prod and one test account per customer** (Ledgerly) | 80 | Testing a release against each customer's configuration before it reaches them |
| Prod, test, and dev per customer | 120 | Customers who get their own pre-production access, or need to test integrations against it |

Ledgerly picked the middle row because each customer's configuration differs enough that a release should be proven against it before it reaches their production, and because development happens in internal accounts anyway. A shared test account can still hold one namespace per customer, configured like that customer's production, which tests their configuration without the account. Per-customer non-production accounts earn their cost when the customer logs into them, when their configuration differs in ways a namespace can't reproduce (their own network connection, their own identity provider), or when a contract requires it.

## Where to start

1. **Set up the landing zone** with Control Tower, and the OU layout above, before the first customer account exists [@aws-control-tower]. An account's OU decides which SCPs it gets, and AWS recommends moving accounts into a newly governed OU a few at a time so a policy doesn't lock anyone out [@aws-scps], so it's easier to get the tree right first.
2. **Ask for the account quota increase** [@aws-org-quotas].
3. **Build one environment by hand-running the module**, in one account, until a teardown and rebuild produces the same thing.
4. **Wire AFT and the platform account**, then onboard an internal "customer" (yourselves) through the pull request, end to end.
5. **Automate the upgrade waves** before the tenth customer, not after.

For the other end of the scale, where customers share one app and one database, see [the fully pooled version](/primers/deployment/fully-pooled-saas/).
