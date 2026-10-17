// Remark plugin for IEEE-style citations (Decision 0007). In markdown, cite a source from
// src/data/references.mjs with [@key], or several at once with [@key1, @key2]. Each page
// numbers its own sources [1], [2], ... in order of first citation, links each number to
// its entry, and gets a "References" section appended at the end. Unknown keys are caught
// before the build by scripts/check-primers.mjs (Astro logs errors thrown here but keeps
// going, so this throw is only a second line of defense).

import { references, formatReference } from '../data/references.mjs';
import { CITE, splitKeys } from './citation-keys.mjs';
const SKIP = new Set(['code', 'inlineCode', 'html', 'link']);

export default function remarkCitations() {
  return (tree, file) => {
    // Primers only. Blog posts can contain "[@someone]" as ordinary text.
    if (!String(file.path ?? file.history?.[0] ?? '').includes('/content/primers/')) return;
    const order = [];
    const number = (key) => {
      if (!references[key]) throw new Error(`Unknown citation [@${key}] in ${file.path}. Add it to src/data/references.mjs.`);
      if (!order.includes(key)) order.push(key);
      return order.indexOf(key) + 1;
    };
    // uses[n] = how many times source n has been cited so far, so each citation gets its
    // own id (cite-3-1, cite-3-2, ...) and the reference can link back to every one.
    const uses = [];
    const citeLink = (n) => {
      uses[n] = (uses[n] ?? 0) + 1;
      return `<a class="cite" id="cite-${n}-${uses[n]}" href="#ref-${n}">[${n}]</a>`;
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
          const links = splitKeys(m[1])
            .map((k) => number(k))
            .map(citeLink);
          out.push({ type: 'html', value: `<span class="cites">${links.join(', ')}</span>` });
          last = m.index + m[0].length;
        }
        if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) });
      }
      node.children = out;
    };
    walk(tree);

    if (!order.length) return;
    // Wikipedia-style links back to where a source was cited: one ↩ if it was cited once,
    // or ↩ a b c when it was cited several times.
    const backLinks = (n, count) => {
      if (count === 1) return `<a class="ref-back" href="#cite-${n}-1" aria-label="Back to where [${n}] is cited">↩</a>`;
      const letters = Array.from({ length: count }, (_, j) => {
        const label = j < 26 ? String.fromCharCode(97 + j) : String(j + 1);
        return `<a href="#cite-${n}-${j + 1}" aria-label="Back to citation ${j + 1} of ${count} for [${n}]">${label}</a>`;
      });
      return `<span class="ref-back">↩ ${letters.join(' ')}</span>`;
    };
    tree.children.push(
      { type: 'heading', depth: 2, children: [{ type: 'text', value: 'References' }] },
      {
        type: 'html',
        value:
          // Collapsed by default so the list doesn't dominate the end of the page.
          // src/scripts/references.ts opens it whenever a citation link points into it.
          `<details class="references-toggle"><summary><span class="when-closed">Show all ${order.length} source${order.length === 1 ? '' : 's'}</span><span class="when-open">Hide sources</span></summary>` +
          '<ol class="references">' +
          order.map((key, i) => `<li id="ref-${i + 1}"><span class="ref-n">[${i + 1}]</span> <span>${backLinks(i + 1, uses[i + 1])} ${formatReference(references[key])}</span></li>`).join('') +
          '</ol></details>' +
          '<p class="references-all">Every source cited across the primers is collected on <a href="/primers/references/">one page</a>.</p>',
      },
    );
  };
}
