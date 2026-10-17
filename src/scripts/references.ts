// Each primer's References list is collapsed by default (src/lib/remark-citations.mjs).
// Following a citation like [3] to #ref-3 has to open it first, or the browser has
// nothing visible to scroll to. Opening on click (before the browser follows the link)
// covers in-page clicks, and checking the hash covers links from elsewhere and back/forward.

function openFor(hash: string) {
  if (!hash.startsWith('#ref-')) return;
  // Ids are plain ref-N, so the hash needs no decoding (and a malformed one can't throw).
  const target = document.getElementById(hash.slice(1));
  const details = target?.closest('details');
  if (!target || !details || details.open) return;
  details.open = true;
  target.scrollIntoView();
}

document.addEventListener('click', (e) => {
  const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#ref-"]');
  if (link) openFor(link.getAttribute('href') ?? '');
});
window.addEventListener('hashchange', () => openFor(location.hash));
openFor(location.hash);

// A closed <details> prints as just its summary, so open every list for printing and
// put them back afterwards.
let openedForPrint: HTMLDetailsElement[] = [];
window.addEventListener('beforeprint', () => {
  openedForPrint = [...document.querySelectorAll<HTMLDetailsElement>('details.references-toggle:not([open])')];
  openedForPrint.forEach((d) => (d.open = true));
});
window.addEventListener('afterprint', () => {
  openedForPrint.forEach((d) => (d.open = false));
  openedForPrint = [];
});
