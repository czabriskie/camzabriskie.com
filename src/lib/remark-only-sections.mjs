// Remark plugin for sections that only apply to one platform, such as AWS (Decision 0012).
// Tag the heading with {only: AWS}:
//
//   ## Where Route 53 fits {only: AWS}
//
// The tag is removed from the heading (so its anchor id stays clean), an "AWS only" label
// goes under it, and everything up to the next heading of the same or higher level is
// wrapped in a <section> named for the platform. Readers who don't use that platform can
// see at a glance which sections to skip.

const TAG = /\s*\{only:\s*([^}]+)\}\s*$/;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (node) => (node.value ?? '') + (node.children ?? []).map(text).join('');

export default function remarkOnlySections() {
  return (tree) => {
    const kids = tree.children;
    for (let i = 0; i < kids.length; i++) {
      const h = kids[i];
      if (h.type !== 'heading') continue;
      const last = h.children[h.children.length - 1];
      const m = last?.type === 'text' && last.value.match(TAG);
      if (!m) continue;
      const label = m[1].trim();
      last.value = last.value.replace(TAG, '');
      if (!last.value) h.children.pop();

      // The section ends at the next heading of the same or higher level (or the page end).
      let end = kids.length;
      for (let j = i + 1; j < kids.length; j++) {
        if (kids[j].type === 'heading' && kids[j].depth <= h.depth) { end = j; break; }
      }
      const open = {
        type: 'html',
        value: `<section class="only-section" aria-label="${esc(label)} only: ${esc(text(h))}">`,
      };
      const banner = { type: 'html', value: `<p class="only-banner"><span class="only-tag">${esc(label)} only</span></p>` };
      const close = { type: 'html', value: '</section>' };
      kids.splice(end, 0, close);
      kids.splice(i + 1, 0, banner);
      kids.splice(i, 0, open);
      i = end + 2; // continue after the inserted close
    }
  };
}
