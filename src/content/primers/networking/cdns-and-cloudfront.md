---
title: CDNs and CloudFront
description: How a content delivery network serves copies of your site from near your users, how long those copies last, what makes two requests "the same," and how to keep people from going around it to your origin.
order: 8
updated: 2026-10-07
---

A content delivery network (CDN) keeps copies of your content on servers spread around the world and answers each request from one close to the person asking. Pages load faster because the content travels a shorter distance, your own servers handle a fraction of the traffic, and a big spike lands on the CDN instead of on you. Amazon CloudFront is AWS's CDN, and it's the usual way to put HTTPS and a custom domain in front of an S3 bucket or a load balancer.

This builds on [How DNS resolution works](/primers/networking/dns-resolution/) and [Load balancers and TLS termination](/primers/networking/load-balancers-and-tls/).

## The pieces

A few words come up constantly, and CloudFront uses some of its own:

- **Origin:** where the real content lives. An S3 bucket, a load balancer, or any web server [@aws-cloudfront-intro]. This isn't the "origin" from browser security, which is a scheme, host, and port like `https://www.example.com:443` [@rfc6454] and is the unit that CORS rules decide sharing between [@whatwg-fetch]. In a CDN, the origin is a server.
- **Edge location:** one of the CDN's data centers, holding cached copies and answering requests. AWS calls them points of presence (POPs) too [@aws-cloudfront-how-it-works]. There are far more of them than AWS regions, the places your servers and buckets live: 39 regions, but more than 750 CloudFront POPs in over 100 cities [@aws-global-infrastructure, @aws-cloudfront-features].
- **Distribution:** a configuration object, not a server. It holds one CDN setup: the domain names it answers to, the origins behind it, and the rules for caching. CloudFront copies that configuration (but not your content) out to all of its edge locations [@aws-cloudfront-intro].
- **Viewer:** CloudFront's word for whoever makes the request, usually a browser. It's just the client.
- **Cache hit / cache miss:** whether the edge location already had a valid copy (hit) or had to go to the origin for it (miss).

## Following one request

Say a site's logo is at `https://www.example.com/logo.png`, served through CloudFront, and two people in the same city load it:

1. **The first person's browser looks up `www.example.com`.** That name is an alias or CNAME for the hostname CloudFront gave the distribution, something like `d111111abcdef8.cloudfront.net` [@aws-cloudfront-intro] ([How DNS resolution works](/primers/networking/dns-resolution/#addresses-and-aliases) covers aliases). CloudFront's DNS answers with the addresses of the edge location that can best serve this person, usually the nearest one in terms of latency [@aws-cloudfront-how-it-works].
2. **That edge location doesn't have the logo yet,** so it's a **cache miss**. The edge asks the origin for it, starts passing it on to the browser as soon as the first bytes arrive, and keeps a copy [@aws-cloudfront-how-it-works].
3. **The second person asks the same edge location for the same logo.** This time it's a **cache hit**: the edge answers from its copy and the origin never hears about it.

