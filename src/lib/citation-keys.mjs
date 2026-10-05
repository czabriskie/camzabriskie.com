// Shared citation syntax (Decision 0007), so the remark plugin, the pre-build check, and
// the /primers/references/ page all agree on what counts as a citation.

/** [@key] or [@key1, @key2]. Keys are letters, digits, underscores, and hyphens. */
export const CITE = /\[@([\w-]+(?:\s*,\s*@[\w-]+)*)\]/g;

export const splitKeys = (inner) => inner.split(',').map((k) => k.trim().replace(/^@/, ''));

/** Blank out fenced and inline code, keeping offsets and newlines, so code is never read as a citation. */
export function stripCode(markdown) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank).replace(/`[^`\n]*`/g, blank);
}

/**
 * Every citation in a markdown document, outside code: [{ key, index }] in order.
 * `leftovers` are offsets of "[@" that aren't part of a well-formed citation.
 */
export function findCitations(markdown) {
  const text = stripCode(markdown);
  const cites = [];
  for (const m of text.matchAll(CITE)) for (const key of splitKeys(m[1])) cites.push({ key, index: m.index });
  const leftovers = [...text.replace(CITE, (m) => ' '.repeat(m.length)).matchAll(/\[@/g)].map((m) => m.index);
  return { cites, leftovers };
}
