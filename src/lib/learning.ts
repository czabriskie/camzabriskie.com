import { getCollection, type CollectionEntry } from 'astro:content';

export type Note = CollectionEntry<'learning'>;

/**
 * Topics, in the order they appear on /learning/. A topic's notes live in
 * src/content/learning/<slug>/. Adding a topic means adding it here and making the folder.
 */
export const topics = [
  {
    slug: 'networking',
    title: 'Networking',
    blurb: 'How networks are put together, starting from the addresses.',
  },
];

export type Topic = (typeof topics)[number];

const topicOf = (note: Note) => note.id.split('/')[0];
export const noteSlug = (note: Note) => note.id.split('/').slice(1).join('/');
export const noteUrl = (note: Note) => `/learning/${note.id}/`;
/** Position within its topic, as two digits: note 2 = "02". */
export const pos = (i: number) => String(i + 1).padStart(2, '0');

/** Published notes for a topic, in reading order. */
export async function topicNotes(topic: string) {
  return (await getCollection('learning', (n) => !n.data.draft && topicOf(n) === topic)).sort(
    (a, b) => a.data.order - b.data.order,
  );
}

/** Topics that have at least one published note, each with its notes. */
export async function publishedTopics() {
  const out = [];
  for (const topic of topics) {
    const notes = await topicNotes(topic.slug);
    if (notes.length) out.push({ topic, notes });
  }
  return out;
}
