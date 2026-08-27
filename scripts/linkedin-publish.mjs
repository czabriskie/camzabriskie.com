#!/usr/bin/env node
// Publishes due LinkedIn posts from linkedin/queue/ via LinkedIn's free consumer
// Share API (Decision 0005). Run by .github/workflows/linkedin-publish.yml on a
// cron; can also be run locally. No npm dependencies on purpose — the workflow
// ticks every 15 minutes and must not need an install step.
//
//   node scripts/linkedin-publish.mjs                 publish due queue posts
//   node scripts/linkedin-publish.mjs --check-token   warn when the access token
//                                                     is close to its 60-day expiry
//
// Env (publish):      LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN
// Env (check-token):  LINKEDIN_ACCESS_TOKEN, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
//
// Queue file lifecycle: linkedin/queue/<file>.md (merged = scheduled) → published
// via POST /v2/ugcPosts → file moves to linkedin/posted/ with posted_at, post_urn,
// and first_comment_status appended to its frontmatter. The first comment (where
// the blog/source link lives, since links in the body suppress reach) is attempted
// via the socialActions API; failure there is recorded, not fatal — the daily
// nudge routine tells Cam to paste it himself.

import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';

const QUEUE_DIR = 'linkedin/queue';
const POSTED_DIR = 'linkedin/posted';
const API = 'https://api.linkedin.com';

// Days of token life left below which the weekly check starts failing loudly.
// LinkedIn consumer tokens live 60 days and there is no programmatic refresh at
// this tier, so the renewal (scripts/linkedin-auth.mjs) is a manual errand that
// needs lead time.
const TOKEN_WARN_DAYS = 14;

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exitCode = 1;
}

// Minimal frontmatter reader. Queue files keep to single-line `key: value`
// scalars (plus `- item` list lines, which humans read and this script skips),
// so a real YAML parser would be the only npm dependency for no gain. Splits on
// the FIRST colon only, so URLs in first_comment survive.
function parsePost(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s*(#|-\s)/.test(line) || !line.trim()) continue;
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    if (!(key in meta)) meta[key] = value;
  }
  return { meta, frontmatter: m[1], body: m[2].trim() };
}

async function api(path, token, body) {
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
}

async function publishDuePosts() {
  const now = Date.now();
  let files;
  try {
    files = readdirSync(QUEUE_DIR).filter((f) => f.endsWith('.md')).sort();
  } catch {
    console.log(`No ${QUEUE_DIR} directory; nothing to do.`);
    return;
  }

  const due = [];
  for (const file of files) {
    const path = join(QUEUE_DIR, file);
    const post = parsePost(readFileSync(path, 'utf8'));
    if (!post) {
      console.warn(`SKIP ${file}: no frontmatter block`);
      continue;
    }
    const at = Date.parse(post.meta.publish_at ?? '');
    if (Number.isNaN(at)) {
      // Log-only: a bad date must not turn every 15-minute tick red forever.
      // The PR review of the queue file is where dates get caught.
      console.warn(`SKIP ${file}: missing or unparseable publish_at`);
      continue;
    }
    if (!post.body) {
      console.warn(`SKIP ${file}: empty post body`);
      continue;
    }
    if (at <= now) due.push({ file, path, at, ...post });
  }

  if (due.length === 0) {
    console.log(`Queue: ${files.length} file(s), none due. Nothing to publish.`);
    return;
  }

  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const author = process.env.LINKEDIN_PERSON_URN;
  if (!token || !author) {
    fail(
      `${due.length} post(s) due but LINKEDIN_ACCESS_TOKEN / LINKEDIN_PERSON_URN ` +
        'are not set. See linkedin/README.md for one-time setup.',
    );
    return;
  }

  due.sort((a, b) => a.at - b.at);
  for (const post of due) {
    await publishOne(post, token, author);
  }
}

async function publishOne(post, token, author) {
  console.log(`Publishing ${post.file} (due ${new Date(post.at).toISOString()})...`);

  const visibility = post.meta.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC';
  const res = await api('/v2/ugcPosts', token, {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: post.body },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': visibility },
  });

  if (res.status !== 201) {
    fail(`${post.file}: ugcPosts returned ${res.status}: ${(await res.text()).slice(0, 500)}`);
    return; // file stays in the queue; the failed run's email is the alert
  }
  const urn = res.headers.get('x-restli-id');
  console.log(`Published: ${urn}`);

  // Record the publish BEFORE trying the comment, so a crash between the two
  // can never double-post on the next tick.
  const firstComment = (post.meta.first_comment ?? '').trim();
  moveToPosted(post, urn, firstComment ? 'pending' : 'none');

  if (firstComment) {
    const status = await postFirstComment(urn, firstComment, token, author);
    moveToPosted(post, urn, status, true);
  }
}

async function postFirstComment(urn, text, token, author) {
  // socialActions sits at the edge of what the consumer tier allows; treat any
  // failure as "Cam pastes it himself" (the nudge routine reads this status).
  try {
    const res = await api(
      `/v2/socialActions/${encodeURIComponent(urn)}/comments`,
      token,
      { actor: author, object: urn, message: { text } },
    );
    if (res.status === 201) {
      console.log('First comment posted.');
      return 'posted';
    }
    console.warn(`First comment failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  } catch (err) {
    console.warn(`First comment failed: ${err.message}`);
  }
  return 'failed';
}

function moveToPosted(post, urn, commentStatus, rewrite = false) {
  const target = join(POSTED_DIR, basename(post.path));
  const stamped = [
    '---',
    post.frontmatter,
    `posted_at: ${new Date().toISOString()}`,
    `post_urn: ${urn}`,
    `first_comment_status: ${commentStatus}`,
    '---',
    '',
    post.body,
    '',
  ].join('\n');
  writeFileSync(target, stamped);
  if (!rewrite) unlinkSync(post.path);
}

async function checkToken() {
  const { LINKEDIN_ACCESS_TOKEN, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET } = process.env;
  if (!LINKEDIN_ACCESS_TOKEN || !LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    fail('check-token needs LINKEDIN_ACCESS_TOKEN, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET secrets set.');
    return;
  }
  const res = await fetch('https://www.linkedin.com/oauth/v2/introspectToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
      token: LINKEDIN_ACCESS_TOKEN,
    }),
  });
  if (!res.ok) {
    fail(`introspectToken returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return;
  }
  const info = await res.json();
  if (!info.active) {
    fail('LinkedIn access token is no longer active. Re-run scripts/linkedin-auth.mjs and update the secrets.');
    return;
  }
  const daysLeft = Math.floor((info.expires_at * 1000 - Date.now()) / 86_400_000);
  console.log(`LinkedIn access token active, ~${daysLeft} day(s) left.`);
  if (daysLeft < TOKEN_WARN_DAYS) {
    // A failing weekly job emails Cam — that's the whole alerting mechanism.
    fail(
      `Token expires in ${daysLeft} day(s). Re-run scripts/linkedin-auth.mjs locally and ` +
        'refresh the LINKEDIN_ACCESS_TOKEN secret before scheduled posts start failing.',
    );
  }
}

if (process.argv.includes('--check-token')) {
  await checkToken();
} else {
  await publishDuePosts();
}
