// Filter box for /primers/ (Decision 0009). The page renders every primer in a hidden
// list; typing here shows the matches and hides the topic cards. Matching is
// case-insensitive and every word typed has to appear somewhere in the title,
// description, or topic name. Without JavaScript the box never appears and the cards
// stay as they are.

const root = document.querySelector<HTMLElement>('.primer-filter');
const results = document.querySelector<HTMLElement>('.primer-results');
const browse = document.querySelector<HTMLElement>('.primer-browse');

if (root && results && browse) {
  const items = [...results.querySelectorAll<HTMLLIElement>('li[data-text]')];
  const empty = results.querySelector<HTMLElement>('.results-empty')!;
  const status = results.querySelector<HTMLElement>('.results-status');

  const label = document.createElement('label');
  label.className = 'visually-hidden';
  label.htmlFor = 'primer-filter-input';
  label.textContent = 'Filter primers';
  const input = document.createElement('input');
  input.id = 'primer-filter-input';
  input.type = 'search';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = root.dataset.placeholder ?? 'Filter primers';
  root.replaceChildren(label, input);

  const apply = () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      results.hidden = true;
      browse.hidden = false;
      if (status) status.textContent = '';
      return;
    }
    let shown = 0;
    for (const li of items) {
      const hit = words.every((w) => li.dataset.text!.includes(w));
      li.hidden = !hit;
      if (hit) shown++;
    }
    empty.hidden = shown > 0;
    if (status) status.textContent = shown === 1 ? '1 primer matches' : `${shown} primers match`;
    results.hidden = false;
    browse.hidden = true;
  };
  input.addEventListener('input', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      apply();
    }
  });
}
