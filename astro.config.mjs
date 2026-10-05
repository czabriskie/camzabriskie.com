import { defineConfig } from 'astro/config';
import remarkCitations from './src/lib/remark-citations.mjs';

export default defineConfig({
  site: 'https://camzabriskie.com',
  markdown: {
    // [@key] citations in primers become IEEE-numbered references (Decision 0007).
    remarkPlugins: [remarkCitations],
  },
});
