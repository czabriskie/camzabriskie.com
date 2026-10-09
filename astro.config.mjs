import { defineConfig } from 'astro/config';
import remarkCitations from './src/lib/remark-citations.mjs';
import remarkCodeTabs from './src/lib/remark-code-tabs.mjs';
import remarkOnlySections from './src/lib/remark-only-sections.mjs';

export default defineConfig({
  site: 'https://camzabriskie.com',
  markdown: {
    // [@key] citations in primers become IEEE-numbered references (Decision 0007), and
    // consecutive code blocks with tab="..." become a tab group (Decision 0008), and a
    // heading tagged {only: AWS} marks a platform-specific section (Decision 0011).
    remarkPlugins: [remarkCitations, remarkCodeTabs, remarkOnlySections],
  },
});
