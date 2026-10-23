---
title: Building the fully pooled version
description: What has to be built when every customer shares one app and one database, from carrying the tenant on every request to row-level security, noisy neighbors, per-tenant visibility, and deleting one customer's data.
order: 5
updated: 2026-10-23
---

The [customer separation primer](/primers/deployment/customer-separation-models/) ended at the bottom rung: one deployment of the app, one database, one set of tables, and a `tenant_id` on every row. This primer is about building that rung so customers stay apart.

Ledgerly, the made-up invoicing app, has put every customer on its standard plan into the pool: Birch, Cedar, Dune, and whoever signs next. There's one production environment and one test environment for all of them. Nothing in the infrastructure separates Birch from Cedar any more, so the app and the database have to.

AWS's guidance on tenant isolation starts from a few rules that shape everything below [@aws-saas-isolation-mindset]:

- Isolation isn't optional, and sharing the infrastructure is no reason to relax it [@aws-saas-pool-isolation].
- Logging in isn't isolation. A user who got past the login screen has proved who they are, not that every query they cause stays inside their tenant.
- Isolation shouldn't be left to each developer to remember. It should come from a shared mechanism that applies it whether or not a given piece of code thinks about tenants.

## A few terms

- **Tenant ID**: the identifier for one customer, stored on every row of their data. Ledgerly uses a UUID per tenant.
- **Tenant context**: the tenant ID attached to the request being handled, so every part of the app knows which customer it's working for [@aws-saas-lens-identity].
- **Token** and **claim**: after sign-in, the identity provider issues a signed token, often a JSON Web Token (JWT), listing facts about the user. Each fact is a claim. The app can trust a claim because it can check the signature.
- **Row-level security** (RLS): a PostgreSQL feature that filters which rows a query can see or change, according to a policy on the table [@postgres-rls].
- **Connection pool**: a set of open database connections that requests borrow and hand back, so the app doesn't open a new one for every request. A pooler like PgBouncer sits between the app and the database doing this.
- **Noisy neighbor**: one tenant's load slowing everyone else down [@aws-saas-lens-noisy-neighbor].

## One request, end to end

A Birch user loading their invoices, and the background job that request starts, take this path:

<div class="selfserve-diagram" role="img" aria-label="The path of one request. Step 1: the user signs in and the identity provider issues a token. Step 2: the token, which carries the claim tenant birch, is sent with each request to the app, whose middleware reads the tenant from it. Step 3: the app opens a database transaction and sets the current tenant for that transaction only. The tenant tables apply row-level security and return only Birch's rows. Step 4: the app puts a job on a queue with the tenant ID in the message. Step 5: a worker picks it up and sets the tenant again in its own transaction. A note says the tenant comes only from the token, never from the URL or the request body.">
<svg viewBox="0 0 400 204" aria-hidden="true" focusable="false">
<defs><marker id="fp-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ssp-arrowhead" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<rect class="ssp-box" x="8" y="14" width="88" height="36" rx="3"/>
<text class="ssp-name" x="52" y="29">sign-in</text>
<text class="ssp-small" x="52" y="41">issues token</text>
<rect class="ssp-box" x="112" y="14" width="90" height="36" rx="3"/>
<text class="ssp-name" x="157" y="29">token</text>
<text class="ssp-small" x="157" y="41">tenant: birch</text>
<rect class="ssp-box ssp-core" x="216" y="14" width="80" height="36" rx="3"/>
<text class="ssp-name" x="256" y="29">app</text>
<text class="ssp-small" x="256" y="41">middleware</text>
<rect class="ssp-box" x="324" y="14" width="68" height="36" rx="3"/>
<text class="ssp-name" x="358" y="29">queue</text>
<text class="ssp-small" x="358" y="41">msg + tenant</text>
<line class="ssp-arrow ssp-hot" x1="97" y1="32" x2="110" y2="32" marker-end="url(#fp-head)"/>
<text class="ssp-small ssp-hotlabel" x="104" y="26">1</text>
<line class="ssp-arrow ssp-hot" x1="203" y1="32" x2="214" y2="32" marker-end="url(#fp-head)"/>
<text class="ssp-small ssp-hotlabel" x="209" y="26">2</text>
<line class="ssp-arrow" x1="297" y1="32" x2="322" y2="32" marker-end="url(#fp-head)"/>
<text class="ssp-small" x="310" y="26">4</text>
<line class="ssp-arrow ssp-hot" x1="256" y1="51" x2="256" y2="94" marker-end="url(#fp-head)"/>
<text class="ssp-small ssp-start ssp-hotlabel" x="262" y="76">3</text>
<rect class="ssp-box" x="196" y="96" width="120" height="38" rx="3"/>
<text class="ssp-name" x="256" y="111">transaction</text>
<text class="ssp-small" x="256" y="124">set_config(…, true)</text>
<line class="ssp-arrow" x1="358" y1="51" x2="358" y2="94" marker-end="url(#fp-head)"/>
<rect class="ssp-box" x="324" y="96" width="68" height="38" rx="3"/>
<text class="ssp-name" x="358" y="111">worker</text>
<text class="ssp-small" x="358" y="124">sets tenant</text>
<line class="ssp-arrow" x1="323" y1="115" x2="318" y2="115" marker-end="url(#fp-head)"/>
<text class="ssp-small" x="320" y="108">5</text>
<line class="ssp-arrow ssp-hot" x1="256" y1="135" x2="256" y2="158" marker-end="url(#fp-head)"/>
<rect class="ssp-env" x="196" y="160" width="120" height="38" rx="3"/>
<text class="ssp-name" x="256" y="175">tenant tables</text>
<text class="ssp-small" x="256" y="188">RLS: Birch's rows only</text>
<text class="ssp-small ssp-hotlabel" x="96" y="104">tenant comes only</text>
<text class="ssp-small ssp-hotlabel" x="96" y="116">from the token, never</text>
<text class="ssp-small ssp-hotlabel" x="96" y="128">from the URL or body</text>
</svg>
</div>

