export type Project = {
  /** Repo name, also the link text. */
  name: string;
  /** Primary language / stack, shown as a chip. */
  stack: string;
  blurb: string;
};

export const repoUrl = (name: string) => `https://github.com/czabriskie/${name}`;

/** Things I actually use, or built to solve a problem I had. */
export const tools: Project[] = [
  {
    name: 'obsidian-confluence-plugin',
    stack: 'TypeScript',
    blurb:
      'Two-way sync between a folder in my Obsidian vault and a Confluence space. The vault is the master for structure, so creates, moves, and deletes only flow one direction, while edits to pages already being tracked flow both ways. It hashes content so it can skip API calls nothing changed for, re-creates pages that got deleted on the Confluence side, and links to an existing page instead of falling over when a title collides.',
  },
  {
    name: 'obsidian-cloud-sync',
    stack: 'Shell',
    blurb:
      'What lets a Claude Code cloud session read my notes. Obsidian Sync is end-to-end encrypted and has no API, so there is nothing to call remotely; instead the container becomes a sync device using the official headless client, and a SessionStart hook pulls the vault at the start of every cloud session. Locally it does nothing, because the desktop app is already syncing there and running both at once causes conflicts.',
  },
  {
    name: 'camzabriskie.com',
    stack: 'Astro',
    blurb:
      'This site. Static Astro, no client-side framework, one stylesheet, deployed to GitHub Pages on push to main. Posts are plain markdown files and their byte numbers get worked out at build time from the date order, so I never have to hand-assign one.',
  },
  {
    name: 'mcp-server',
    stack: 'Python',
    blurb:
      'A small Model Context Protocol server I wrote to understand the protocol from the inside, with a current-time tool and weather alert and forecast resources. There is a setup script that writes the Claude Desktop config for you, on macOS or through WSL, which was most of where I learned something.',
  },
];

/** Built to find out whether something would work. */
export const experiments: Project[] = [
  {
    name: 'researcher',
    stack: 'Python · Terraform · React',
    blurb:
      'Agentic lead discovery for bank sales teams going after equipment loans. You hand it a research task in plain language, an orchestrator Lambda has Claude plan the steps, and worker Lambdas run them in order: search, scrape, normalize, then score each lead with an LLM. Results land in Aurora Serverless and show up in a React frontend with CSV export. Every bit of the AWS side is Terraform.',
  },
  {
    name: 'nasa-eyes',
    stack: 'JavaScript',
    blurb:
      "A dependency-free site for browsing NASA's EPIC imagery, which is Earth photographed from a million miles out at the L1 point. Coverage is irregular, so the calendar grays out the days with no imagery before you go hunting for a date that was never captured. Day view animates a whole day of frames, range view is a filmstrip, compare view puts two dates side by side, and every view has a shareable URL.",
  },
  {
    name: 'earth-polychromatic-imaging-camera-api',
    stack: 'Python',
    blurb:
      'The Python client underneath the EPIC work. Command-line tools for pulling images and metadata for a given date and collection, either into a local directory or straight to S3, with Lambda integration for running it on a schedule.',
  },
  {
    name: 'invoke-bedrock-agents',
    stack: 'Python',
    blurb:
      'A small CLI for talking to an AWS Bedrock agent, with session handling and every conversation logged with timestamps. Partly an excuse to keep the tests, linting, type checking, and CI honest on something small enough to see all of.',
  },
  {
    name: 'follicle-force-3000',
    stack: 'Flask',
    blurb:
      'A parody late-night infomercial for a hair growth product that does not exist, complete with a countdown timer that changes at random and testimonials that wobble when you click them. Flask and SQLite behind it, Packer building the AMI it deploys onto. The joke is fake and the deployment path is real.',
  },
];

/** Course material for IS 3600, the cloud computing class I teach at Utah State. */
export const teaching: Project[] = [
  { name: 'microservices-application-example', stack: 'Docker Compose', blurb: 'a Flask message board and Postgres wired together into one application' },
  { name: 'lambda-practice', stack: 'Lambda', blurb: 'a containerized Lambda you can run locally against the runtime emulator first' },
  { name: 'github-actions-practice', stack: 'GitHub Actions', blurb: 'a file-encoding CLI, there to give the pipeline something real to test and lint' },
  { name: 'code-deploy-practice', stack: 'CodeDeploy', blurb: 'Actions packaging the repo to S3 and handing the bundle off to CodeDeploy' },
  { name: 'simple-packer', stack: 'Packer', blurb: 'baking a tagged Ubuntu AMI with a script provisioned onto it' },
  { name: 'simple-glue-athena', stack: 'Glue · Athena', blurb: 'querying flight data sitting in S3 with SQL, from Python, into a DataFrame' },
  { name: 'lazy-loading', stack: 'Flask · DynamoDB', blurb: 'a DynamoDB app with a Redis cache you can switch off to watch the latency come back' },
];
