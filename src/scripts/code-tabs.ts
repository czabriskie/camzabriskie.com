// Code block helpers for primers (Decision 0008):
//
// 1. Tab groups. src/lib/remark-code-tabs.mjs wraps consecutive tabbed code blocks in
//    <div class="code-tabs">; this turns each group into tabs. Picking a tab switches
//    every group on the page that has a tab with the same name, and the choice is
//    remembered in this browser (localStorage, nothing sent anywhere). With no saved
//    choice, Windows visitors start on the PowerShell tab and everyone else on the first.
// 2. Copy buttons on every code block in a primer.
// 3. Command builders. <div class="cmd-builder" data-default="camzabriskie.com"
//    data-label="Site"></div> placed right before a code block or tab group adds an input;
//    every occurrence of the default value in that block is replaced live with whatever
//    the reader types, so they can copy a command already filled in for their own site.
//
// Without JavaScript, tab groups show every panel with its label, and the builders and
// copy buttons simply don't appear.

const STORAGE_KEY = 'primers.codeTab';

const load = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const save = (label: string) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, label);
  } catch {
    /* private mode or blocked storage: the choice just won't persist */
  }
};

const groups: { labels: string[]; select: (label: string) => void }[] = [];

// Switching every group can change the height of blocks above the one the reader is
// using, so keep that one's tab bar where it was on screen.
function selectEverywhere(label: string, anchor?: HTMLElement) {
  const before = anchor?.getBoundingClientRect().top;
  for (const g of groups) if (g.labels.includes(label)) g.select(label);
  if (anchor && before !== undefined) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
  save(label);
}

function initialLabel(labels: string[]) {
  const saved = load();
  if (saved && labels.includes(saved)) return saved;
  if (/Windows/i.test(navigator.userAgent)) {
    const win = labels.find((l) => /PowerShell|Windows/i.test(l));
    if (win) return win;
  }
  return labels[0];
}

document.querySelectorAll<HTMLElement>('.code-tabs').forEach((group, gi) => {
  const panels = [...group.querySelectorAll<HTMLElement>(':scope > .code-tab')];
  const labels = panels.map((p) => p.dataset.tab ?? '');
  const bar = document.createElement('div');
  bar.className = 'code-tab-bar';
  bar.setAttribute('role', 'tablist');
  const buttons = labels.map((label, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'code-tab-button';
    b.textContent = label;
    b.setAttribute('role', 'tab');
    b.id = `code-tab-${gi}-${i}`;
    panels[i].id = `code-panel-${gi}-${i}`;
    b.setAttribute('aria-controls', panels[i].id);
    panels[i].setAttribute('role', 'tabpanel');
    panels[i].setAttribute('aria-labelledby', b.id);
    b.addEventListener('click', () => selectEverywhere(label, bar));
    b.addEventListener('keydown', (e) => {
      const n = buttons.length;
      const to =
        e.key === 'ArrowRight' ? (i + 1) % n
        : e.key === 'ArrowLeft' ? (i - 1 + n) % n
        : e.key === 'Home' ? 0
        : e.key === 'End' ? n - 1
        : -1;
      if (to < 0) return;
      e.preventDefault();
      buttons[to].focus();
      selectEverywhere(labels[to], bar);
    });
    bar.appendChild(b);
    return b;
  });
  group.prepend(bar);
  group.classList.add('code-tabs-ready');

  const select = (label: string) => {
    labels.forEach((l, i) => {
      const on = l === label;
      buttons[i].setAttribute('aria-selected', String(on));
      buttons[i].tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
  };
  groups.push({ labels, select });
  select(initialLabel(labels));
});

// Copy buttons on every code block inside a primer article.
document.querySelectorAll<HTMLPreElement>('article.note pre').forEach((pre) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code');
  // Screen readers don't announce a button's text changing, so say the result here.
  const status = document.createElement('span');
  status.className = 'visually-hidden';
  status.setAttribute('aria-live', 'polite');
  button.addEventListener('click', async () => {
    const text = pre.querySelector('code')?.innerText ?? pre.innerText;
    try {
      await navigator.clipboard.writeText(text.replace(/\n$/, ''));
      button.textContent = status.textContent = 'Copied';
    } catch {
      button.textContent = 'Select and copy';
      status.textContent = 'Copy failed, select the code and copy it';
    }
    window.setTimeout(() => {
      button.textContent = 'Copy';
      status.textContent = '';
    }, 1600);
  });
  const wrap = document.createElement('div');
  wrap.className = 'code-copy-wrap';
  pre.replaceWith(wrap);
  wrap.append(pre, button, status);
});

// Command builders.
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

document.querySelectorAll<HTMLElement>('.cmd-builder').forEach((builder, bi) => {
  const value = builder.dataset.default ?? '';
  const target = builder.nextElementSibling as HTMLElement | null;
  if (!value || !target) return;

  // Wrap every occurrence of the default value in the target's code in a span once, so
  // later edits only ever touch those spans.
  const spans: HTMLSpanElement[] = [];
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    if (t.parentElement?.closest('code') && t.nodeValue?.includes(value)) texts.push(t);
  }
  for (const t of texts) {
    const parts = t.nodeValue!.split(value);
    const frag = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (part) frag.append(part);
      if (i < parts.length - 1) {
        const s = document.createElement('span');
        s.className = 'cmd-var';
        s.textContent = value;
        spans.push(s);
        frag.append(s);
      }
    });
    t.replaceWith(frag);
  }
  if (!spans.length) return;

  const id = `cmd-builder-${bi}`;
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = builder.dataset.label ?? 'Value';
  const input = document.createElement('input');
  Object.assign(input, { id, type: 'text', autocomplete: 'off', spellcheck: false });
  input.inputMode = 'url';
  const note = document.createElement('span');
  note.className = 'cmd-builder-note';
  note.setAttribute('aria-live', 'polite');
  builder.replaceChildren(label, input, note);
  input.value = value;
  input.addEventListener('input', () => {
    const v = input.value.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!HOSTNAME.test(v)) {
      note.textContent = 'Enter a hostname, like example.com';
      return;
    }
    note.textContent = '';
    spans.forEach((s) => (s.textContent = v.toLowerCase()));
  });
});