<p class="bitgrid-caption">Teal follows the request. The tenant is read once from the signed token, then set again wherever work is picked up: each database transaction (3) and each background job (4, 5).</p>

## Where the tenant comes from

Every user belongs to a tenant, and the identity provider records it. AWS's SaaS guidance calls this binding of user to tenant a "SaaS identity" and recommends putting the tenant into the token at sign-in, so it travels with every request and every service can read it without a round trip to another service [@aws-saas-lens-identity]. With Amazon Cognito, for example, it's a custom attribute on the user, which carries a `custom:` prefix [@aws-cognito-attributes]. Birch's users get a token that includes something like:

```json
{
  "sub": "user-4821",
  "email": "pat@birch.example.com",
  "custom:tenant_id": "6f1c2e9a-...",
  "custom:tier": "standard"
}
```

The app reads the tenant from that claim and nowhere else. A tenant ID in the URL (`/tenants/6f1c…/invoices`) or the request body is something the user typed or the browser sent, and anyone can change it; the signed claim they can't. When one service calls another, it passes the token along so the next service reads the same claim [@aws-saas-lens-identity].

## Put isolation in one place

The pool model depends on every piece of code acquiring the tenant context before it touches data, which is exactly what AWS warns developers will sometimes forget [@aws-saas-isolation-mindset]. Its recommended answer is to move that work into shared libraries, so code gets tenant-scoped access by default rather than by remembering to ask [@aws-saas-hiding-isolation].

For Ledgerly that's two pieces of shared code:

1. **Middleware** that runs before every request handler, checks the token, and puts the tenant ID into the request's context. A request without a valid tenant never reaches a handler.
2. **A database helper** that every query goes through. It opens a transaction, sets the tenant from the request context, runs the work, and commits. Handlers never get a raw connection.

A developer writing a new endpoint calls the helper and writes ordinary queries with no `WHERE tenant_id` in them. Forgetting the tenant isn't possible, because the helper won't run without one.

## The database

### Row-level security on every tenant table

AWS's PostgreSQL guidance calls RLS required for the pool model and recommends enabling it on every table that holds tenant data [@aws-postgres-rls]. Each such table gets a `tenant_id` column and a policy comparing it to a per-transaction setting:

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON invoices
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

Three PostgreSQL rules decide whether that policy does anything [@postgres-rls]:

- Superusers and roles with `BYPASSRLS` skip every policy, so the app must never connect as one.
- The table's owner skips policies too, unless the table has `FORCE ROW LEVEL SECURITY` as above. Better still, the migrations run as an owner role and the app runs as a separate role that owns nothing.
- A table with RLS enabled and no policy returns no rows at all, so a new table fails closed until someone writes its policy.

If a connection never set `app.current_tenant`, `current_setting` raises an error instead of returning a value [@postgres-config-functions], so a query that skipped the helper fails loudly rather than reading everything.

### Set the tenant per transaction, not per connection

Connection pools reuse one database connection for many requests. A tenant set on the connection with a plain `SET` would still be there when the next request, maybe Cedar's, borrows the same connection. PgBouncer's transaction pooling mode, which hands a connection to a client only for the length of one transaction, lists `SET` as never supported in that mode [@pgbouncer-features].

The fix is to scope the setting to the transaction. `SET LOCAL` takes effect only until the transaction commits or rolls back [@postgres-set], and `set_config` does the same when its third argument is `true` [@postgres-config-functions], which is handier from application code because the tenant can be passed as a query parameter:

```sql
BEGIN;
SELECT set_config('app.current_tenant', $1, true);  -- $1 = Birch's tenant ID
SELECT * FROM invoices WHERE status = 'overdue';    -- RLS adds the tenant filter
COMMIT;                                             -- the setting ends here
```

The database helper from the previous section runs this around every unit of work.

### Indexes start with the tenant

Every query in a pooled database is filtered by tenant, whether written or added by RLS. PostgreSQL's multicolumn indexes work best when the query constrains the leading (leftmost) columns [@postgres-multicolumn-indexes], so indexes on tenant tables usually start with `tenant_id`: `(tenant_id, status)` rather than `(status)`. Without that, one large tenant's rows slow down every other tenant's lookups.

