// Adds a "#" link to each section heading in a primer so a reader can grab a link
// straight to that section. Astro already gives the headings ids; this only adds the
// visible link, so without JavaScript the anchors still work from the table of contents.

for (const h of document.querySelectorAll<HTMLElement>('article.note :is(h2, h3)[id]')) {
  const a = document.createElement('a');
  a.className = 'anchor';
  a.href = `#${h.id}`;
  a.textContent = '#';
  a.setAttribute('aria-label', `Link to section: ${h.textContent}`);
  h.append(a);
}