<div class="cdn-flow" role="img" aria-label="Request path through a CDN, with time running downward. Browser A sends GET /logo.png to the edge location. The edge doesn't have it, a miss, so it sends GET /logo.png to the origin, an S3 bucket. The origin answers 200 with the file. The edge stores a copy and answers Browser A with 200 and the logo. Later, Browser B sends GET /logo.png to the same edge location. The edge has it, a hit, and answers Browser B with 200 from its cache. The origin is not contacted for Browser B's request.">
<svg viewBox="0 0 400 252" aria-hidden="true" focusable="false">
<defs><marker id="cf-head" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="cf-head" d="M0,0 L8,4 L0,8 z"/></marker><marker id="cf-head-hit" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="cf-head-hit" d="M0,0 L8,4 L0,8 z"/></marker></defs>
<text class="cf-actor" x="40" y="16">Browser A</text>
<text class="cf-actor" x="115" y="16">Browser B</text>
<text class="cf-actor" x="240" y="16">Edge location</text>
<text class="cf-actor" x="352" y="16">Origin (S3)</text>
<line class="cf-life" x1="40" y1="24" x2="40" y2="244"/>
<line class="cf-life" x1="115" y1="24" x2="115" y2="244"/>
<line class="cf-life" x1="240" y1="24" x2="240" y2="244"/>
<line class="cf-life" x1="352" y1="24" x2="352" y2="162"/>
<line class="cf-life cf-off" x1="352" y1="162" x2="352" y2="196"/>
<line class="cf-life cf-off" x1="352" y1="222" x2="352" y2="244"/>
<line class="cf-msg" x1="40" y1="44" x2="240" y2="50" marker-end="url(#cf-head)"/>
<text class="cf-label" x="178" y="41">GET /logo.png</text>
<rect class="cf-miss" x="216" y="57" width="48" height="15" rx="3"/>
<text class="cf-badge cf-miss-text" x="240" y="68">MISS</text>
<line class="cf-msg" x1="240" y1="84" x2="352" y2="89" marker-end="url(#cf-head)"/>
<text class="cf-label" x="296" y="81">GET /logo.png</text>
<line class="cf-msg" x1="352" y1="104" x2="240" y2="109" marker-end="url(#cf-head)"/>
<text class="cf-label" x="296" y="101">200 + file</text>
<text class="cf-note" x="246" y="127">stores a copy</text>
<line class="cf-msg" x1="240" y1="138" x2="40" y2="144" marker-end="url(#cf-head)"/>
<text class="cf-label" x="178" y="135">200 + logo</text>
<line class="cf-split" x1="8" y1="162" x2="392" y2="162"/>
<text class="cf-later" x="8" y="174">later</text>
<line class="cf-msg" x1="115" y1="184" x2="240" y2="190" marker-end="url(#cf-head)"/>
<text class="cf-label" x="178" y="181">GET /logo.png</text>
<rect class="cf-hit" x="216" y="197" width="48" height="15" rx="3"/>
<text class="cf-badge cf-hit-text" x="240" y="208">HIT</text>
<text class="cf-off-text" x="352" y="207">not</text>
<text class="cf-off-text" x="352" y="217">contacted</text>
<line class="cf-msg cf-msg-hit" x1="240" y1="224" x2="115" y2="230" marker-end="url(#cf-head-hit)"/>
<text class="cf-label cf-hit-label" x="178" y="221">200 from cache</text>
</svg>
</div>
<p class="bitgrid-caption">Time runs downward. Browser A's miss costs a trip to the origin; Browser B's hit is answered entirely at the edge.</p>

A request that misses still usually beats going straight to the origin, because CloudFront carries it over AWS's own network instead of across a chain of public networks [@aws-cloudfront-intro].

## How long copies last