## Everything else that stores data

The database is the obvious store and usually not the only one. AWS points out that each storage service needs its own isolation approach [@aws-saas-pooled-storage]:

| Store | How the tenant is enforced |
|---|---|
| PostgreSQL | RLS, as above; IAM can't scope access to rows [@aws-saas-pooled-storage] |
| DynamoDB | An IAM policy condition limiting access to items whose leading key matches the tenant ID [@aws-saas-pooled-storage] |
| S3 | Objects under a per-tenant prefix (`tenants/<id>/…`), read with credentials scoped to that prefix |
| Caches, search indexes | Tenant ID in every key or document, and in every lookup |
| Logs and analytics | Tenant ID as a field on every record |

For AWS services, "credentials scoped to the tenant" works like this. The pooled service has a broad role, and for each request it obtains temporary credentials narrowed to the current tenant [@aws-saas-runtime-iam]. IAM's attribute-based access control does this neatly: the tenant ID is passed as a session tag when the role is assumed, and one policy allows access only where the resource's tag matches that tag [@aws-iam-abac, @aws-iam-session-tags].

## Testing that it holds

A test suite can check isolation, which is cheaper than a customer discovering a gap. These tests cover the common gaps:

- **Cross-tenant requests.** Sign in as a Birch user, take the ID of one of Cedar's invoices, and request it through every endpoint that takes an ID. The answer should be "not found", the same as for an ID that doesn't exist.
- **No tenant set.** Connect as the app's database role, skip the helper, and query each tenant table. It should error.
- **Every table has a policy.** A test that lists tables with a `tenant_id` column and fails if any lacks RLS or a policy. This catches the new table someone adds next year.
- **The app role can't bypass.** A test that fails if the app's role is a superuser, has `BYPASSRLS`, or owns tables.

## Noisy neighbors

In the pool everything is shared, so one customer's month-end batch can slow everyone. AWS says this can be reduced but not eliminated in a pooled database, through enough capacity, read replicas, and caching [@aws-postgres-pool]. The rest has to happen before the load reaches the database:

- **Throttle per tenant.** API Gateway usage plans set a request rate and a quota per API key [@aws-apigw-usage-plans]; behind any other entry point, a rate limiter keyed by tenant ID does the same job.
- **Limit background work per tenant.** A queue worker that runs at most a few jobs per tenant at once keeps one big import from occupying every worker.
- **Tie limits to tiers.** Tiers are how SaaS products give different customers different experiences and prices [@aws-saas-lens-tiers], and limits are where tiers become concrete: a premium tenant gets a higher rate limit, not a separate database.

## Seeing each tenant

A shared database doesn't know which tenant a slow query belonged to; AWS notes that per-tenant monitoring in the pool model needs instrumentation in the app [@aws-postgres-pool]. So the middleware that sets the tenant also adds it to every log line, metric, and trace. With it, someone can answer "is Birch's slowness Birch's own load or everyone's?" and "which tenant is costing us the most?".

The same data feeds billing if the price depends on usage. AWS calls this metering: the system measures each tenant's consumption and sends it to a billing system [@aws-saas-lens-metering].

## A tenant's life

- **Onboarding** creates rows, not infrastructure: a tenant record, an identity-provider group, the first admin user. AWS notes this is what makes pooled onboarding fast and easy to automate [@aws-postgres-pool]. The self-service front door from the [first primer](/primers/deployment/self-service-environments/) still applies, but it now calls an API instead of opening a pull request for an environment.
- **Export and deletion** mean finding every row and object with the tenant's ID, in every store in the table above. Keep a list of the stores that hold tenant data, because a deleted customer's data survives in whichever store nobody remembered.
- **Backups** hold every tenant together. Restoring the whole database to fix one customer's mistake would roll back everyone else, so a one-tenant restore means restoring a copy elsewhere and moving that tenant's rows back.

## Releases

One deployment serves everyone, so every release reaches every customer at once, and the shared test environment is the only rehearsal. Two habits soften that. Release behind feature flags that can be turned on per tenant, starting with an internal tenant and a few willing customers. And roll the deployment itself out gradually where the platform supports it, so a bad build reaches a fraction of traffic before all of it.

## Moving a customer out

Some customers outgrow the pool or later need a contract that rules it out. Because the app is tenant-aware, a dedicated stack for them is the same app with one tenant in it, on the same version as the pool [@aws-saas-full-stack]. Moving them is copying their rows, filtered by `tenant_id`, into the new stack's database and pointing their users there. The pool is the cheap default, and the [account-per-customer setup](/primers/deployment/aws-account-per-customer/) is where a customer goes when they need more.

## Where to start

1. **Tenant in the token.** Add the tenant claim to sign-in before anything else; every later step reads it.
2. **The middleware and the database helper**, so no handler can reach data without a tenant.
3. **RLS on every tenant table**, with the app on a role that can't bypass it, and the tests above in CI.
4. **Tenant ID in logs and metrics**, so problems can be traced to a customer from the first day.
5. **Per-tenant rate limits**, before the first large customer arrives rather than after their first month-end.
