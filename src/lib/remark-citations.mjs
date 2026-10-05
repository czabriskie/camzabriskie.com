// Remark plugin for IEEE-style citations (Decision 0007). In markdown, cite a source from
// src/data/references.mjs with [@key], or several at once with [@key1, @key2]. Each page
// numbers its own sources [1], [2], ... in order of first citation, links each number to
// its entry, and gets a "References" section appended at the end. Unknown keys are caught
// before the build by scripts/check-primers.mjs (Astro logs errors thrown here but keeps
// going, so this throw is only a second line of defense).

import { references, formatReference } from '../data/references.mjs';

const CITE = /\[@([\w-]+(?:\s*,\s*@[\w-]+)*)\]/g;
const SKIP = new Set(['code', 'inlineCode', 'html', 'link']);

export default function remarkCitations() {
  return (tree, file) => {
    const order = [];
    const number = (key) => {
      if (!references[key]) throw new Error(`Unknown citation [@${key}] in ${file.path}. Add it to src/data/references.mjs.`);
      if (!order.includes(key)) order.push(key);
      return order.indexOf(key) + 1;
    };

    const walk = (node) => {
      if (!node.children || SKIP.has(node.type)) return;
      const out = [];
      for (const child of node.children) {
        if (child.type !== 'text' || !child.value.includes('[@')) {
          walk(child);
          out.push(child);
          continue;
        }
        let last = 0;
        for (const m of child.value.matchAll(CITE)) {
          if (m.index > last) out.push({ type: 'text', value: child.value.slice(last, m.index) });
          const links = m[1]
            .split(',')
            .map((k) => number(k.trim().replace(/^@/, '')))
            .map((n) => `<a class="cite" href="#ref-${n}">[${n}]</a>`);
          out.push({ type: 'html', value: `<span class="cites">${links.join(', ')}</span>` });
          last = m.index + m[0].length;
        }
        if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) });
      }
      node.children = out;
    };
    walk(tree);

    if (!order.length) return;
    tree.children.push(
      { type: 'heading', depth: 2, children: [{ type: 'text', value: 'References' }] },
      {
        type: 'html',
        value:
          '<ol class="references">' +
          order.map((key, i) => `<li id="ref-${i + 1}"><span class="ref-n">[${i + 1}]</span> <span>${formatReference(references[key])}</span></li>`).join('') +
          '</ol>' +
          '<p class="references-all">Every source cited across the primers is collected on <a href="/primers/references/">one page</a>.</p>',
      },
    );
  };
}
