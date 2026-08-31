---
title: "Tech Bytes: the failure that costs you before you notice"
publish_at: 2026-09-02T13:00:00Z
first_comment: "The piece that got me thinking: https://aws.amazon.com/blogs/storage/detect-stalled-amazon-s3-live-replication-to-prevent-unexpected-storage-costs/"
sources:
  - my notes on stalled S3 replication, from "Detect Stalled Amazon S3 Live Replication to Prevent Unexpected Storage Costs"
---
Read an AWS post this week about a failure mode I hadn't thought much about, replication between S3 buckets quietly stalling out, and the retention policy that's supposed to clean up the source copy after a while just can't act on an object that hasn't finished replicating yet. So instead of the usual delete-after-30-days behavior, the object just sits there. Forever, basically, until someone notices the bill.

My first reaction was that AWS should probably just eat that cost, since it's their replication that stalled. Reading further changed my mind. Most of the time it's not AWS's replication failing, it's a bucket policy or permissions setup on the customer side that's misconfigured, which is a config problem, not a service outage. Once I saw it that way, the lack of an automatic retry made a lot more sense. Automatically retrying something that's failing because of a permissions problem you set up wrong just means retrying the same failure forever, quietly, at your own expense.

The part I keep coming back to is how invisible this kind of failure is by design. Nothing pages anyone. Nothing shows up red on a dashboard. The only symptom is a storage bill that's a little bigger than it should be, month after month, until somebody happens to go looking during a cost review or, worse, during a disaster recovery test that doesn't recover what it expected to.

Feels like a good argument for treating "did the thing I configured actually keep working" as its own category of check, separate from "is anything actively broken right now."
