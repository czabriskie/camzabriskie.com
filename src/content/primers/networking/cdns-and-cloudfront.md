---
title: CDNs and CloudFront
description: How a content delivery network serves copies of your site from near your users, how long those copies last, what makes two requests "the same," and how to keep people from going around it to your origin.
order: 7
updated: 2026-10-05
---

A content delivery network (CDN) keeps copies of your content on servers spread around the world and answers each request from one close to the person asking. Pages load faster because the content travels a shorter distance, your own servers handle a fraction of the traffic, and a big spike lands on the CDN instead of on you. Amazon CloudFront is AWS's CDN, and it's the usual way to put HTTPS and a custom domain in front of an S3 bucket or a load balancer.

This builds on [How DNS resolution works](/primers/networking/dns-resolution/) and [Load balancers and TLS termination](/primers/networking/load-balancers-and-tls/).

## The pieces

A few words come up constantly, and CloudFront uses some of its own:

- **Origin:** where the real content lives. An S3 bucket, a load balancer, or any web server [@aws-cloudfront-intro].
- **Edge location:** one of the CDN's data centers around the world, holding cached copies.
- **Distribution:** CloudFront's word for one CDN setup: a domain name, the origins behind it, and the rules for caching.
- **Viewer:** CloudFront's word for whoever makes the request, usually a browser. It's just the client.
- **Cache hit / cache miss:** whether the edge location already had a valid copy (hit) or had to go to the origin for it (miss).

## Following one request

Say a site's logo is at `https://www.example.com/logo.png`, served through CloudFront, and two people in the same city load it:

1. **The first person's browser looks up `www.example.com`.** The name points at the CloudFront distribution, and the request is routed to the edge location with the lowest latency for them [@aws-cloudfront-intro].
2. **That edge location doesn't have the logo yet,** so it's a **cache miss**. The edge fetches it from the origin, sends it to the browser, and keeps a copy.
3. **The second person asks the same edge location for the same logo.** This time it's a **cache hit**: the edge answers immediately and the origin never hears about it.

A request that misses still usually beats going straight to the origin, because CloudFront carries it over AWS's own network instead of across a chain of public networks [@aws-cloudfront-intro].

## How long copies last

