import { getCollection, type CollectionEntry } from 'astro:content';

export type Stream = 'tech-bytes' | 'life-bytes';
export type Byte = CollectionEntry<'tech-bytes'> | CollectionEntry<'life-bytes'>;

export const streamLabel: Record<Stream, string> = {
  'tech-bytes': 'Tech Bytes',
  'life-bytes': 'Life Bytes',
};

/** Published entries, oldest first, each with its byte number (1-based, chronological). */
export async function numberedBytes(stream: Stream) {
  const entries = (await getCollection(stream, ({ data }) => !data.draft)).sort(
    (a, b) => a.data.date.valueOf() - b.data.date.valueOf(),
  );
  return entries.map((entry, i) => ({ entry, n: i + 1, bits: (i + 1).toString(2).padStart(8, '0') }));
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