There are two layers of cache between a person and the origin. The browser keeps a **private cache**, used only by that one person, and the CDN keeps a **shared cache**, whose copies get reused for everyone who comes through that edge [@rfc9111]. Every cached copy has a time to live, the same idea as a [DNS TTL](/primers/networking/dns-resolution/#caching-ttls-and-propagation) applied to whole files, and the origin usually sets it with response headers [@rfc9111, @aws-cloudfront-expiration]:

- `Cache-Control: max-age=3600` means a copy stays fresh for 3600 seconds, an hour, and it applies to both layers.
- `Cache-Control: s-maxage=…` overrides `max-age` in shared caches only. `max-age=60, s-maxage=86400` lets the CDN keep a copy for a day while browsers check back after a minute.
- With no header, CloudFront falls back to the distribution's default TTL, which is 24 hours unless you set it otherwise.

An expired copy isn't thrown away, because the edge can ask the origin whether it's still good. When the origin first sent the file, it included an `ETag`, a label for that exact version of the file, and usually a `Last-Modified` date [@rfc9110]. After the copy expires, the next request makes the edge send the origin a **conditional request**: the same `GET`, plus an `If-None-Match` header carrying the ETag, or `If-Modified-Since` carrying the date. If the file hasn't changed, the origin answers `304 Not Modified` with no body, and the edge keeps its copy, which counts as fresh again. If it has changed, the origin sends a normal `200` with the new file [@aws-cloudfront-s3-behavior, @aws-cloudfront-expiration, @rfc9111].

Take one edge and one file, `/logo.png`, sent with `Cache-Control: max-age=3600`:

| Time | What happens at the edge | What the origin sees |
| --- | --- | --- |
| 9:00 | First request: a miss. The edge fetches the file, stores it, and serves it. | A `GET`, answered `200` with the file |
| 9:00 to 10:00 | Every request is a hit, served from the stored copy. | Nothing |
| 10:05 | The copy is an hour old, so it's stale. The next request makes the edge send a `GET` with `If-None-Match: "abc123"`. | Answers `304 Not Modified`, no body |
| 10:05 to 11:05 | Hits again. Same copy, fresh for another hour. | Nothing |
| 10:40 | Someone uploads a new logo to the origin. | |
| 11:10 | The copy is stale again, so another conditional `GET`. | The ETag no longer matches: `200` with the new file, which the edge stores |

From 10:40 to 11:10, visitors kept getting the old logo even though the origin had a new one. That's the cost of caching, and [Updating content](#updating-content) covers the ways around it. Rarely requested files can also get evicted before they expire, to make room for popular ones [@aws-cloudfront-expiration].

## The cache key: what makes two requests "the same"

The edge has to decide whether a new request is for something it already has. It does that with a **cache key**, built from the distribution's domain name and the URL path, plus whichever query strings, headers, and cookies you choose to include. Two requests with the same cache key get the same cached response [@aws-cloudfront-cache-key].

The **query string** is the part of a URL after the `?` [@rfc3986], like `utm_source=newsletter` in `/pricing?utm_source=newsletter`. UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, and a few more) are a common example: marketing links carry them so analytics can tell which newsletter or post sent a visitor [@google-analytics-utm], and the page itself is the same either way.

You choose what goes in the key with a **cache policy** attached to the distribution [@aws-cloudfront-cache-key]. For an S3 origin, CloudFront's recommended settings use a managed policy called CachingOptimized [@aws-cloudfront-preconfigured], which leaves every query string and cookie out of the key and includes no headers except a normalized `Accept-Encoding`, so gzip and Brotli copies of a file are cached separately [@aws-cloudfront-managed-cache-policies].

Three requests for the same page, one after another, through the same edge:

| Request | Query strings in the key | Query strings left out |
| --- | --- | --- |
| `/pricing?utm_source=newsletter` | Miss: first time this key is seen | Miss: first request for `/pricing` |
| `/pricing?utm_source=linkedin` | Miss: a different key | Hit |
| `/pricing` | Miss: a different key again | Hit |

Getting the key right matters in both directions:

- **Too much in the key** means fewer hits. With query strings in the key, the same page above was fetched from the origin three times and stored three times, even though the content is identical.
- **Too little in the key** means wrong answers. If the origin returns English or Spanish depending on the `Accept-Language` header but that header isn't in the key, whoever asks first decides which language everyone else gets until the copy expires.

The rule AWS gives is the right one: include a value in the cache key if it changes what the origin sends back, and leave it out if it doesn't [@aws-cloudfront-cache-key]. Anything personal, like a page that shows someone's account, generally shouldn't be cached at the edge at all.

## Checking what the CDN did

The response headers show what the edge did with a request. This makes a normal `GET` and prints only the headers:

```bash tab="macOS / Linux"
curl -s -o /dev/null -D - https://www.example.com/logo.png
```

```powershell tab="Windows (PowerShell)"
curl.exe -s -o NUL -D - https://www.example.com/logo.png
```

- `-s` (silent) hides the progress meter.
- `-o /dev/null` throws the body away. `NUL` does the same on Windows.
- `-D -` writes the response headers out, and the `-` means to the screen [@curl-manpage].

You'll often see `curl -I` for this instead. It sends a `HEAD` request, which asks for the headers only [@curl-manpage]. Browsers load pages with `GET`, though, so sending a `GET` keeps the test the same as real traffic.

On Windows, type `curl.exe` rather than `curl`, because in Windows PowerShell 5.1 plain `curl` is an alias for a different command [@ms-curl-windows].

The first run might print something like this:

```text
HTTP/2 200
content-type: image/png
content-length: 15086
last-modified: Mon, 05 Oct 2026 22:30:12 GMT
etag: "17ca33b541f56fb3c71408fee97ee739"
cache-control: max-age=3600
x-cache: Miss from cloudfront
via: 1.1 c24c7603f63d587f89cf02b9871d9f2a.cloudfront.net (CloudFront)
x-amz-cf-pop: IAD89-P1
```

And a second run a few seconds later:

```text
HTTP/2 200
content-type: image/png
content-length: 15086
last-modified: Mon, 05 Oct 2026 22:30:12 GMT
etag: "17ca33b541f56fb3c71408fee97ee739"
cache-control: max-age=3600
x-cache: Hit from cloudfront
via: 1.1 5ee1eca840465e7f82dc84ead444149c.cloudfront.net (CloudFront)
x-amz-cf-pop: IAD89-P1
age: 14
```

- `x-cache: Hit from cloudfront` or `Miss from cloudfront` says whether the edge had it [@aws-cloudfront-cache-tags-blog].
- `age: 14` says roughly how many seconds it's been since the origin generated or last revalidated this copy [@rfc9111]. On a miss there's usually no `age` at all, because the copy is brand new.
- `cache-control` shows what the origin asked for.
- `x-amz-cf-pop` names the edge location that answered. The letters are usually the IATA code of an airport near it and the number tells apart several sites in the same area [@aws-cloudfront-logs-reference, @httpdev-x-amz-cf-pop]. AWS doesn't document the part after the dash [@httpdev-x-amz-cf-pop].

A miss followed by a hit means caching is working. Two misses in a row usually means the cache key includes something that changes between requests, or the origin is telling the CDN not to cache.

## Updating content

When a file changes, the edges keep serving the old copy until it expires, like the logo in the table above. There are two ways around that [@aws-cloudfront-invalidation]:

- **Invalidation** tells CloudFront to drop cached copies of one path, like `/logo.png`, or a wildcard like `/images/*`, so the next request goes back to the origin. The first 1,000 paths each month are free across your whole AWS account, and after that each path costs $0.005 on pay-as-you-go pricing. A wildcard counts as one path however many files it matches [@aws-cloudfront-invalidation-pricing, @aws-cloudfront-pricing]. Invalidation also can't reach copies already sitting in browsers or other caches along the way [@aws-cloudfront-invalidation].
- **Versioned file names** give every version of a file a different name, so a new version is simply a new file. AWS recommends this for anything that changes often, and it's cheaper because there's nothing to invalidate [@aws-cloudfront-invalidation].

Most build tools do the versioning for you by putting a short hash of the file's contents in its name, so `styles.css` gets built as something like `styles.3f9a1c.css`. Change one line of CSS and the hash changes, and so does the name. A deploy then goes like this:

1. **Before the deploy,** the HTML, which is cached briefly (say `max-age=60`), loads `/styles.3f9a1c.css`, and that CSS file is cached for a very long time, since nothing else will ever have that name.
2. **The deploy uploads `styles.b72e04.css` and new HTML** that points at it. The old CSS file stays where it is, so anyone still holding the old HTML can load it.
3. **Within a minute,** each edge's copy of the HTML expires and the edge fetches the new HTML. The first request for `styles.b72e04.css` is a miss, because nothing by that name has been cached before, so the edge gets the new file from the origin.

Nobody gets new HTML with old CSS, or old HTML with new CSS, because each version of the HTML names exactly the CSS it was built with. Nothing had to be invalidated.

## Static and dynamic content

Static content, like images, CSS, JavaScript, and prebuilt HTML, is the easy case: the same for everyone, so cache it for a long time.

