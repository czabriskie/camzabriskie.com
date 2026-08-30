#!/usr/bin/env node
// One-time (well, every ~60 days) OAuth dance for the LinkedIn self-scheduler
// (Decision 0005). Run LOCALLY, never in CI — it needs a browser and it prints
// an access token.
//
//   LINKEDIN_CLIENT_ID=... LINKEDIN_CLIENT_SECRET=... node scripts/linkedin-auth.mjs
//
// Prerequisites (once): create an app at https://www.linkedin.com/developers/apps,
// add the free self-serve products "Share on LinkedIn" and "Sign In with LinkedIn
// using OpenID Connect", and add http://localhost:8914/callback as an authorized
// redirect URL under Auth.
//
// The script opens a local listener, prints the authorization URL to visit,
// exchanges the returned code for a ~60-day access token, resolves the person
// URN from /v2/userinfo, and prints the `gh secret set` commands to store both.
// LinkedIn's consumer tier has no programmatic token refresh, which is why the
// weekly check-token job exists to nag before expiry.

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = 8914;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = 'openid profile w_member_social';

const clientId = process.env.LINKEDIN_CLIENT_ID;
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET (from the app\'s Auth tab) and re-run.');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authUrl =
  'https://www.linkedin.com/oauth/v2/authorization?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  try {
    if (url.searchParams.get('state') !== state) throw new Error('state mismatch — start over');
    const error = url.searchParams.get('error');
    if (error) throw new Error(`${error}: ${url.searchParams.get('error_description')}`);

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: url.searchParams.get('code'),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) throw new Error(`accessToken ${tokenRes.status}: ${await tokenRes.text()}`);
    const { access_token, expires_in } = await tokenRes.json();

    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new Error(`userinfo ${meRes.status}: ${await meRes.text()}`);
    const me = await meRes.json();
    const personUrn = `urn:li:person:${me.sub}`;

    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Done — go back to the terminal.');

    const days = Math.floor(expires_in / 86_400);
    console.log(`\nAuthenticated as ${me.name ?? me.sub}. Token lives ~${days} days.\n`);
    console.log('Store the repo secrets (client id/secret only need setting once):\n');
    console.log(`  gh secret set LINKEDIN_ACCESS_TOKEN --repo czabriskie/camzabriskie.com --body '${access_token}'`);
    console.log(`  gh secret set LINKEDIN_PERSON_URN   --repo czabriskie/camzabriskie.com --body '${personUrn}'`);
    console.log('  gh secret set LINKEDIN_CLIENT_ID    --repo czabriskie/camzabriskie.com');
    console.log('  gh secret set LINKEDIN_CLIENT_SECRET --repo czabriskie/camzabriskie.com');
    console.log('\n(The last two read the value from stdin so it stays out of shell history.)');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end(`Failed: ${err.message}`);
    console.error(`\nFailed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('Open this URL in a browser, sign in as Cam, and approve:\n');
  console.log(`  ${authUrl}\n`);
  console.log(`Waiting for the redirect on ${REDIRECT_URI} ...`);
});
