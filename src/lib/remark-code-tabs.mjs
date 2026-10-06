// Remark plugin for tabbed code blocks (Decision 0008). Consecutive fenced code blocks
// that each carry a tab name in their info string are wrapped into one tab group:
//
//   ```bash tab="macOS / Linux"
//   dig www.example.com
//   ```
//   ```powershell tab="Windows (PowerShell)"
//   Resolve-DnsName www.example.com
//   ```
//
// The blocks stay ordinary code blocks (so syntax highlighting still applies), each
// wrapped in a labelled panel. src/scripts/code-tabs.ts turns the group into tabs and
// remembers the reader's choice; without JavaScript every panel shows with its label.

const TAB = /(?:^|\s)tab="([^"]+)"/;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function remarkCodeTabs() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      const out = [];
      let group = [];
      const flush = () => {
        if (!group.length) return;
        out.push({ type: 'html', value: '<div class="code-tabs">' });
        for (const code of group) {
          const label = code.meta.match(TAB)[1];
          code.meta = code.meta.replace(TAB, '').trim() || null;
          out.push({ type: 'html', value: `<div class="code-tab" data-tab="${esc(label)}"><p class="code-tab-label">${esc(label)}</p>` });
          out.push(code);
          out.push({ type: 'html', value: '</div>' });
        }
        out.push({ type: 'html', value: '</div>' });
        group = [];
      };
      for (const child of node.children) {
        if (child.type === 'code' && child.meta && TAB.test(child.meta)) {
          // A label already in the group means a new group written right after the last one.
          const label = child.meta.match(TAB)[1];
          if (group.some((c) => c.meta.match(TAB)[1] === label)) flush();
          group.push(child);
          continue;
        }
        flush();
        walk(child);
        out.push(child);
      }
      flush();
      node.children = out;
    };
    walk(tree);
  };
}