Dynamic content, built per request, is harder, but a CDN still helps. Short TTLs (even a few seconds) can take a lot of load off an origin during a spike, and requests that aren't cached at all still get the faster network path and TLS handled at the edge. The second one helps because the [handshake's round trips](/primers/networking/tls-handshake/#where-the-handshake-fits) only travel as far as the nearby edge instead of all the way to the origin.

### Running code at the edge

A common first use is a rewrite: someone visits `/blog/`, and a small function changes the request to `/blog/index.html` on its way in, so the edge looks up and fetches the file that actually exists [@aws-cloudfront-add-index]. An S3 website endpoint used to do that job (see [S3 origins](#s3-origins-keep-the-bucket-private)). CloudFront has two kinds of edge code [@aws-cloudfront-faq]:

- **CloudFront Functions** are for small, fast changes to requests and responses: rewriting a URL like that, adding a header, normalizing the cache key.
- **Lambda@Edge** is for heavier work that takes longer, needs libraries, or calls other services.

## HTTPS with CloudFront

There are two separate TLS connections, one on each side of the edge, which is [TLS termination](/primers/networking/load-balancers-and-tls/#terminating-tls) again:

<div class="cdn-tls" role="img" aria-label="Two TLS connections. TLS connection 1 runs from the browser to the edge location and uses a certificate for www.example.com from ACM in us-east-1. The edge location decrypts the request there. TLS connection 2 runs from the edge location to the origin, an Application Load Balancer, and uses the origin's own certificate, the ALB's, which can be from ACM in any region. With an S3 origin, S3 provides the certificate for connection 2.">
<svg viewBox="0 0 400 158" aria-hidden="true" focusable="false">
<line class="tl-conn" x1="85" y1="34" x2="160" y2="34"/>
<line class="tl-conn" x1="240" y1="34" x2="315" y2="34"/>
<line class="tl-lead" x1="122" y1="38" x2="122" y2="62"/>
<line class="tl-lead" x1="278" y1="38" x2="278" y2="62"/>
<g class="tl-box"><rect x="5" y="14" width="80" height="40" rx="4"/><text class="tl-name" x="45" y="32">Browser</text><text class="tl-sub" x="45" y="45">viewer</text></g>
<g class="tl-box"><rect x="160" y="14" width="80" height="40" rx="4"/><text class="tl-name" x="200" y="32">Edge location</text><text class="tl-sub" x="200" y="45">decrypts here</text></g>
<g class="tl-box"><rect x="315" y="14" width="80" height="40" rx="4"/><text class="tl-name" x="355" y="32">ALB</text><text class="tl-sub" x="355" y="45">origin</text></g>
<text class="tl-title" x="122" y="76">TLS connection #1</text>
<text class="tl-sub" x="122" y="90">certificate for</text>
<text class="tl-sub tl-tech" x="122" y="102">www.example.com</text>
<text class="tl-sub" x="122" y="114">from ACM in us-east-1</text>
<text class="tl-title" x="278" y="76">TLS connection #2</text>
<text class="tl-sub" x="278" y="90">the origin's own</text>
<text class="tl-sub" x="278" y="102">certificate (the ALB's)</text>
<text class="tl-sub" x="278" y="114">from ACM in any region</text>
<text class="tl-note" x="200" y="146">With an S3 origin, S3 provides the certificate for #2.</text>
</svg>
</div>
<p class="bitgrid-caption">The edge ends the first connection and opens the second, so each side has its own certificate.</p>

- **Browser to edge.** The certificate has to cover `www.example.com`, and you add that name to the distribution as an **alternate domain name** (CloudFront also calls it a CNAME), which CloudFront only accepts with a valid certificate that covers it [@aws-cloudfront-cnames]. If the certificate comes from ACM, it has to be requested in `us-east-1`, whichever region the rest of your site is in [@aws-cloudfront-cert-requirements]. CloudFront is a global service rather than one that lives in a region, and AWS treats US East (N. Virginia) as its home: CloudFront's API activity is logged there [@aws-cloudfront-cloudtrail], and that's the only region it reads ACM certificates from [@aws-acm-services].
- **Edge to origin.** A load balancer origin uses its own certificate, which can come from any region [@aws-cloudfront-cert-requirements]. An S3 origin needs nothing from you here, because S3 provides the certificate [@aws-cloudfront-s3-https].

Then the domain itself points at the distribution, usually with a Route 53 alias record, since a CNAME isn't allowed on the bare domain, `example.com` with nothing in front ([How DNS resolution works](/primers/networking/dns-resolution/#addresses-and-aliases) explains why).

## Keeping people from going around the CDN

Once a CDN is in front of your site, the origin should only take requests from the CDN. Otherwise anyone who finds the origin can skip the cache, a WAF (web application firewall) if you've attached one, and whatever else the CDN does. Origins aren't hard to find. An internet-facing load balancer has a public DNS name [@aws-cloudfront-restrict-alb], and scanners can sweep the entire IPv4 address space in under an hour [@zmap-2013].

### S3 origins: keep the bucket private

An S3 bucket has two kinds of hostname, and the difference matters here:

| Endpoint | Example hostname | HTTPS |
| --- | --- | --- |
| Website endpoint | `example-bucket.s3-website-us-east-1.amazonaws.com` | No |
| REST endpoint | `example-bucket.s3.us-east-1.amazonaws.com` | Yes |

The website endpoint serves the bucket like a simple web server, and the REST endpoint is the bucket's regular API address [@aws-s3-website-endpoints, @aws-s3-virtual-hosting, @aws-s3-endpoints].

The older way to host a static site on S3, which plenty of tutorials still teach, was to turn on static website hosting, make the bucket public, and point CloudFront at the website endpoint. It's described here so you'll recognize it. It leaves the bucket open to everyone [@aws-s3-website-permissions], and S3 website endpoints don't support HTTPS anyway [@aws-s3-endpoints].

The current way is to use the bucket's REST endpoint as the origin and turn on **origin access control (OAC)**. CloudFront signs its requests to S3, the bucket policy only allows requests signed by your distribution, and the bucket stays completely private [@aws-cloudfront-s3-oac]. OAC doesn't work with website endpoints, which is one more reason to leave them behind. Without the website endpoint, features like a default `index.html` in every folder have to be handled another way, usually with the small [CloudFront Function](#running-code-at-the-edge) described above.

### Load balancer and server origins

There are two ways to make sure only CloudFront reaches a load balancer or server:

- **VPC origins.** The load balancer or EC2 instance sits in a [private subnet](/primers/networking/aws-vpc-subnets/#public-and-private-subnets) with no public address at all, and CloudFront connects to it privately. CloudFront becomes the only way in [@aws-cloudfront-vpc-origins].
- **A public origin, locked down two ways** [@aws-cloudfront-restrict-alb]:
  - **By address.** A **managed prefix list** is a named set of address ranges that a security group rule can use as its source instead of listing the ranges one by one [@aws-vpc-prefix-lists]. AWS maintains one for the CloudFront servers that connect to origins, `com.amazonaws.global.cloudfront.origin-facing`, and keeps it up to date, so a security group rule allowing HTTPS from it lets in CloudFront's servers and nothing else [@aws-cloudfront-prefix-list].
  - **By a secret header.** CloudFront adds a custom header with a random value to every request it sends to the origin, and the origin rejects requests without it, either with its own rules or with a WAF rule in front of it [@aws-cloudfront-restrict-alb, @aws-cloudfront-alb-origin].

  You need both, because the prefix list covers every CloudFront distribution in the world, including other people's. The header proves the request came from yours.

On the distribution, the secret header is set as an origin custom header, and AWS recommends a randomly generated name and value, treated like a password [@aws-cloudfront-restrict-alb]:

```text
X-Origin-Verify: 6f1c2a9e0b7d4e85a3c1f2d9b8e7a6c5
```

On an ALB, the listener then gets two rules [@aws-cloudfront-restrict-alb]:

| Rule | Condition | Action |
| --- | --- | --- |
| 1 | Header `X-Origin-Verify` is `6f1c2a9e0b7d4e85a3c1f2d9b8e7a6c5` | Forward to the target group |
| Default | Everything else | Return a fixed response: `403`, `Access denied` |

A request through CloudFront carries the header and gets the site. A request sent straight to the ALB's DNS name gets the `403`.

CloudFront also gets automatic protection against common DDoS attacks at no extra cost [@aws-shield], and a [WAF](/primers/networking/load-balancers-and-tls/#wafs-only-work-on-http) can be attached to the distribution so attacks get filtered at the edge.