Every cached copy has a time to live, the same idea as a [DNS TTL](/primers/networking/dns-resolution/#caching-ttls-and-propagation) applied to whole files. The origin usually sets it with response headers [@rfc9111, @aws-cloudfront-expiration]:

- `Cache-Control: max-age=3600` means "keep this for an hour."
- `Cache-Control: s-maxage=…` does the same but only for shared caches like a CDN, so the CDN can keep something longer than browsers do.
- With no header, CloudFront falls back to the distribution's default TTL, which is 24 hours unless you set it otherwise.

An expired copy isn't thrown away. The next request makes the edge ask the origin whether the file changed, and if it hasn't, the origin replies `304 Not Modified` and the edge keeps serving the copy it has. Rarely requested files can also get evicted before they expire, to make room for popular ones [@aws-cloudfront-expiration].

## The cache key: what makes two requests "the same"

The edge has to decide whether a new request is for something it already has. It does that with a **cache key**, built from the URL plus whichever query strings, headers, and cookies you choose to include. Two requests with the same cache key get the same cached response [@aws-cloudfront-cache-key].

Getting the key right matters in both directions:

- **Too much in the key** means fewer hits. If `?utm_source=newsletter` and `?utm_source=linkedin` are part of the key, the same page gets cached twice and fetched from the origin twice, even though the content is identical.
- **Too little in the key** means wrong answers. If the origin returns English or Spanish depending on the `Accept-Language` header but that header isn't in the key, whoever asks first decides which language everyone else gets until the copy expires.

The rule AWS gives is the right one: include a value in the cache key if it changes what the origin sends back, and leave it out if it doesn't [@aws-cloudfront-cache-key]. Anything personal, like a page that shows someone's account, generally shouldn't be cached at the edge at all.

## Updating content

When a file changes, the edges keep serving the old copy until it expires. There are two ways around that [@aws-cloudfront-invalidation]:

- **Invalidation** tells CloudFront to drop cached copies (of one path, a wildcard like `/images/*`, or files tagged a certain way), so the next request goes back to the origin. It works, but it costs money past a point, and it doesn't reach copies already sitting in browsers or other caches along the way.
- **Versioned file names** give every version of a file a different name, so a new version is simply a new file. AWS recommends this for anything that changes often, and it's cheaper because there's nothing to invalidate.

Most build tools do the versioning for you by putting a hash of the content in the file name. This site's stylesheet, for example, is built as something like `_slug_.qyKGRKAK.css`. The hash changes whenever the CSS does, so the file can be cached for a very long time, and the HTML (which is small and cached briefly) points at whichever version is current.

## Static and dynamic content

Static content, like images, CSS, JavaScript, and prebuilt HTML, is the easy case: the same for everyone, so cache it for a long time.

Dynamic content, built per request, is harder, but a CDN still helps. Short TTLs (even a few seconds) can take a lot of load off an origin during a spike, and requests that aren't cached at all still get the faster network path and TLS handled at the edge.

CloudFront can also run code at the edge [@aws-cloudfront-faq]:

- **CloudFront Functions** are for small, fast changes to requests and responses: rewriting a URL, adding a header, normalizing the cache key.
- **Lambda@Edge** is for heavier work that takes longer, needs libraries, or calls other services.

## HTTPS with CloudFront

There are two separate TLS connections, one on each side of the edge, which is [TLS termination](/primers/networking/load-balancers-and-tls/#terminating-tls) again:

- **Viewer to edge.** For a custom domain like `www.example.com`, the certificate has to cover that name, and if it comes from ACM it has to be requested in the `us-east-1` region, whichever region the rest of your site is in [@aws-cloudfront-cert-requirements].
- **Edge to origin.** A load balancer origin can use a certificate from any region [@aws-cloudfront-cert-requirements].

Then the domain itself points at the distribution, usually with a Route 53 alias record, since a CNAME isn't allowed on the bare domain, `example.com` with nothing in front ([How DNS resolution works](/primers/networking/dns-resolution/#addresses-and-aliases) explains why).

## Keeping people from going around the CDN

Once a CDN is in front of your site, the origin should only take requests from the CDN. Otherwise anyone who finds the origin's address can skip the cache, the WAF, and whatever else the CDN does.

### S3 origins: keep the bucket private

The older way to host a static site on S3 was to turn on static website hosting, make the bucket public, and point CloudFront at the bucket's website endpoint. That leaves the bucket open to everyone [@aws-s3-website-permissions], and S3 website endpoints don't support HTTPS anyway [@aws-s3-endpoints].

The current way is to use the bucket's regular endpoint as the origin and turn on **origin access control (OAC)**. CloudFront signs its requests to S3, the bucket policy only allows requests signed by your distribution, and the bucket stays completely private [@aws-cloudfront-s3-oac]. OAC doesn't work with website endpoints, which is one more reason to leave them behind. (Without the website endpoint, features like a default `index.html` in every folder have to be handled another way, often with a small CloudFront Function.)

### Load balancer and server origins

There are two ways to make sure only CloudFront reaches a load balancer or server:

- **VPC origins.** The load balancer or EC2 instance sits in a [private subnet](/primers/networking/aws-vpc-subnets/#public-and-private-subnets) with no public address at all, and CloudFront connects to it privately. CloudFront becomes the only way in [@aws-cloudfront-vpc-origins].
- **A public origin, locked down two ways** [@aws-cloudfront-alb-origin]:
  - The origin's security group only allows AWS's managed prefix list of CloudFront addresses (`com.amazonaws.global.cloudfront.origin-facing`).
  - CloudFront adds a secret header to every request, and the origin (or a WAF rule in front of it) rejects requests without it.

  You need both, because the prefix list covers every CloudFront distribution in the world, including other people's. The header proves the request came from yours.

CloudFront also gets automatic protection against common DDoS attacks at no extra cost [@aws-shield], and a [WAF](/primers/networking/load-balancers-and-tls/#wafs-only-work-on-http) can be attached to the distribution so attacks get filtered at the edge.

## Checking what the CDN did

The response headers show whether a request hit the cache:

```bash
curl -sI https://www.example.com/logo.png
```

- `x-cache: Hit from cloudfront` or `Miss from cloudfront` says whether the edge had it [@aws-cloudfront-cache-tags-blog].
- `age: 120` says roughly how many seconds it's been since the origin generated or last revalidated this copy [@rfc9111].
- `cache-control` shows what the origin asked for.

Run it twice. A miss followed by a hit means caching is working. Two misses in a row usually means the cache key includes something that changes between requests, or the origin is telling the CDN not to cache.
