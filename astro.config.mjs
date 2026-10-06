import { defineConfig } from 'astro/config';
import remarkCitations from './src/lib/remark-citations.mjs';
import remarkCodeTabs from './src/lib/remark-code-tabs.mjs';

export default defineConfig({
  site: 'https://camzabriskie.com',
  markdown: {
    // [@key] citations in primers become IEEE-numbered references (Decision 0007), and
    // consecutive code blocks with tab="..." become a tab group (Decision 0008).
    remarkPlugins: [remarkCitations, remarkCodeTabs],
  },
});
