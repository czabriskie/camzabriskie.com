# camzabriskie.com

Personal site: resume + two blogs — **Tech Bytes** and **Life Bytes**. Astro 5, fully
static, deployed to GitHub Pages on every push to `main`, served at
[camzabriskie.com](https://camzabriskie.com).

- `npm run dev` — local preview
- `npm run build` — the gate; must pass before any PR
- Posts: markdown in `src/content/tech-bytes/` and `src/content/life-bytes/`
  (frontmatter: `title`, `description`, `date`, optional `draft`)
- Workflow, conventions, and agent roles: `AGENTS.md`
- Why things are the way they are: `docs/Decisions/`
